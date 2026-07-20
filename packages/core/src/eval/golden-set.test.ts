import { describe, expect, it } from "vitest";
import { loadGoldenSet } from "./golden-set.js";

describe("loadGoldenSet", () => {
  it("carga un golden set no vacío con la forma esperada", () => {
    const goldenSet = loadGoldenSet();

    expect(goldenSet.length).toBeGreaterThanOrEqual(8);

    const ids = new Set(goldenSet.map((q) => q.id));
    expect(ids.size).toBe(goldenSet.length); // ids únicos

    for (const question of goldenSet) {
      expect(question.question.length).toBeGreaterThan(0);
      expect(question.idealAnswer.length).toBeGreaterThan(0);
      expect(Array.isArray(question.expectedArticleRefs)).toBe(true);
    }
  });

  it("incluye al menos una pregunta pensada para disparar el umbral de 'no tengo base suficiente'", () => {
    const goldenSet = loadGoldenSet();
    const outOfCorpus = goldenSet.filter((q) => q.expectedArticleRefs.length === 0);
    expect(outOfCorpus.length).toBeGreaterThan(0);
  });

  it("incluye preguntas de ambos documentos del corpus semilla", () => {
    const goldenSet = loadGoldenSet();
    const allText = goldenSet.map((q) => `${q.question} ${q.idealAnswer}`).join(" ");
    expect(allText).toMatch(/GDPR/);
    expect(allText).toMatch(/AI Act/);
  });
});
