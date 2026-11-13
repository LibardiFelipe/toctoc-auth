const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const { chromium } = require("playwright");

test("two tabs share one rotating refresh", async () => {
  let refreshes = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(fs.readFileSync("dist/tests/browser-fixture.js"));
    } else if (req.url === "/refresh") {
      refreshes++;
      res.setHeader("Content-Type", "application/json");
      setTimeout(() => {
        if (refreshes > 1) { res.statusCode = 401; res.end("{}"); }
        else res.end(JSON.stringify({ accessToken: "new-access", refreshToken: "new-refresh", user: { role: "admin" } }));
      }, 500);
    } else if (req.url === "/protected") {
      res.statusCode = req.headers.authorization === "Bearer new-access" ? 200 : 401;
      res.end("{}");
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<script src="/fixture.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH || undefined });
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    const url = `http://127.0.0.1:${server.address().port}`;
    await first.goto(url);
    await first.evaluate(() => fixture.init());
    await second.goto(url);
    const responses = await Promise.all([first.evaluate(() => fixture.call()), second.evaluate(() => fixture.call())]);
    const session = await second.evaluate(() => fixture.session());
    assert.deepEqual(responses, [200, 200]);
    assert.equal(refreshes, 1);
    assert.equal(session.refreshToken, "new-refresh");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test("providers synchronize login, refresh, and session clearing across tabs", async () => {
  let rejectRefresh = false;
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(fs.readFileSync("dist/tests/browser-fixture.js"));
    } else if (req.url === "/login" || req.url === "/refresh") {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/refresh" && rejectRefresh) { res.statusCode = 401; res.end("{}"); return; }
      const refreshed = req.url === "/refresh";
      res.end(JSON.stringify({ accessToken: refreshed ? "new-access" : "old-access", refreshToken: refreshed ? "new-refresh" : "old-refresh", user: { role: refreshed ? "admin" : "member" } }));
    } else if (req.url === "/protected") {
      res.statusCode = req.headers.authorization === "Bearer new-access" ? 200 : 401;
      res.end("{}");
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<script src="/fixture.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH || undefined });
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    const url = `http://127.0.0.1:${server.address().port}`;
    await Promise.all([first.goto(url), second.goto(url)]);
    await Promise.all([first.evaluate(() => fixture.mount()), second.evaluate(() => fixture.mount())]);
    const expectStatus = async (page, expected) => page.waitForFunction(value => document.querySelector("#status")?.textContent === value, JSON.stringify(expected));
    const signedOut = { authenticated: false };
    const member = { authenticated: true, user: { role: "member" } };
    const admin = { authenticated: true, user: { role: "admin" } };
    await Promise.all([expectStatus(first, signedOut), expectStatus(second, signedOut)]);
    await first.evaluate(() => fixture.login());
    await Promise.all([expectStatus(first, member), expectStatus(second, member)]);
    await first.evaluate(() => fixture.call());
    await Promise.all([expectStatus(first, admin), expectStatus(second, admin)]);
    await second.evaluate(() => fixture.logout());
    await Promise.all([expectStatus(first, signedOut), expectStatus(second, signedOut)]);
    await first.evaluate(() => fixture.login());
    await Promise.all([expectStatus(first, member), expectStatus(second, member)]);
    await second.evaluate(() => fixture.clear());
    await expectStatus(first, signedOut);
    // A native localStorage.clear() does not emit a storage event in its own tab.
    await first.evaluate(() => fixture.login());
    await Promise.all([expectStatus(first, member), expectStatus(second, member)]);
    rejectRefresh = true;
    await first.evaluate(() => fixture.call().catch(() => {}));
    await Promise.all([expectStatus(first, signedOut), expectStatus(second, signedOut)]);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test("expired JWTs start unauthenticated and refresh on a wrapped 401", async () => {
  const jwt = exp => `e30.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
  const expired = jwt(Math.floor(Date.now() / 1000) - 10);
  const valid = jwt(Math.floor(Date.now() / 1000) + 3600);
  let refreshes = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(fs.readFileSync("dist/tests/browser-fixture.js"));
    } else if (req.url === "/refresh") {
      refreshes++;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ accessToken: valid, refreshToken: "rotated", user: { role: "admin" } }));
    } else if (req.url === "/protected") {
      res.statusCode = req.headers.authorization === `Bearer ${valid}` ? 200 : 401;
      res.end("{}");
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<script src="/fixture.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH || undefined });
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    const url = `http://127.0.0.1:${server.address().port}`;
    await first.goto(url);
    await first.evaluate(token => fixture.initToken(token), expired);
    await second.goto(url);
    await Promise.all([first.evaluate(() => fixture.mount()), second.evaluate(() => fixture.mount())]);
    const expectStatus = (page, authenticated, role) => page.waitForFunction(({ authenticated, role }) => {
      const status = document.querySelector("#status")?.textContent;
      if (!status) return false;
      const value = JSON.parse(status);
      return value.authenticated === authenticated && value.user?.role === role;
    }, { authenticated, role });
    await Promise.all([expectStatus(first, false, "member"), expectStatus(second, false, "member")]);
    assert.equal(refreshes, 0);
    assert.deepEqual(await Promise.all([first.evaluate(() => fixture.call()), second.evaluate(() => fixture.call())]), [200, 200]);
    await Promise.all([expectStatus(first, true, "admin"), expectStatus(second, true, "admin")]);
    assert.equal(refreshes, 1);
    await first.evaluate(token => fixture.initToken(token), jwt(Math.floor(Date.now() / 1000) + 3));
    await expectStatus(first, true, "member");
    await Promise.all([expectStatus(first, false, "member"), expectStatus(second, false, "member")]);
    await first.evaluate(() => fixture.initToken("e30.e30.signature"));
    await expectStatus(first, false, "member");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
