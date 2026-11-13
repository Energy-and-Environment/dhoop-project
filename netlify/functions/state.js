"use strict";

const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");

let clientPromise;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    },
    body: JSON.stringify(body)
  };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(event) {
  const expected = process.env.DHOOP_ACCESS_KEY;
  if (!expected) return false;
  return safeEqual(event.headers["x-dhoop-key"], expected);
}

async function collection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!clientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    clientPromise = client.connect().catch(error => {
      clientPromise = undefined;
      throw error;
    });
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "dhoop").collection("app_state");
}

function validState(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    typeof value.rev === "string" && value.rev.length <= 100 &&
    value.settings && typeof value.settings === "object" &&
    Array.isArray(value.projects) && value.projects.length <= 10000;
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return response(204, {});
  if (!authorized(event)) return response(401, { error: "Unauthorized" });
  if (!process.env.MONGODB_URI) return response(503, { error: "Database is not configured" });

  try {
    const states = await collection();

    if (event.httpMethod === "GET") {
      const document = await states.findOne(
        { _id: "primary" },
        { projection: { state: 1 } }
      );
      return response(200, { state: document ? document.state : null });
    }

    if (event.httpMethod === "PUT") {
      if (!event.body || Buffer.byteLength(event.body, "utf8") > 5_000_000) {
        return response(413, { error: "State payload is too large" });
      }
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (_) {
        return response(400, { error: "Invalid JSON" });
      }
      if (!validState(body.state)) return response(400, { error: "Invalid state" });

      await states.updateOne(
        { _id: "primary" },
        { $set: { state: body.state, updatedAt: new Date() } },
        { upsert: true }
      );
      return response(200, { ok: true, rev: body.state.rev });
    }

    return response(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("MongoDB state function failed", error);
    return response(500, { error: "Database request failed" });
  }
};
