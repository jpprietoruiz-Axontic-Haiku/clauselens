import { describe, expect, it } from "vitest";
import { chunkSections, countTokens } from "./chunk.js";
import type { ParsedSection } from "./types.js";

function section(text: string, overrides: Partial<ParsedSection> = {}): ParsedSection {
  return { articleRef: "Article 1", page: null, text, ...overrides };
}

describe("countTokens", () => {
  it("cuenta más tokens para texto más largo", () => {
    expect(countTokens("hola")).toBeGreaterThan(0);
    expect(countTokens("hola mundo, esto es una frase más larga")).toBeGreaterThan(countTokens("hola"));
  });

  it("un texto vacío tiene cero tokens", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("chunkSections", () => {
  it("devuelve un solo chunk cuando el texto cabe dentro de maxTokens", () => {
    const sections = [section("Un párrafo corto que cabe en un solo chunk.")];
    const chunks = chunkSections(sections, { maxTokens: 400, overlapTokens: 60 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("Un párrafo corto que cabe en un solo chunk.");
    expect(chunks[0]?.articleRef).toBe("Article 1");
    expect(chunks[0]?.page).toBeNull();
    expect(chunks[0]?.tokenCount).toBe(countTokens("Un párrafo corto que cabe en un solo chunk."));
  });

  it("ignora secciones sin texto", () => {
    expect(chunkSections([section("")])).toEqual([]);
    expect(chunkSections([section("   \n\n  ")])).toEqual([]);
  });

  it("preserva articleRef y page de cada sección en sus chunks", () => {
    const sections = [
      section("Contenido del artículo 1.", { articleRef: "Article 1", page: 3 }),
      section("Contenido del artículo 2.", { articleRef: "Article 2", page: 4 }),
    ];
    const chunks = chunkSections(sections, { maxTokens: 400, overlapTokens: 0 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ articleRef: "Article 1", page: 3 });
    expect(chunks[1]).toMatchObject({ articleRef: "Article 2", page: 4 });
  });

  it("divide un texto largo en varios chunks respetando maxTokens", () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Este es el párrafo número ${i} con suficiente texto como para sumar tokens reales.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    const chunks = chunkSections(sections, { maxTokens: 50, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(50);
    }
  });

  it("aplica solape: el inicio de un chunk reaparece al final del anterior", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Párrafo ${i}: contenido normativo de relleno para forzar múltiples chunks en el test.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    // Cada párrafo tiene 26 tokens: con maxTokens=80 caben 3 por chunk, y
    // con overlapTokens=40 el solape retiene exactamente 1 (26 ≤ 40 < 52).
    const chunks = chunkSections(sections, { maxTokens: 80, overlapTokens: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    const first = chunks[0];
    const second = chunks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error("se esperaban al menos dos chunks");

    const firstParagraphs = first.content.split("\n\n");
    const lastParagraphOfFirst = firstParagraphs.at(-1);
    expect(lastParagraphOfFirst).toBeDefined();
    expect(second.content).toContain(lastParagraphOfFirst);
  });

  it("sin overlapTokens, los chunks no comparten contenido", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Párrafo ${i}: contenido normativo de relleno para forzar múltiples chunks en el test.`,
    );
    const sections = [section(paragraphs.join("\n\n"))];

    const chunks = chunkSections(sections, { maxTokens: 40, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(1);

    const allContent = chunks.map((c) => c.content).join("\n");
    // Cada párrafo original debe aparecer una sola vez en el conjunto de chunks.
    for (const paragraph of paragraphs) {
      const occurrences = allContent.split(paragraph).length - 1;
      expect(occurrences).toBe(1);
    }
  });

  it("divide un párrafo individual que excede maxTokens por frases", () => {
    const longParagraph = Array.from(
      { length: 15 },
      (_, i) => `Esta es la frase número ${i} dentro de un párrafo deliberadamente largo.`,
    ).join(" ");
    const sections = [section(longParagraph)];

    const chunks = chunkSections(sections, { maxTokens: 30, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    // No se pierde texto: todas las frases originales siguen presentes.
    expect(chunks.map((c) => c.content).join(" ")).toContain("frase número 0");
    expect(chunks.map((c) => c.content).join(" ")).toContain("frase número 14");
  });

  it("aplica un corte duro por tokens cuando una sola frase excede maxTokens", () => {
    // Una única "frase" (sin puntuación) de sobra más larga que maxTokens:
    // el split por frases no puede dividirla, así que debe entrar el
    // fallback de corte duro por ventanas de tokens.
    const words = Array.from({ length: 200 }, (_, i) => `palabra${i}`);
    const hugeSentence = words.join(" ");
    const sections = [section(hugeSentence)];

    const chunks = chunkSections(sections, { maxTokens: 30, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(30);
    }
    // No se pierde contenido. El corte duro no respeta límites de palabra,
    // así que se reconstruye concatenando sin separadores añadidos.
    const joined = chunks.map((c) => c.content).join("");
    expect(joined).toContain("palabra0 ");
    expect(joined).toContain("palabra199");
  });
});
