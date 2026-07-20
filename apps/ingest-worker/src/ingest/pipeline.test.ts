import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CHUNK_OPTIONS } from "./chunk.js";
import type { Embedder } from "@clauselens/core";
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
  <p class="oj-normal">Test regulatory body for article 1.</p>
  <p class="oj-ti-art">Article 2</p>
  <p class="oj-normal">Test regulatory body for article 2.</p>
</body></html>
`;

describe("buildIngestion (with a fake embedder, no DB)", () => {
  it("produces one chunk per embedding and preserves the document metadata", async () => {
    const built = await buildIngestion(fakeEmbedder(), {
      title: "Test document",
      sourceUrl: "https://example.org/doc",
      jurisdiction: "EU",
      version: "1.0",
      contentType: "html",
      content: SYNTHETIC_HTML,
    });

    expect(built.document).toEqual({
      title: "Test document",
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

  it("rejects content from which no text can be extracted", async () => {
    await expect(
      buildIngestion(fakeEmbedder(), {
        title: "Empty",
        sourceUrl: "https://example.org/empty",
        jurisdiction: "EU",
        version: "1.0",
        contentType: "html",
        content: "<html><body></body></html>",
      }),
    ).rejects.toThrow(/No text was extracted/);
  });
});

describe("buildIngestion (real corpus, end-to-end smoke test without API/DB)", () => {
  it("processes the real GDPR (HTML) end to end", async () => {
    const html = await readFile(path.join(CORPUS_DIR, "gdpr.html"), "utf-8");
    const built = await buildIngestion(fakeEmbedder(), {
      title: "GDPR",
      sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679",
      jurisdiction: "EU",
      version: "2016/679",
      contentType: "html",
      content: html,
    });

    // The real GDPR produces ~245 chunks (99 articles + preamble); a margin
    // is left instead of pinning the exact number, to avoid being fragile
    // against minor tokenization changes.
    expect(built.chunks.length).toBeGreaterThan(150);
    for (const chunk of built.chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
      // Worst-case bound of chunkSections: maxTokens + overlapTokens (the
      // overlap is prepended whole so as not to cut sentences in half).
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS_WITH_OVERLAP);
      expect(chunk.embedding).toHaveLength(8);
    }
    const withArticle = built.chunks.filter((c) => c.articleRef?.startsWith("Article"));
    expect(withArticle.length).toBeGreaterThan(100);
  }, 30_000);

  it("processes the real EU AI Act (PDF) end to end", async () => {
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
      // Worst-case bound of chunkSections: maxTokens + overlapTokens (the
      // overlap is prepended whole so as not to cut sentences in half).
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS_WITH_OVERLAP);
    }
  }, 60_000);
});
