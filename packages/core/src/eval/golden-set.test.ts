import { describe, expect, it } from "vitest";
import { loadGoldenSet } from "./golden-set.js";

describe("loadGoldenSet", () => {
  it("loads a non-empty golden set with the expected shape", () => {
    const goldenSet = loadGoldenSet();

    expect(goldenSet.length).toBeGreaterThanOrEqual(8);

    const ids = new Set(goldenSet.map((q) => q.id));
    expect(ids.size).toBe(goldenSet.length); // unique ids

    for (const question of goldenSet) {
      expect(question.question.length).toBeGreaterThan(0);
      expect(question.idealAnswer.length).toBeGreaterThan(0);
      expect(Array.isArray(question.expectedArticleRefs)).toBe(true);
    }
  });

  it("includes at least one question meant to trigger the 'not enough basis' threshold", () => {
    const goldenSet = loadGoldenSet();
    const outOfCorpus = goldenSet.filter((q) => q.expectedArticleRefs.length === 0);
    expect(outOfCorpus.length).toBeGreaterThan(0);
  });

  it("includes questions from both documents in the seed corpus", () => {
    const goldenSet = loadGoldenSet();
    const allText = goldenSet.map((q) => `${q.question} ${q.idealAnswer}`).join(" ");
    expect(allText).toMatch(/GDPR/);
    expect(allText).toMatch(/AI Act/);
  });
});
