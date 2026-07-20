import { describe, expect, it } from "vitest";
import { CONFIDENCE_THRESHOLD, hasSufficientBasis } from "./confidence.js";
import type { RetrievedChunk } from "./types.js";

function chunkWith(vectorScore: number | null): RetrievedChunk {
  return {
    chunkId: "c1",
    documentId: "d1",
    documentTitle: "Doc",
    sourceUrl: "https://example.org",
    articleRef: null,
    page: null,
    content: "content",
    vectorScore,
    keywordScore: null,
    fusedScore: 0.5,
  };
}

describe("hasSufficientBasis", () => {
  it("with no results, there is no sufficient basis", () => {
    expect(hasSufficientBasis([])).toBe(false);
  });

  it("below the threshold, there is no sufficient basis", () => {
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD - 0.01)])).toBe(false);
  });

  it("at or above the threshold, there is sufficient basis", () => {
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD)])).toBe(true);
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD + 0.1)])).toBe(true);
  });

  it("a chunk that only came from the lexical leg (vectorScore null) is treated as score 0", () => {
    expect(hasSufficientBasis([chunkWith(null)])).toBe(false);
  });

  it("only looks at the first result (assumes descending fusedScore order)", () => {
    const results = [chunkWith(0.9), chunkWith(0.01)];
    expect(hasSufficientBasis(results)).toBe(true);
  });
});
