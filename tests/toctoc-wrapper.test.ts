const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter } from "axios";
import { createTocTocAxiosWrapper } from "../src/services/toctoc-wrapper";
import { credentialsService, localStorageService } from "../src/services";
import { type TocTocAuthConfig } from "../src/types";
import { advanceSessionGeneration } from "../src/services/session-generation";
import { RefreshTokenManager } from "../src/services/refresh-manager";

const config = {
  apiBaseUrl: "https://api.example.com",
  encryptionKey: "key",
  providers: {},
} as TocTocAuthConfig;

test("a new session does not reuse an older session's pending refresh", async () => {
  const manager = new RefreshTokenManager();
  const completions: Array<(value: any) => void> = [];
  const refresh = () => new Promise<any>(resolve => completions.push(resolve));
  const first = manager.refresh(config, "same-token", refresh, 1);
  const second = manager.refresh(config, "same-token", refresh, 2);
  assert.equal(completions.length, 2);
  completions[0]({ isSuccess: true, responseBody: "old" });
  completions[1]({ isSuccess: true, responseBody: "new" });
  assert.equal((await first).responseBody, "old");
  assert.equal((await second).responseBody, "new");
});

test("injects only into trusted requests without an existing Authorization header", async () => {
  const originalGet = localStorageService.getItem;
  localStorageService.getItem = (() => ({ accessToken: "secret" })) as typeof originalGet;
  try {
    const seen: Array<string | undefined> = [];
    const adapter: AxiosAdapter = async request => {
      seen.push(request.headers.get("Authorization") as string | undefined);
      return { data: {}, status: 200, statusText: "OK", headers: {}, config: request };
    };
    const api = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    await api.get("/private");
    await api.get("https://other.example.com/private");
    await api.get("//other.example.com/private");
    await api.get("https://api.example.com:444/private");
    await api.get("/private", { baseURL: "https://other.example.com" });
    await api.get("/private", { headers: { authorization: "Basic caller" } });
    await api.get("/private", { headers: { Authorization: false } });
    assert.deepEqual(seen, ["Bearer secret", undefined, undefined, undefined, undefined, "Basic caller", false]);
  } finally {
    localStorageService.getItem = originalGet;
  }
});

test("refreshes only requests authenticated by the wrapper", async () => {
  const originalGet = localStorageService.getItem;
  const originalSet = localStorageService.setItem;
  const originalRefresh = credentialsService.refreshTokenAsync;
  let refreshes = 0;
  let session = { accessToken: "old", refreshToken: "refresh" };
  localStorageService.getItem = (() => session) as typeof originalGet;
  localStorageService.setItem = ((_key: string, value: typeof session) => { session = value; }) as typeof originalSet;
  credentialsService.refreshTokenAsync = (async () => {
    refreshes++;
    return { isSuccess: true, responseBody: { accessToken: "new", refreshToken: "next" } };
  }) as typeof originalRefresh;
  try {
    const adapter: AxiosAdapter = async request => {
      if (request.headers.get("Authorization") === "Bearer new") {
        return { data: {}, status: 200, statusText: "OK", headers: {}, config: request };
      }
      const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: request };
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, undefined, response);
    };
    const api = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    await assert.rejects(api.get("https://other.example.com/private"));
    await assert.rejects(api.get("/private", { headers: { authorization: "Basic caller" } }));
    assert.equal(refreshes, 0);
    await api.get("/private");
    assert.equal(refreshes, 1);
  } finally {
    localStorageService.getItem = originalGet;
    localStorageService.setItem = originalSet;
    credentialsService.refreshTokenAsync = originalRefresh;
  }
});

for (const change of ["sign out", "new login", "new login with same tokens"] as const) {
  for (const outcome of ["success", "failure", "error"] as const) {
    test(`a stale refresh cannot affect ${change} after ${outcome}`, async () => {
      const originalGet = localStorageService.getItem;
      const originalSet = localStorageService.setItem;
      const originalRemove = localStorageService.removeItem;
      const originalRefresh = credentialsService.refreshTokenAsync;
      let session: { accessToken: string; refreshToken: string } | null = { accessToken: "old", refreshToken: "refresh" };
      let writes = 0;
      let requests = 0;
      let start!: () => void;
      let complete!: (value: any) => void;
      let fail!: (reason: Error) => void;
      const started = new Promise<void>(resolve => { start = resolve; });
      const pending = new Promise<any>((resolve, reject) => { complete = resolve; fail = reject; });
      localStorageService.getItem = (() => session) as typeof originalGet;
      localStorageService.setItem = ((_key: string, value: typeof session) => { writes++; session = value; }) as typeof originalSet;
      localStorageService.removeItem = (() => { session = null; }) as typeof originalRemove;
      credentialsService.refreshTokenAsync = (() => { start(); return pending; }) as typeof originalRefresh;
      try {
        const adapter: AxiosAdapter = async request => {
          requests++;
          const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: request };
          throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, undefined, response);
        };
        const api = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
        const request = api.get("/private");
        const rejected = assert.rejects(request);
        await started;
        advanceSessionGeneration(); // The provider advances this on sign-out and successful sign-in.
        session = change === "sign out" ? null : change === "new login" ?
          { accessToken: "new-login", refreshToken: "new-refresh" } :
          { accessToken: "old", refreshToken: "refresh" };
        const expected = session;
        if (outcome === "error") fail(new Error("network error"));
        else complete(outcome === "failure" ? { isSuccess: false } :
          { isSuccess: true, responseBody: { accessToken: "stale", refreshToken: "stale-refresh" } });
        await rejected;
        assert.equal(session, expected);
        assert.equal(writes, 0);
        assert.equal(requests, 1);
      } finally {
        localStorageService.getItem = originalGet;
        localStorageService.setItem = originalSet;
        localStorageService.removeItem = originalRemove;
        credentialsService.refreshTokenAsync = originalRefresh;
      }
    });
  }
}

test("cancels a queued retry if the session changes before its interceptor runs", async () => {
  const originalGet = localStorageService.getItem;
  const originalSet = localStorageService.setItem;
  const originalRefresh = credentialsService.refreshTokenAsync;
  let session: { accessToken: string; refreshToken: string } | null = { accessToken: "old", refreshToken: "refresh" };
  let requests = 0;
  localStorageService.getItem = (() => session) as typeof originalGet;
  localStorageService.setItem = ((_key: string, value: typeof session) => { session = value; }) as typeof originalSet;
  credentialsService.refreshTokenAsync = (async () => ({
    isSuccess: true, responseBody: { accessToken: "new", refreshToken: "next" },
  })) as typeof originalRefresh;
  try {
    const adapter: AxiosAdapter = async request => {
      requests++;
      const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: request };
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, undefined, response);
    };
    const api = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    api.interceptors.request.use(request => {
      if ((request as any).__tocTocRetrySession) {
        advanceSessionGeneration();
        session = null;
      }
      return request;
    });
    await assert.rejects(api.get("/private"), axios.isCancel);
    assert.equal(requests, 1);
    assert.equal(session, null);
  } finally {
    localStorageService.getItem = originalGet;
    localStorageService.setItem = originalSet;
    credentialsService.refreshTokenAsync = originalRefresh;
  }
});
