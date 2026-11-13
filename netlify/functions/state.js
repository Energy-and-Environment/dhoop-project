"use strict";

const { MongoClient } = require("mongodb");
const { authorized, json, originAllowed } = require("../lib/security");

let clientPromise;

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
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (event.httpMethod !== "GET" && event.httpMethod !== "PUT") return json(405, { error: "Method not allowed" });
  if (event.httpMethod === "PUT" && !originAllowed(event)) return json(403, { error: "Forbidden" });
  if (!process.env.MONGODB_URI) return json(503, { error: "Database is not configured" });

  try {
    const states = await collection();

    if (event.httpMethod === "GET") {
      const document = await states.findOne(
        { _id: "primary" },
        { projection: { state: 1 } }
      );
      return json(200, { state: document ? document.state : null });
    }

    if (event.httpMethod === "PUT") {
      if (!event.body || Buffer.byteLength(event.body, "utf8") > 5_000_000) {
        return json(413, { error: "State payload is too large" });
      }
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (_) {
        return json(400, { error: "Invalid JSON" });
      }
      if (!validState(body.state)) return json(400, { error: "Invalid state" });

      await states.updateOne(
        { _id: "primary" },
        { $set: { state: body.state, updatedAt: new Date() } },
        { upsert: true }
      );
      return json(200, { ok: true, rev: body.state.rev });
    }
  } catch (error) {
    console.error("MongoDB state function failed", error);
    return json(500, { error: "Database request failed" });
  }
};
