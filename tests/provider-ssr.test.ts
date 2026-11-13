const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TocTocAuthProvider } from "../src/providers/toctoc-provider";
import { TocTocRedirect } from "../src/components/toctoc-redirect";
import { useTocTocAuth } from "../src/hooks";
import { localStorageService } from "../src/services/localStorage-service";
import { type TocTocAuthConfig } from "../src/types";

const config = { apiBaseUrl: "https://example.com", encryptionKey: "key", providers: {} } as TocTocAuthConfig;
const Status = () => {
  const auth = useTocTocAuth();
  return React.createElement("div", null, `${auth.isHydrating}:${auth.isAuthenticated}:${auth.getUser()}`);
};
const render = () => renderToString(React.createElement(MemoryRouter, null,
  React.createElement(TocTocAuthProvider, { config },
    React.createElement(Status),
    React.createElement(TocTocRedirect, { to: "/login" }, "private"))));

test("SSR starts in a stable hydration state without touching storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
  try {
    assert.match(render(), /true:false:undefined/);
    assert.doesNotMatch(render(), /private/);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("unavailable or blocked reads and blocked cleanup return no session", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    assert.equal(localStorageService.getItem("session", "key"), null);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
    assert.equal(localStorageService.getItem("session", "key"), null);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: () => "invalid record",
      removeItem: () => { throw new Error("blocked"); },
    } });
    assert.equal(localStorageService.getItem("session", "key"), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
