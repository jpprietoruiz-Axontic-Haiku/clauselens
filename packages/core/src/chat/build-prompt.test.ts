import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../retrieval/types.js";
import { buildChatMessages, buildContextBlock } from "./build-prompt.js";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "c1",
    documentId: "d1",
    documentTitle: "GDPR",
    sourceUrl: "https://example.org/gdpr",
    articleRef: "Article 5",
    page: null,
    content: "Personal data shall be processed lawfully.",
    vectorScore: 0.8,
    keywordScore: null,
    fusedScore: 0.5,
    ...overrides,
  };
}

describe("buildContextBlock", () => {
  it("numbers the fragments and keeps the received order", () => {
    const block = buildContextBlock([chunk({ chunkId: "a" }), chunk({ chunkId: "b", articleRef: "Article 6" })]);
    expect(block).toContain("[1]");
    expect(block).toContain("[2]");
    expect(block.indexOf("[1]")).toBeLessThan(block.indexOf("[2]"));
  });

  it("includes the document title, the article and the page when present", () => {
    const block = buildContextBlock([chunk({ page: 12 })]);
    expect(block).toContain("GDPR");
    expect(block).toContain("Article 5");
    expect(block).toContain("p. 12");
  });

  it("omits the page when it is null", () => {
    const block = buildContextBlock([chunk({ page: null })]);
    expect(block).not.toContain("p. null");
  });
});

describe("buildChatMessages", () => {
  it("prepends a system message and places the question after the context", () => {
    const messages = buildChatMessages("What does article 5 say?", [chunk()]);

    expect(messages[0]).toMatchObject({ role: "system" });
    const userMessage = messages[1];
    expect(userMessage).toBeDefined();
    expect(userMessage?.role).toBe("user");
    expect(userMessage?.content).toContain("What does article 5 say?");
    expect(userMessage?.content).toContain("CONTEXT");
  });

  it("instructs the model to cite and not to make things up", () => {
    const [system] = buildChatMessages("question", [chunk()]);
    expect(system?.content).toMatch(/citation/i);
    expect(system?.content).toMatch(/do not use outside knowledge/i);
  });
});
