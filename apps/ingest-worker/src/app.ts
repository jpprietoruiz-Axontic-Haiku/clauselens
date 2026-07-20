import type { Database } from "@clauselens/db";
import { Hono } from "hono";
import { z } from "zod";
import type { Embedder } from "@clauselens/core";
import { ingestDocument } from "./ingest/pipeline.js";

export interface AppDeps {
  db: Database;
  embedder: Embedder;
}

const ingestRequestSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().min(1),
  jurisdiction: z.string().min(1),
  version: z.string().min(1),
  contentType: z.enum(["pdf", "html"]),
  // PDF as base64; HTML as plain text.
  content: z.string().min(1),
});

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ status: "ok" as const }));

  app.post("/api/ingest", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = ingestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
    }

    try {
      const result = await ingestDocument(deps.db, deps.embedder, parsed.data);
      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error during ingestion.";
      return c.json({ error: "ingest_failed", message }, 500);
    }
  });

  return app;
}
