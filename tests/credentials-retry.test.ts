const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import { credentialsService } from "../src/services/credentials-service";
import { type TocTocAuthConfig } from "../src/types";

const config = {
  apiBaseUrl: "https://api.example.com",
  retryOptions: { maxRetries: 2, baseDelay: 0, maxDelay: 0 },
  providers: { credentials: { signInApiRoute: "/login", signUpApiRoute: "/register", refreshTokenApiRoute: "/refresh" } },
} as TocTocAuthConfig;

const response = (status: number, body: object = { message: "failure" }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("login retries each documented HTTP status and network errors", async () => {
  const original = globalThis.fetch;
  try {
    for (const failure of [408, 429, 500, 502, 503, 504, "network"] as const) {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        if (calls === 1) {
          if (failure === "network") throw new TypeError("network failure");
          return response(failure);
        }
        return response(200, { accessToken: "access", refreshToken: "refresh" });
      }) as typeof fetch;
      const result = await credentialsService.loginAsync(config, {});
      assert.equal(result.isSuccess, true, String(failure));
      assert.equal(calls, 2, String(failure));
    }
  } finally { globalThis.fetch = original; }
});

test("login returns the last HTTP response when retries are exhausted and does not retry other statuses", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, expectedCalls] of [[503, 3], [401, 1], [400, 1]] as const) {
      let calls = 0;
      globalThis.fetch = (async () => response(status, { attempt: ++calls })) as typeof fetch;
      const result = await credentialsService.loginAsync<{ attempt: number }>(config, {});
      assert.equal(result.isSuccess, false);
      assert.equal(result.responseBody.attempt, expectedCalls);
      assert.equal(calls, expectedCalls);
    }
    let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new TypeError("offline"); }) as typeof fetch;
    await assert.rejects(credentialsService.loginAsync(config, {}), /offline/);
    assert.equal(calls, 3);
  } finally { globalThis.fetch = original; }
});

test("registration and rotating refresh never retry ambiguous failures", async () => {
  const original = globalThis.fetch;
  try {
    for (const operation of [credentialsService.registerAsync, credentialsService.refreshTokenAsync]) {
      for (const failure of [503, 429, "network"] as const) {
        let calls = 0;
        globalThis.fetch = (async () => {
          calls++;
          if (failure === "network") throw new TypeError("connection lost");
          return response(failure);
        }) as typeof fetch;
        const run = () => operation === credentialsService.registerAsync
          ? credentialsService.registerAsync(config, {})
          : credentialsService.refreshTokenAsync(config, "rotating");
        if (failure === "network") await assert.rejects(run(), /connection lost/);
        else assert.equal((await run()).isSuccess, false);
        assert.equal(calls, 1);
      }
    }
  } finally { globalThis.fetch = original; }
});

test("maxRetries zero performs one login attempt", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return response(503); }) as typeof fetch;
  try {
    const result = await credentialsService.loginAsync({ ...config, retryOptions: { maxRetries: 0 } }, {});
    assert.equal(result.isSuccess, false);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
