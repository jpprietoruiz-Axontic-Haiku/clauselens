import { chunks, createDb, documents, loadDbEnv, type Database } from "@clauselens/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hybridSearch } from "./hybrid.js";

// Test de integración contra un Postgres real (pgvector + búsqueda de texto
// completo): nada de esto se puede mockear de forma fiel, así que requiere
// DATABASE_URL apuntando a una base migrada (ver docker-compose.yml / CI).

const EMBEDDING_DIMENSIONS = 3072;

function makeVector(activeStart: number, activeCount: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = activeStart; i < activeStart + activeCount; i++) {
    vector[i] = 1;
  }
  return vector;
}

// Vector de la "pregunta": coincide exactamente con el chunk que debería
// ganar en ambas patas.
const QUERY_VECTOR = makeVector(0, 100);
// Solapa mucho con QUERY_VECTOR (alta similitud coseno) pero su texto no
// comparte palabras clave con la pregunta: debería aparecer solo vía vector.
const VECTOR_ONLY_EMBEDDING = makeVector(0, 90);
// Ortogonal a QUERY_VECTOR (similitud coseno ~0) pero su texto sí comparte
// palabras clave: debería aparecer solo vía la pata léxica.
const KEYWORD_ONLY_EMBEDDING = makeVector(2900, 100);

describe("hybridSearch (integración, Postgres real)", () => {
  let db: Database;
  let documentId: string;

  beforeAll(async () => {
    const { DATABASE_URL } = loadDbEnv();
    db = createDb(DATABASE_URL);

    const [document] = await db
      .insert(documents)
      .values({
        title: "Corpus de prueba — hybridSearch",
        sourceUrl: "https://example.org/test-corpus",
        jurisdiction: "TEST",
        version: "1.0",
      })
      .returning({ id: documents.id });
    if (!document) throw new Error("No se pudo crear el documento de prueba.");
    documentId = document.id;

    await db.insert(chunks).values([
      {
        documentId,
        content: "The processing of personal data shall be lawful, fair and transparent.",
        articleRef: "Article 5 (ambas patas)",
        page: null,
        embedding: QUERY_VECTOR,
        tokenCount: 12,
      },
      {
        documentId,
        content: "Unrelated filler text about weather patterns in coastal regions.",
        articleRef: "Article 99 (solo vector)",
        page: null,
        embedding: VECTOR_ONLY_EMBEDDING,
        tokenCount: 10,
      },
      {
        documentId,
        content: "Lawful processing of personal data requires a valid legal basis.",
        articleRef: "Article 6 (solo léxico)",
        page: null,
        embedding: KEYWORD_ONLY_EMBEDDING,
        tokenCount: 10,
      },
    ]);
  });

  afterAll(async () => {
    if (documentId) {
      await db.delete(documents).where(eq(documents.id, documentId));
    }
  });

  it("el chunk que coincide en ambas patas queda primero", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.articleRef).toBe("Article 5 (ambas patas)");
    expect(results[0]?.vectorScore).not.toBeNull();
    expect(results[0]?.keywordScore).not.toBeNull();
  });

  it("recupera un chunk que solo es fuerte en la pata vectorial", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });
    const vectorOnly = results.find((r) => r.articleRef === "Article 99 (solo vector)");

    expect(vectorOnly).toBeDefined();
    expect(vectorOnly?.vectorScore).not.toBeNull();
    expect(vectorOnly?.keywordScore).toBeNull();
  });

  it("recupera un chunk que solo es fuerte en la pata léxica", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });
    const keywordOnly = results.find((r) => r.articleRef === "Article 6 (solo léxico)");

    expect(keywordOnly).toBeDefined();
    expect(keywordOnly?.keywordScore).not.toBeNull();
  });

  it("respeta topK", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 1 });
    expect(results).toHaveLength(1);
  });
});
