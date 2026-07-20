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
    content: "contenido",
    vectorScore,
    keywordScore: null,
    fusedScore: 0.5,
  };
}

describe("hasSufficientBasis", () => {
  it("sin resultados, no hay base suficiente", () => {
    expect(hasSufficientBasis([])).toBe(false);
  });

  it("por debajo del umbral, no hay base suficiente", () => {
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD - 0.01)])).toBe(false);
  });

  it("en el umbral o por encima, hay base suficiente", () => {
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD)])).toBe(true);
    expect(hasSufficientBasis([chunkWith(CONFIDENCE_THRESHOLD + 0.1)])).toBe(true);
  });

  it("un chunk que solo vino de la pata léxica (vectorScore null) se trata como score 0", () => {
    expect(hasSufficientBasis([chunkWith(null)])).toBe(false);
  });

  it("solo mira el primer resultado (se asume orden por fusedScore descendente)", () => {
    const results = [chunkWith(0.9), chunkWith(0.01)];
    expect(hasSufficientBasis(results)).toBe(true);
  });
});
