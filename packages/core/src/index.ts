export { buildChatMessages, buildContextBlock, NO_BASIS_MESSAGE, type ChatMessage } from "./chat/build-prompt.js";
export { EMBEDDING_DIMENSIONS, createOpenAiEmbedder, embedOne, type Embedder } from "./embed.js";
export { loadCoreEnv, type CoreEnv } from "./env.js";
export { getChatModel } from "./llm/provider.js";
export { CONFIDENCE_THRESHOLD, hasSufficientBasis } from "./retrieval/confidence.js";
export { fuseRankings, hybridSearch, type HybridSearchOptions } from "./retrieval/hybrid.js";
export { keywordSearch, type KeywordHit } from "./retrieval/keyword-search.js";
export type { RetrievedChunk } from "./retrieval/types.js";
export { vectorSearch, type VectorHit } from "./retrieval/vector-search.js";
