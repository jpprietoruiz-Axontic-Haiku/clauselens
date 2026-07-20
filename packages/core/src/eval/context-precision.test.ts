import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { contextPrecision } from "./context-precision.js";

function chunk(articleRef: string | null): RetrievedChunk {
  return {
    chunkId: `c-${articleRef ?? "null"}`,
    documentId: "d1",
    documentTitle: "Doc",
    sourceUrl: "https://example.org",
    articleRef,
    page: null,
    content: "content",
    vectorScore: 0.5,
    keywordScore: null,
    fusedScore: 0.5,
  };
}

describe("contextPrecision", () => {
  it("with no retrieved results, precision is 0", () => {
    expect(contextPrecision([], ["Article 5"])).toBe(0);
  });

  it("all chunks match the expected article: precision 1", () => {
    const retrieved = [chunk("Article 5 — Principles"), chunk("Article 5")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(1);
  });

  it("no chunk matches: precision 0", () => {
    const retrieved = [chunk("Article 17"), chunk("Article 33")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0);
  });

  it("partial match: proportional precision", () => {
    const retrieved = [chunk("Article 5"), chunk("Article 17"), chunk("Article 33"), chunk("Article 6")];
    expect(contextPrecision(retrieved, ["Article 5", "Article 6"])).toBe(0.5);
  });

  it("distinguishes Article 5 from Article 50/51 (a text prefix is not enough)", () => {
    const retrieved = [chunk("Article 50"), chunk("Article 51")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0);
  });

  it("out-of-corpus questions (empty expectedArticleRefs): any result counts as unexpected", () => {
    const retrieved = [chunk("Article 5"), chunk(null)];
    expect(contextPrecision(retrieved, [])).toBe(0);
  });

  it("ignores chunks without an articleRef when counting matches", () => {
    const retrieved = [chunk(null), chunk("Article 5")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0.5);
  });
});
