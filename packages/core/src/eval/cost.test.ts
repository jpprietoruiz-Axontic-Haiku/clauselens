import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./cost.js";

describe("estimateCostUsd", () => {
  it("calcula el coste combinando tokens de entrada y salida", () => {
    const cost = estimateCostUsd("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(3 + 15, 5);
  });

  it("trata tokens undefined como 0", () => {
    expect(estimateCostUsd("claude-sonnet-5", { inputTokens: undefined, outputTokens: undefined })).toBe(0);
  });

  it("usa una tarifa por defecto para modelos desconocidos, en vez de fallar", () => {
    const cost = estimateCostUsd("un-modelo-inventado", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeGreaterThan(0);
  });

  it("es proporcional a la cantidad de tokens", () => {
    const half = estimateCostUsd("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    const full = estimateCostUsd("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(full).toBeCloseTo(half * 2, 5);
  });
});
