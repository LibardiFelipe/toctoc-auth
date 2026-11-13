const { test } = require(["node", "test"].join(":")) as typeof import("node:test");
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TocTocGuard } from "../src/components/toctoc-guard";
import { TocTocAuthContext, TocTocConfigContext } from "../src/contexts";
import { TocTocAuthConfig } from "../src/types";

const renderGuard = (user: object | undefined, roleLocation?: string[]) => {
  const config = {
    providers: { credentials: { signInJsonResponseUser: {
      location: ["data", "user"], roleLocation,
    } } },
  } as TocTocAuthConfig;
  const auth = { getUser: () => user } as React.ContextType<typeof TocTocAuthContext>;
  return renderToStaticMarkup(React.createElement(TocTocConfigContext.Provider, { value: config },
    React.createElement(TocTocAuthContext.Provider, { value: auth },
      React.createElement(TocTocGuard, { allowedRoles: ["admin"], hideContent: true }, "Protected"))));
};

test("guard resolves direct and nested roles relative to the extracted user", () => {
  assert.equal(renderGuard({ role: "admin" }, ["role"]), "Protected");
  assert.equal(renderGuard({ permissions: { role: "admin" } }, ["permissions", "role"]), "Protected");
});

test("guard restricts mismatched, missing, and absent user roles", () => {
  for (const user of [{ role: "member" }, {}, undefined]) {
    assert.match(renderGuard(user, ["role"]), /Access Restricted/);
    assert.doesNotMatch(renderGuard(user, ["role"]), /Protected/);
  }
});

test("guard rejects missing or empty role paths", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    assert.throws(() => renderGuard({ role: "admin" }), /roleLocation/);
    assert.throws(() => renderGuard({ role: "admin" }, []), /roleLocation/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
