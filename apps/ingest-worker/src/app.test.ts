import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("healthz", () => {
  it("responde ok", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("POST /api/ingest", () => {
  it("todavía no está implementado (Hito 2)", async () => {
    const res = await app.request("/api/ingest", { method: "POST" });
    expect(res.status).toBe(501);
  });
});
