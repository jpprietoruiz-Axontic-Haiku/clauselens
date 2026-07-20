import OpenAI from "openai";

// Must match chunks.embedding (vector(3072)) in packages/db/src/schema.ts.
export const EMBEDDING_DIMENSIONS = 3072;

// Conservative limit on inputs per request (the real API limit is 2048).
const BATCH_SIZE = 96;

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export function createOpenAiEmbedder(apiKey: string, model: string): Embedder {
  const client = new OpenAI({ apiKey });

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
        const batch = texts.slice(offset, offset + BATCH_SIZE);
        const response = await client.embeddings.create({ model, input: batch });

        for (const item of response.data) {
          if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
              `The embedding model "${model}" returned ${item.embedding.length} dimensions, ` +
                `expected ${EMBEDDING_DIMENSIONS}. If you changed EMBEDDING_MODEL you need to migrate ` +
                "the chunks.embedding column.",
            );
          }
          results.push(item.embedding);
        }
      }

      return results;
    },
  };
}

/** Embeds a single piece of text (e.g. the user's question in /api/chat). */
export async function embedOne(embedder: Embedder, text: string): Promise<number[]> {
  const [embedding] = await embedder.embed([text]);
  if (!embedding) {
    throw new Error("The embedder did not return any vector.");
  }
  return embedding;
}
