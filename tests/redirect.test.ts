const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import { validateRedirectUrl } from "../src/libs/url-validator";

test("redirect validation preserves encoded path, query values, and fragment", () => {
  const url = "/files/a%2Fb?value=a%26b%3Dc&plus=%2B&literal=%25&empty=#part%20one";
  assert.equal(validateRedirectUrl(url, "/fallback"), url);
  assert.equal(validateRedirectUrl("/x?a", "/fallback"), "/x?a");
  assert.equal(validateRedirectUrl("/", "/fallback"), "/");
  assert.equal(validateRedirectUrl("/x?value=%", "/fallback"), "/x?value=%");
});

test("redirect validation blocks external and ambiguous paths", () => {
  for (const input of ["//evil.example/x", "/\\evil.example", "/%2Fevil.example", "/%5cevil.example", "/\t/evil.example", "/%0a/evil.example", "javascript:alert(1)", "https://evil.example", "/bad%2"]) {
    assert.equal(validateRedirectUrl(input, "/fallback"), "/fallback", input);
  }
});

test("same-origin absolute URLs retain encoding and cannot yield a protocol-relative path", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://app.example" } } });
  try {
    assert.equal(validateRedirectUrl("https://app.example/a?value=a%26b#part", "/fallback"), "/a?value=a%26b#part");
    assert.equal(validateRedirectUrl("https://app.example//evil.example", "/fallback"), "/fallback");
    assert.equal(validateRedirectUrl("https://other.example/a", "/fallback"), "/fallback");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete (globalThis as { window?: Window }).window;
  }
});
