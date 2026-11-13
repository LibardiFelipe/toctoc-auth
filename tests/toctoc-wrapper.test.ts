const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter } from "axios";
import { createTocTocAxiosWrapper } from "../src/services/toctoc-wrapper";
import { credentialsService, localStorageService } from "../src/services";
import { type TocTocAuthConfig } from "../src/types";

const config = {
  apiBaseUrl: "https://api.example.com",
  encryptionKey: "key",
  providers: {},
} as TocTocAuthConfig;

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
  localStorageService.getItem = (() => ({ accessToken: "old", refreshToken: "refresh" })) as typeof originalGet;
  localStorageService.setItem = (() => {}) as typeof originalSet;
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
