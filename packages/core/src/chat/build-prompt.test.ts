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
    content: "Los datos personales se tratarán de forma lícita.",
    vectorScore: 0.8,
    keywordScore: null,
    fusedScore: 0.5,
    ...overrides,
  };
}

describe("buildContextBlock", () => {
  it("numera los fragmentos y conserva el orden recibido", () => {
    const block = buildContextBlock([chunk({ chunkId: "a" }), chunk({ chunkId: "b", articleRef: "Article 6" })]);
    expect(block).toContain("[1]");
    expect(block).toContain("[2]");
    expect(block.indexOf("[1]")).toBeLessThan(block.indexOf("[2]"));
  });

  it("incluye el título del documento, el artículo y la página cuando existe", () => {
    const block = buildContextBlock([chunk({ page: 12 })]);
    expect(block).toContain("GDPR");
    expect(block).toContain("Article 5");
    expect(block).toContain("p. 12");
  });

  it("omite la página cuando es null", () => {
    const block = buildContextBlock([chunk({ page: null })]);
    expect(block).not.toContain("p. null");
  });
});

describe("buildChatMessages", () => {
  it("antepone un mensaje system y coloca la pregunta tras el contexto", () => {
    const messages = buildChatMessages("¿Qué dice el artículo 5?", [chunk()]);

    expect(messages[0]).toMatchObject({ role: "system" });
    const userMessage = messages[1];
    expect(userMessage).toBeDefined();
    expect(userMessage?.role).toBe("user");
    expect(userMessage?.content).toContain("¿Qué dice el artículo 5?");
    expect(userMessage?.content).toContain("CONTEXTO");
  });

  it("instruye al modelo a citar y a no inventar", () => {
    const [system] = buildChatMessages("pregunta", [chunk()]);
    expect(system?.content).toMatch(/cita/i);
    expect(system?.content).toMatch(/no uses conocimiento externo/i);
  });
});
