const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import { credentialsService } from "../src/services/credentials-service";
import { type TocTocAuthConfig } from "../src/types";

const config = { apiBaseUrl: "https://api.example.com", providers: { credentials: {
  signInApiRoute: "/login", refreshTokenApiRoute: "/refresh",
  signInJsonResponseAccessTokenLocation: ["data", "access"],
  signInJsonResponseRefreshTokenLocation: ["data", "refresh"],
} } } as TocTocAuthConfig;

test("login and refresh reject invalid tokens at configured nested paths", async () => {
  const originalFetch = globalThis.fetch;
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    for (const operation of ["login", "refresh"] as const) {
      for (const field of ["access", "refresh"] as const) {
        for (const invalid of [null, "", "  \t", 0, 123, false, {}, []]) {
          const tokens = { access: "valid-access", refresh: "valid-refresh", [field]: invalid };
          globalThis.fetch = (async () => new Response(JSON.stringify({ data: tokens }), { status: 200 })) as typeof fetch;
          const call = operation === "login" ? credentialsService.loginAsync(config, {}) : credentialsService.refreshTokenAsync(config, "old-token");
          await assert.rejects(call, (error: Error) => {
            assert.match(error.message, new RegExp(`data\\.${field}`));
            assert.doesNotMatch(error.message, /valid-access|valid-refresh|old-token/);
            return true;
          });
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test("valid tokens are returned unchanged and failures do not require tokens", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const operation of ["login", "refresh"] as const) {
      globalThis.fetch = (async () => new Response(JSON.stringify({ data: { access: " access ", refresh: "refresh" } }), { status: 200 })) as typeof fetch;
      const result = await (operation === "login" ? credentialsService.loginAsync<any>(config, {}) : credentialsService.refreshTokenAsync<any>(config, "old"));
      assert.equal(result.responseBody.data.access, " access ");
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: "denied" }), { status: 401 })) as typeof fetch;
      const failure = await (operation === "login" ? credentialsService.loginAsync(config, {}) : credentialsService.refreshTokenAsync(config, "old"));
      assert.equal(failure.isSuccess, false);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("default token paths also require both nonempty strings", async () => {
  const originalFetch = globalThis.fetch;
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const defaults = { ...config, providers: { credentials: { signInApiRoute: "/login", refreshTokenApiRoute: "/refresh" } } } as TocTocAuthConfig;
  try {
    for (const body of [{ accessToken: "ok" }, { refreshToken: "ok" }, { accessToken: "", refreshToken: "ok" }, { accessToken: "ok", refreshToken: false }]) {
      globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
      await assert.rejects(credentialsService.loginAsync(defaults, {}));
      await assert.rejects(credentialsService.refreshTokenAsync(defaults, "old"));
    }
    globalThis.fetch = (async () => new Response(JSON.stringify({ accessToken: "ok", refreshToken: "also-ok" }), { status: 200 })) as typeof fetch;
    assert.equal((await credentialsService.loginAsync(defaults, {})).isSuccess, true);
    assert.equal((await credentialsService.refreshTokenAsync(defaults, "old")).isSuccess, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});
