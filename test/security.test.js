"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

process.env.DHOOP_ACCESS_KEY = "correct-access-key-with-20-plus-characters";
process.env.DHOOP_SESSION_SECRET = "a-different-session-secret-with-at-least-32-characters";
delete process.env.MONGODB_URI;

const security = require("../netlify/lib/security");
const session = require("../netlify/functions/session").handler;
const state = require("../netlify/functions/state").handler;

const headers = {
  host: "dhoop-project.netlify.app",
  origin: "https://dhoop-project.netlify.app"
};

test("content security policy authorizes only the current inline script", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const hash = `sha256-${crypto.createHash("sha256").update(script).digest("base64")}`;
  const responseHeaders = fs.readFileSync(path.join(root, "_headers"), "utf8");
  assert.match(responseHeaders, new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(responseHeaders, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(script, /localStorage\.(setItem|getItem)/);
});

test("login rejects cross-origin requests", async () => {
  const result = await session({
    httpMethod: "POST",
    headers: { ...headers, origin: "https://attacker.example" },
    body: JSON.stringify({ accessKey: process.env.DHOOP_ACCESS_KEY })
  });
  assert.equal(result.statusCode, 403);
});

test("login rejects an incorrect access key", async () => {
  const result = await session({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({ accessKey: "incorrect-access-key-value" })
  });
  assert.equal(result.statusCode, 401);
  assert.equal(result.headers["set-cookie"], undefined);
});

test("login returns a hardened cookie without exposing the key", async () => {
  const result = await session({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({ accessKey: process.env.DHOOP_ACCESS_KEY })
  });
  assert.equal(result.statusCode, 204);
  const cookie = result.headers["set-cookie"];
  assert.match(cookie, /^__Host-dhoop_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, new RegExp(process.env.DHOOP_ACCESS_KEY));
  assert.equal(security.authorized({ headers: { cookie } }), true);
  const tokenCookie = cookie.split(";")[0];
  const tampered = tokenCookie.slice(0, -1) + (tokenCookie.endsWith("x") ? "y" : "x");
  assert.equal(security.authorized({ headers: { cookie: tampered } }), false);
});

test("state API rejects missing sessions before touching MongoDB", async () => {
  const result = await state({ httpMethod: "GET", headers: {} });
  assert.equal(result.statusCode, 401);
});

test("state writes require a matching origin", async () => {
  const token = security.createSession();
  const result = await state({
    httpMethod: "PUT",
    headers: { cookie: `__Host-dhoop_session=${token}`, host: headers.host, origin: "https://attacker.example" },
    body: "{}"
  });
  assert.equal(result.statusCode, 403);
});

test("authenticated API fails safely when MongoDB is not configured", async () => {
  const token = security.createSession();
  const result = await state({
    httpMethod: "GET",
    headers: { cookie: `__Host-dhoop_session=${token}` }
  });
  assert.equal(result.statusCode, 503);
  assert.doesNotMatch(result.body, /MONGODB_URI/);
});
