import { Hono } from "hono";

export const app = new Hono();

app.get("/healthz", (c) => c.json({ status: "ok" as const }));

// Implementado en el Hito 2: parse -> chunking semántico -> embeddings -> upsert en pgvector.
app.post("/api/ingest", (c) =>
  c.json({ error: "not_implemented", message: "El pipeline de ingesta llega en el Hito 2." }, 501),
);
