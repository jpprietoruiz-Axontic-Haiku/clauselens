import type { Database } from "@clauselens/db";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { Embedder } from "@clauselens/core";

const fakeEmbedder: Embedder = {
  embed: (texts: string[]) => Promise.resolve(texts.map(() => [0, 0, 0])),
};

// Only `transaction` is exercised: testing the real save requires Postgres
// (see the retrieval integration test in packages/core).
const fakeDb = {
  transaction: () => {
    throw new Error("fake-db-not-implemented");
  },
} as unknown as Database;

function buildTestApp() {
  return createApp({ db: fakeDb, embedder: fakeEmbedder });
}

describe("healthz", () => {
  it("responds ok", async () => {
    const app = buildTestApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("POST /api/ingest", () => {
  it("rejects an invalid body with 400", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("processes parse+chunk+embed and reaches the persistence layer", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Test document",
        sourceUrl: "https://example.org/doc",
        jurisdiction: "EU",
        version: "1.0",
        contentType: "html",
        content: "<html><body><p>A test paragraph with enough content.</p></body></html>",
      }),
    });

    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ error: "ingest_failed", message: "fake-db-not-implemented" });
  });
});
