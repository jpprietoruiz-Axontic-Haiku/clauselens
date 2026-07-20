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
    content: "contenido",
    vectorScore: 0.5,
    keywordScore: null,
    fusedScore: 0.5,
  };
}

describe("contextPrecision", () => {
  it("sin resultados recuperados, precisión 0", () => {
    expect(contextPrecision([], ["Article 5"])).toBe(0);
  });

  it("todos los chunks coinciden con el artículo esperado: precisión 1", () => {
    const retrieved = [chunk("Article 5 — Principles"), chunk("Article 5")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(1);
  });

  it("ningún chunk coincide: precisión 0", () => {
    const retrieved = [chunk("Article 17"), chunk("Article 33")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0);
  });

  it("coincidencia parcial: precisión proporcional", () => {
    const retrieved = [chunk("Article 5"), chunk("Article 17"), chunk("Article 33"), chunk("Article 6")];
    expect(contextPrecision(retrieved, ["Article 5", "Article 6"])).toBe(0.5);
  });

  it("distingue Article 5 de Article 50/51 (no basta con un prefijo de texto)", () => {
    const retrieved = [chunk("Article 50"), chunk("Article 51")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0);
  });

  it("preguntas fuera de corpus (expectedArticleRefs vacío): cualquier resultado cuenta como no esperado", () => {
    const retrieved = [chunk("Article 5"), chunk(null)];
    expect(contextPrecision(retrieved, [])).toBe(0);
  });

  it("ignora chunks sin articleRef al calcular coincidencias", () => {
    const retrieved = [chunk(null), chunk("Article 5")];
    expect(contextPrecision(retrieved, ["Article 5"])).toBe(0.5);
  });
});
