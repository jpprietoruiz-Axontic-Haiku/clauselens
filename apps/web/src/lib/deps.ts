import { createOpenAiEmbedder, getChatModel, loadCoreEnv, type CoreEnv, type Embedder } from "@clauselens/core";
import { createDb, loadDbEnv, type Database } from "@clauselens/db";
import type { LanguageModel } from "ai";

// Lazy module-level singletons: they're built (and validate their env vars)
// on the first request that uses them, not when the module loads — so
// `next build` doesn't fail if API keys that are only needed at runtime
// are missing.
let dbInstance: Database | undefined;
let embedderInstance: Embedder | undefined;
let chatModelInstance: LanguageModel | undefined;
let coreEnvInstance: CoreEnv | undefined;

function getCoreEnv(): CoreEnv {
  coreEnvInstance ??= loadCoreEnv();
  return coreEnvInstance;
}

export function getDb(): Database {
  if (!dbInstance) {
    const { DATABASE_URL } = loadDbEnv();
    dbInstance = createDb(DATABASE_URL);
  }
  return dbInstance;
}

export function getEmbedder(): Embedder {
  embedderInstance ??= createOpenAiEmbedder(getCoreEnv().OPENAI_API_KEY, getCoreEnv().EMBEDDING_MODEL);
  return embedderInstance;
}

export function getChatModelInstance(): LanguageModel {
  chatModelInstance ??= getChatModel(getCoreEnv());
  return chatModelInstance;
}
