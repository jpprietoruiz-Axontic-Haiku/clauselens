import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./cost.js";

describe("estimateCostUsd", () => {
  it("calculates cost combining input and output tokens", () => {
    const cost = estimateCostUsd("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(3 + 15, 5);
  });

  it("treats undefined tokens as 0", () => {
    expect(estimateCostUsd("claude-sonnet-5", { inputTokens: undefined, outputTokens: undefined })).toBe(0);
  });

  it("uses a default rate for unknown models, instead of failing", () => {
    const cost = estimateCostUsd("a-made-up-model", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeGreaterThan(0);
  });

  it("is proportional to the amount of tokens", () => {
    const half = estimateCostUsd("claude-sonnet-5", { inputTokens: 500_000, outputTokens: 0 });
    const full = estimateCostUsd("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(full).toBeCloseTo(half * 2, 5);
  });
});
