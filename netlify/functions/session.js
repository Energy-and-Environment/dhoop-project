"use strict";

const {
  authorized,
  clearCookie,
  createSession,
  json,
  originAllowed,
  safeEqual,
  sessionCookie
} = require("../lib/security");

exports.handler = async event => {
  if (event.httpMethod === "GET") {
    return authorized(event) ? json(200, { authenticated: true }) : json(401, { error: "Unauthorized" });
  }

  if (event.httpMethod === "DELETE") {
    if (!originAllowed(event)) return json(403, { error: "Forbidden" });
    return json(204, {}, { "set-cookie": clearCookie() });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!originAllowed(event)) return json(403, { error: "Forbidden" });

  const expected = process.env.DHOOP_ACCESS_KEY || "";
  const sessionSecret = process.env.DHOOP_SESSION_SECRET || "";
  if (expected.length < 20 || sessionSecret.length < 32) {
    return json(503, { error: "Authentication is not configured" });
  }
  if (!event.body || Buffer.byteLength(event.body, "utf8") > 10_000) {
    return json(400, { error: "Invalid request" });
  }

  let supplied = "";
  try {
    const body = JSON.parse(event.body);
    supplied = typeof body.accessKey === "string" ? body.accessKey : "";
  } catch (_) {
    return json(400, { error: "Invalid request" });
  }

  if (!safeEqual(supplied, expected)) return json(401, { error: "Unauthorized" });
  return json(204, {}, { "set-cookie": sessionCookie(createSession()) });
};
