import { describe, expect, it } from "vitest";
import { chunkSections, countTokens } from "./chunk.js";
import type { ParsedSection } from "./types.js";

function section(text: string, overrides: Partial<ParsedSection> = {}): ParsedSection {
  return { articleRef: "Article 1", page: null, text, ...overrides };
}

describe("countTokens", () => {
  it("counts more tokens for longer text", () => {
    expect(countTokens("hello")).toBeGreaterThan(0);
    expect(countTokens("hello world, this is a longer sentence")).toBeGreaterThan(countTokens("hello"));
  });

  it("empty text has zero tokens", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("chunkSections", () => {
  it("returns a single chunk when the text fits within maxTokens", () => {
    const sections = [section("A short paragraph that fits in a single chunk.")];
    const chunks = chunkSections(sections, { maxTokens: 400, overlapTokens: 60 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("A short paragraph that fits in a single chunk.");
    expect(chunks[0]?.articleRef).toBe("Article 1");
    expect(chunks[0]?.page).toBeNull();
    expect(chunks[0]?.tokenCount).toBe(countTokens("A short paragraph that fits in a single chunk."));
  });

  it("ignores sections with no text", () => {
    expect(chunkSections([section("")])).toEqual([]);
    expect(chunkSections([section("   \n\n  ")])).toEqual([]);
  });

  it("preserves articleRef and page from each section in its chunks", () => {
    const sections = [
      section("Content of article 1.", { articleRef: "Article 1", page: 3 }),
      section("Content of article 2.", { articleRef: "Article 2", page: 4 }),
    ];
    const chunks = chunkSections(sections, { maxTokens: 400, overlapTokens: 0 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ articleRef: "Article 1", page: 3 });
    expect(chunks[1]).toMatchObject({ articleRef: "Article 2", page: 4 });
  });

  it("splits a long text into several chunks respecting maxTokens", () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `This is paragraph number ${i} with enough text to add up real tokens.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    const chunks = chunkSections(sections, { maxTokens: 50, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(50);
    }
  });

  it("applies overlap: the start of a chunk reappears at the end of the previous one", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i}: filler regulatory content to force multiple chunks in the test.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    // Each paragraph is 15 tokens: with maxTokens=80 five fit per chunk, and
    // with overlapTokens=40 the overlap retains exactly 2 (30 <= 40 < 45).
    const chunks = chunkSections(sections, { maxTokens: 80, overlapTokens: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    const first = chunks[0];
    const second = chunks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error("expected at least two chunks");

    const firstParagraphs = first.content.split("\n\n");
    const lastParagraphOfFirst = firstParagraphs.at(-1);
    expect(lastParagraphOfFirst).toBeDefined();
    expect(second.content).toContain(lastParagraphOfFirst);
  });

  it("without overlapTokens, chunks share no content", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i}: filler regulatory content to force multiple chunks in the test.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    const chunks = chunkSections(sections, { maxTokens: 40, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(1);

    const allContent = chunks.map((c) => c.content).join("\n");
    // Each original paragraph must appear exactly once across all chunks.
    for (const paragraph of paragraphs) {
      const occurrences = allContent.split(paragraph).length - 1;
      expect(occurrences).toBe(1);
    }
  });

  it("splits a single paragraph that exceeds maxTokens by sentences", () => {
    const longParagraph = Array.from(
      { length: 15 },
      (_, i) => `This is sentence number ${i} inside a deliberately long paragraph.`,
    ).join(" ");
    const sections = [section(longParagraph)];

    const chunks = chunkSections(sections, { maxTokens: 30, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    // No text is lost: all original sentences are still present.
    expect(chunks.map((c) => c.content).join(" ")).toContain("sentence number 0");
    expect(chunks.map((c) => c.content).join(" ")).toContain("sentence number 14");
  });

  it("applies a hard cut by tokens when a single sentence exceeds maxTokens", () => {
    // A single "sentence" (no punctuation) far longer than maxTokens: the
    // sentence split can't divide it, so the hard token-window cut fallback
    // must kick in.
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const hugeSentence = words.join(" ");
    const sections = [section(hugeSentence)];

    const chunks = chunkSections(sections, { maxTokens: 30, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(30);
    }
    // No content is lost. The hard cut doesn't respect word boundaries, so
    // it's reconstructed by concatenating without added separators.
    const joined = chunks.map((c) => c.content).join("");
    expect(joined).toContain("word0 ");
    expect(joined).toContain("word199");
  });
});
