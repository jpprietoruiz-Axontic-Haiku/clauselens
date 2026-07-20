import { createOpenAiEmbedder, getChatModel, loadCoreEnv, type CoreEnv, type Embedder } from "@clauselens/core";
import { createDb, loadDbEnv, type Database } from "@clauselens/db";
import type { LanguageModel } from "ai";

// Singletons perezosos a nivel de módulo: se construyen (y validan sus env
// vars) en la primera petición que los usa, no al cargar el módulo — así
// `next build` no falla si faltan claves de API que solo hacen falta en
// runtime.
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
