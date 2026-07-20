import OpenAI from "openai";

// Debe coincidir con chunks.embedding (vector(3072)) en packages/db/src/schema.ts.
export const EMBEDDING_DIMENSIONS = 3072;

// Límite conservador de inputs por request (el límite real de la API es 2048).
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
              `El modelo de embeddings "${model}" devolvió ${item.embedding.length} dimensiones, ` +
                `se esperaban ${EMBEDDING_DIMENSIONS}. Si cambiaste EMBEDDING_MODEL hay que migrar ` +
                "la columna chunks.embedding.",
            );
          }
          results.push(item.embedding);
        }
      }

      return results;
    },
  };
}

/** Embebe un único texto (p. ej. la pregunta del usuario en /api/chat). */
export async function embedOne(embedder: Embedder, text: string): Promise<number[]> {
  const [embedding] = await embedder.embed([text]);
  if (!embedding) {
    throw new Error("El embedder no devolvió ningún vector.");
  }
  return embedding;
}
