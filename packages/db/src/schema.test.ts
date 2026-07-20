import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { chunks, conversations, documents, evalResults, evalRuns, messages } from "./schema.js";

describe("schema", () => {
  it("names tables according to the blueprint", () => {
    expect(getTableName(documents)).toBe("documents");
    expect(getTableName(chunks)).toBe("chunks");
    expect(getTableName(conversations)).toBe("conversations");
    expect(getTableName(messages)).toBe("messages");
    expect(getTableName(evalRuns)).toBe("eval_runs");
    expect(getTableName(evalResults)).toBe("eval_results");
  });

  it("chunks exposes the essential blueprint columns", () => {
    const columns = getTableColumns(chunks);
    expect(Object.keys(columns).sort()).toEqual(
      ["articleRef", "content", "documentId", "embedding", "id", "page", "tokenCount"].sort(),
    );
  });

  it("chunks has an HNSW index on embedding", () => {
    const { indexes } = getTableConfig(chunks);
    const embeddingIndex = indexes.find((idx) => idx.config.name === "chunks_embedding_idx");
    expect(embeddingIndex).toBeDefined();
    expect(embeddingIndex?.config.method).toBe("hnsw");
  });

  it("eval_results references eval_runs", () => {
    const columns = getTableColumns(evalResults);
    expect(columns.runId).toBeDefined();
  });
});
