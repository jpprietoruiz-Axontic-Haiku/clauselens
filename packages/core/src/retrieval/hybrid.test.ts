import { describe, expect, it } from "vitest";
import { fuseRankings } from "./hybrid.js";
import type { KeywordHit } from "./keyword-search.js";
import type { VectorHit } from "./vector-search.js";

function hit<T extends VectorHit | KeywordHit>(chunkId: string, extra: Partial<T> = {}): T {
  return {
    chunkId,
    documentId: "doc-1",
    documentTitle: "Documento de prueba",
    sourceUrl: "https://example.org/doc",
    articleRef: `Article ${chunkId}`,
    page: null,
    content: `Contenido de ${chunkId}`,
    ...extra,
  } as T;
}

describe("fuseRankings", () => {
  it("prioriza un chunk que aparece en ambas patas sobre uno que solo aparece en una", () => {
    const vectorHits: VectorHit[] = [
      hit<VectorHit>("a", { similarity: 0.9 }),
      hit<VectorHit>("b", { similarity: 0.8 }),
    ];
    const keywordHits: KeywordHit[] = [hit<KeywordHit>("b", { rank: 0.5 }), hit<KeywordHit>("c", { rank: 0.4 })];

    const fused = fuseRankings(vectorHits, keywordHits, 10);

    expect(fused[0]?.chunkId).toBe("b");
    expect(fused[0]?.vectorScore).toBe(0.8);
    expect(fused[0]?.keywordScore).toBe(0.5);
  });

  it("conserva chunks que solo aparecen en una pata, con el score de la otra en null", () => {
    const vectorHits: VectorHit[] = [hit<VectorHit>("solo-vector", { similarity: 0.7 })];
    const keywordHits: KeywordHit[] = [hit<KeywordHit>("solo-keyword", { rank: 0.3 })];

    const fused = fuseRankings(vectorHits, keywordHits, 10);
    const byId = new Map(fused.map((c) => [c.chunkId, c]));

    expect(byId.get("solo-vector")).toMatchObject({ vectorScore: 0.7, keywordScore: null });
    expect(byId.get("solo-keyword")).toMatchObject({ vectorScore: null, keywordScore: 0.3 });
  });

  it("respeta topK", () => {
    const vectorHits: VectorHit[] = ["a", "b", "c", "d"].map((id) => hit<VectorHit>(id, { similarity: 0.5 }));
    const fused = fuseRankings(vectorHits, [], 2);
    expect(fused).toHaveLength(2);
  });

  it("sin resultados en ninguna pata, devuelve una lista vacía", () => {
    expect(fuseRankings([], [], 5)).toEqual([]);
  });

  it("el orden de la pata vectorial influye en el score (posiciones más altas puntúan más)", () => {
    const vectorHits: VectorHit[] = [hit<VectorHit>("first", { similarity: 0.6 }), hit<VectorHit>("second", { similarity: 0.6 })];
    const fused = fuseRankings(vectorHits, [], 10);
    const first = fused.find((c) => c.chunkId === "first");
    const second = fused.find((c) => c.chunkId === "second");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.fusedScore).toBeGreaterThan(second?.fusedScore ?? Number.POSITIVE_INFINITY);
  });
});
