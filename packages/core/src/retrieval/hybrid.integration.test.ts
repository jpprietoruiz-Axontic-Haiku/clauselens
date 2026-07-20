import { chunks, createDb, documents, loadDbEnv, type Database } from "@clauselens/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hybridSearch } from "./hybrid.js";

// Integration test against a real Postgres (pgvector + full-text search):
// none of this can be faithfully mocked, so it requires DATABASE_URL
// pointing at a migrated database (see docker-compose.yml / CI).

const EMBEDDING_DIMENSIONS = 3072;

function makeVector(activeStart: number, activeCount: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = activeStart; i < activeStart + activeCount; i++) {
    vector[i] = 1;
  }
  return vector;
}

// "Question" vector: matches exactly the chunk that should win on both legs.
const QUERY_VECTOR = makeVector(0, 100);
// Overlaps heavily with QUERY_VECTOR (high cosine similarity) but its text
// doesn't share keywords with the question: should only appear via vector.
const VECTOR_ONLY_EMBEDDING = makeVector(0, 90);
// Orthogonal to QUERY_VECTOR (cosine similarity ~0) but its text does share
// keywords: should only appear via the lexical leg.
const KEYWORD_ONLY_EMBEDDING = makeVector(2900, 100);

describe("hybridSearch (integration, real Postgres)", () => {
  let db: Database;
  let documentId: string;

  beforeAll(async () => {
    const { DATABASE_URL } = loadDbEnv();
    db = createDb(DATABASE_URL);

    const [document] = await db
      .insert(documents)
      .values({
        title: "Test corpus — hybridSearch",
        sourceUrl: "https://example.org/test-corpus",
        jurisdiction: "TEST",
        version: "1.0",
      })
      .returning({ id: documents.id });
    if (!document) throw new Error("Could not create the test document.");
    documentId = document.id;

    await db.insert(chunks).values([
      {
        documentId,
        content: "The processing of personal data shall be lawful, fair and transparent.",
        articleRef: "Article 5 (both legs)",
        page: null,
        embedding: QUERY_VECTOR,
        tokenCount: 12,
      },
      {
        documentId,
        content: "Unrelated filler text about weather patterns in coastal regions.",
        articleRef: "Article 99 (vector only)",
        page: null,
        embedding: VECTOR_ONLY_EMBEDDING,
        tokenCount: 10,
      },
      {
        documentId,
        content: "Lawful processing of personal data requires a valid legal basis.",
        articleRef: "Article 6 (keyword only)",
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

  it("the chunk that matches on both legs comes first", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.articleRef).toBe("Article 5 (both legs)");
    expect(results[0]?.vectorScore).not.toBeNull();
    expect(results[0]?.keywordScore).not.toBeNull();
  });

  it("retrieves a chunk that is only strong on the vector leg", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });
    const vectorOnly = results.find((r) => r.articleRef === "Article 99 (vector only)");

    expect(vectorOnly).toBeDefined();
    expect(vectorOnly?.vectorScore).not.toBeNull();
    expect(vectorOnly?.keywordScore).toBeNull();
  });

  it("retrieves a chunk that is only strong on the lexical leg", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 5 });
    const keywordOnly = results.find((r) => r.articleRef === "Article 6 (keyword only)");

    expect(keywordOnly).toBeDefined();
    expect(keywordOnly?.keywordScore).not.toBeNull();
  });

  it("respects topK", async () => {
    const results = await hybridSearch(db, QUERY_VECTOR, "personal data lawful", { topK: 1 });
    expect(results).toHaveLength(1);
  });
});
