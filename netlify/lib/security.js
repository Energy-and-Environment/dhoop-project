"use strict";

const crypto = require("node:crypto");

const COOKIE = "__Host-dhoop_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest();
}

function safeEqual(left, right) {
  return crypto.timingSafeEqual(digest(left), digest(right));
}

function secret() {
  const value = process.env.DHOOP_SESSION_SECRET || "";
  return value.length >= 32 ? value : "";
}

function sign(encoded) {
  return crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function createSession() {
  if (!secret()) throw new Error("Session secret is not configured");
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    exp: Date.now() + SESSION_MS,
    jti: crypto.randomBytes(16).toString("hex")
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function cookies(event) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
  return Object.fromEntries(raw.split(";").map(part => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(pair => pair[0]));
}

function authorized(event) {
  if (!secret()) return false;
  const token = cookies(event)[COOKIE] || "";
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !safeEqual(signature, sign(encoded))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.v === 1 && Number.isFinite(payload.exp) && payload.exp > Date.now();
  } catch (_) {
    return false;
  }
}

function originAllowed(event) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin;
  const host = headers["x-forwarded-host"] || headers.host || headers.Host;
  if (!origin || !host) return false;
  return origin === `https://${host}` || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && origin === `http://${host}`);
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

module.exports = {
  authorized,
  clearCookie,
  createSession,
  json,
  originAllowed,
  safeEqual,
  sessionCookie
};

