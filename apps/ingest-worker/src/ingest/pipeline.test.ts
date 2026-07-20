import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CHUNK_OPTIONS } from "./chunk.js";
import type { Embedder } from "./embed.js";
import { buildIngestion } from "./pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.resolve(__dirname, "../../corpus");
const MAX_CHUNK_TOKENS_WITH_OVERLAP = DEFAULT_CHUNK_OPTIONS.maxTokens + DEFAULT_CHUNK_OPTIONS.overlapTokens;

function fakeEmbedder(dimensions = 8): Embedder {
  return {
    embed: (texts: string[]) => Promise.resolve(texts.map((_, i) => Array.from({ length: dimensions }, () => i))),
  };
}

const SYNTHETIC_HTML = `
<html><body>
  <p class="oj-ti-art">Article 1</p>
  <p class="oj-normal">Cuerpo normativo de prueba para el artículo 1.</p>
  <p class="oj-ti-art">Article 2</p>
  <p class="oj-normal">Cuerpo normativo de prueba para el artículo 2.</p>
</body></html>
`;

describe("buildIngestion (con embedder falso, sin DB)", () => {
  it("produce un chunk por embedding y conserva los metadatos del documento", async () => {
    const built = await buildIngestion(fakeEmbedder(), {
      title: "Documento de prueba",
      sourceUrl: "https://example.org/doc",
      jurisdiction: "EU",
      version: "1.0",
      contentType: "html",
      content: SYNTHETIC_HTML,
    });

    expect(built.document).toEqual({
      title: "Documento de prueba",
      sourceUrl: "https://example.org/doc",
      jurisdiction: "EU",
      version: "1.0",
    });
    expect(built.chunks.length).toBeGreaterThan(0);
    for (const chunk of built.chunks) {
      expect(chunk.embedding).toHaveLength(8);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.content.length).toBeGreaterThan(0);
    }

    const articleRefs = new Set(built.chunks.map((c) => c.articleRef));
    expect(articleRefs.has("Article 1")).toBe(true);
    expect(articleRefs.has("Article 2")).toBe(true);
  });

  it("rechaza contenido del que no se puede extraer texto", async () => {
    await expect(
      buildIngestion(fakeEmbedder(), {
        title: "Vacío",
        sourceUrl: "https://example.org/empty",
        jurisdiction: "EU",
        version: "1.0",
        contentType: "html",
        content: "<html><body></body></html>",
      }),
    ).rejects.toThrow(/No se extrajo texto/);
  });
});

describe("buildIngestion (corpus real, smoke test end-to-end sin API/DB)", () => {
  it("procesa el GDPR real (HTML) de punta a punta", async () => {
    const html = await readFile(path.join(CORPUS_DIR, "gdpr.html"), "utf-8");
    const built = await buildIngestion(fakeEmbedder(), {
      title: "GDPR",
      sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679",
      jurisdiction: "EU",
      version: "2016/679",
      contentType: "html",
      content: html,
    });

    // El GDPR real produce ~245 chunks (99 artículos + preámbulo); se deja
    // margen en vez de fijar el número exacto para no ser frágiles ante
    // cambios menores de tokenización.
    expect(built.chunks.length).toBeGreaterThan(150);
    for (const chunk of built.chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
      // Cota de peor caso de chunkSections: maxTokens + overlapTokens
      // (el solape se antepone entero para no partir frases a mitad).
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS_WITH_OVERLAP);
      expect(chunk.embedding).toHaveLength(8);
    }
    const withArticle = built.chunks.filter((c) => c.articleRef?.startsWith("Article"));
    expect(withArticle.length).toBeGreaterThan(100);
  }, 30_000);

  it("procesa el EU AI Act real (PDF) de punta a punta", async () => {
    const buffer = await readFile(path.join(CORPUS_DIR, "eu-ai-act.pdf"));
    const built = await buildIngestion(fakeEmbedder(), {
      title: "EU AI Act",
      sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202401689",
      jurisdiction: "EU",
      version: "2024/1689",
      contentType: "pdf",
      content: new Uint8Array(buffer),
    });

    expect(built.chunks.length).toBeGreaterThan(100);
    const withPage = built.chunks.filter((c) => typeof c.page === "number");
    expect(withPage.length).toBe(built.chunks.length);
    for (const chunk of built.chunks) {
      // Cota de peor caso de chunkSections: maxTokens + overlapTokens
      // (el solape se antepone entero para no partir frases a mitad).
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS_WITH_OVERLAP);
    }
  }, 60_000);
});
