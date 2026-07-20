import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { CoreEnv } from "../env.js";

type ProviderEnv = Pick<CoreEnv, "LLM_PROVIDER" | "ANTHROPIC_API_KEY" | "ANTHROPIC_MODEL" | "OPENAI_MODEL"> & {
  OPENAI_API_KEY: string;
};

/** Capa de proveedor intercambiable: Anthropic u OpenAI según LLM_PROVIDER. */
export function getChatModel(env: ProviderEnv): LanguageModel {
  if (env.LLM_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY es obligatorio cuando LLM_PROVIDER=anthropic");
    }
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return anthropic(env.ANTHROPIC_MODEL);
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai(env.OPENAI_MODEL);
}
