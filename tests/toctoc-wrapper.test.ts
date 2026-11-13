const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter } from "axios";
import { createTocTocAxiosWrapper } from "../src/services/toctoc-wrapper";
import { credentialsService, localStorageService } from "../src/services";
import { type TocTocAuthConfig } from "../src/types";
import { advanceSessionGeneration } from "../src/services/session-generation";
// Model the origin-wide exclusivity of Web Locks, shared by wrapper instances.
let lockQueue: Promise<unknown> = Promise.resolve();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
  request: (_name: string, callback: () => unknown) => {
    const result = lockQueue.then(callback);
    lockQueue = result.catch(() => {});
    return result;
  },
} } });

const config = {
  apiBaseUrl: "https://api.example.com",
  encryptionKey: "key",
  providers: {},
} as TocTocAuthConfig;

test("injects only into trusted requests without an existing Authorization header", async () => {
  const originalGet = localStorageService.getItem;
  localStorageService.getItem = (() => ({ accessToken: "secret", sessionId: "session" })) as typeof originalGet;
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
  let session = { accessToken: "old", refreshToken: "refresh", sessionId: "session" };
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
      let session: { accessToken: string; refreshToken: string; sessionId: string } | null = { accessToken: "old", refreshToken: "refresh", sessionId: "session" };
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
          { accessToken: "new-login", refreshToken: "new-refresh", sessionId: "new-session" } :
          { accessToken: "old", refreshToken: "refresh", sessionId: "new-session" };
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
  let session: { accessToken: string; refreshToken: string; sessionId: string } | null = { accessToken: "old", refreshToken: "refresh", sessionId: "session" };
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

test("wrapper instances serialize rotating refreshes and reuse the result for delayed 401s", async () => {
  const originalGet = localStorageService.getItem;
  const originalSet = localStorageService.setItem;
  const originalRefresh = credentialsService.refreshTokenAsync;
  let session = { accessToken: "access-0", refreshToken: "refresh-0", sessionId: "session" };
  let refreshes = 0;
  let releaseRefresh!: () => void;
  let startedRefresh!: () => void;
  const started = new Promise<void>(resolve => { startedRefresh = resolve; });
  const gate = new Promise<void>(resolve => { releaseRefresh = resolve; });
  let releaseDelayed!: () => void;
  const delayed = new Promise<void>(resolve => { releaseDelayed = resolve; });
  localStorageService.getItem = (() => session) as typeof originalGet;
  localStorageService.setItem = ((_key: string, value: typeof session) => { session = value; }) as typeof originalSet;
  credentialsService.refreshTokenAsync = (async (_config: unknown, token: string) => {
    refreshes++;
    assert.equal(token, "refresh-0", "a rotating refresh token must only be used once");
    startedRefresh();
    await gate;
    return { isSuccess: true, responseBody: { accessToken: "access-1", refreshToken: "refresh-1" } };
  }) as typeof originalRefresh;
  try {
    const adapter: AxiosAdapter = async request => {
      if (request.headers.get("Authorization") === "Bearer access-1") {
        return { data: {}, status: 200, statusText: "OK", headers: {}, config: request };
      }
      if (request.url === "/delayed") await delayed;
      const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: request };
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, undefined, response);
    };
    const one = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    const two = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    const first = one.get("/first");
    const second = two.get("/second");
    const third = two.get("/delayed");
    await started;
    releaseRefresh();
    await Promise.all([first, second]);
    releaseDelayed();
    await third;
    assert.equal(refreshes, 1);
    assert.equal(session.refreshToken, "refresh-1");
  } finally {
    localStorageService.getItem = originalGet;
    localStorageService.setItem = originalSet;
    credentialsService.refreshTokenAsync = originalRefresh;
  }
});

test("without Web Locks a 401 neither refreshes nor clears the session", async () => {
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator")!;
  const originalGet = localStorageService.getItem;
  const originalRefresh = credentialsService.refreshTokenAsync;
  let refreshes = 0;
  const session = { accessToken: "old", refreshToken: "refresh", sessionId: "session" };
  localStorageService.getItem = (() => session) as typeof originalGet;
  credentialsService.refreshTokenAsync = (async () => { refreshes++; throw new Error("unexpected"); }) as typeof originalRefresh;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  try {
    const adapter: AxiosAdapter = async request => {
      const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config: request };
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", request, undefined, response);
    };
    const api = createTocTocAxiosWrapper(config, axios.create({ baseURL: config.apiBaseUrl, adapter }));
    await assert.rejects(api.get("/private"));
    assert.equal(refreshes, 0);
    assert.equal(localStorageService.getItem("key", "key"), session);
  } finally {
    Object.defineProperty(globalThis, "navigator", nav);
    localStorageService.getItem = originalGet;
    credentialsService.refreshTokenAsync = originalRefresh;
  }
});

test("a lost refresh response is not retried with the same rotating token", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new TypeError("network failure"); }) as typeof fetch;
  try {
    const refreshConfig = { ...config, retryOptions: { maxRetries: 3 }, providers: { credentials: {
      refreshTokenApiRoute: "/refresh",
    } } } as TocTocAuthConfig;
    await assert.rejects(credentialsService.refreshTokenAsync(refreshConfig, "rotating-token"));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
