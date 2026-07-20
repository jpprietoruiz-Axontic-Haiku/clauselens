// Precios aproximados en USD por millón de tokens (input/output), a fecha de
// escritura. Solo se usan para dar una cifra orientativa en el dashboard de
// eval, no para facturación real — si el proveedor cambia precios o el
// modelo no está en esta tabla, se usa una tarifa por defecto conservadora.
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "gpt-5": { input: 1.25, output: 10 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

export interface TokenUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

export function estimateCostUsd(modelId: string, usage: TokenUsage): number {
  const pricing = PRICING_PER_MILLION_TOKENS[modelId] ?? DEFAULT_PRICING;
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * pricing.input;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
