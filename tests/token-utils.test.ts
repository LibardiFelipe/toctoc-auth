const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import { isTokenExpired } from "../src/libs/token-utils";

const jwt = (payload: unknown) => `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

test("decodes UTF-8 and Base64URL claims and checks expiration", () => {
  assert.equal(isTokenExpired(jwt({ name: "😿", exp: Date.now() / 1000 + 60 })), false);
  assert.equal(isTokenExpired(jwt({ exp: Date.now() / 1000 - 1 })), true);
  assert.equal(isTokenExpired(jwt({ exp: 0 })), true);
});

test("rejects missing, malformed, and nonnumeric expiration claims", () => {
  for (const token of ["opaque", "a.!.b", "a._w.b", jwt({}), jwt({ exp: "9999999999" }), jwt({ exp: null }), jwt({ exp: 1e308 })]) {
    assert.equal(isTokenExpired(token), true);
  }
});
