import { chunks, documents, type Database } from "@clauselens/db";
import { cosineDistance, desc, eq, sql } from "drizzle-orm";

export interface VectorHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  articleRef: string | null;
  page: number | null;
  content: string;
  /** 1 - distancia coseno: 1 es idéntico, valores bajos/negativos son poco relacionados. */
  similarity: number;
}

export async function vectorSearch(db: Database, queryEmbedding: number[], limit: number): Promise<VectorHit[]> {
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;

  return db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      documentTitle: documents.title,
      sourceUrl: documents.sourceUrl,
      articleRef: chunks.articleRef,
      page: chunks.page,
      content: chunks.content,
      similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy(desc(similarity))
    .limit(limit);
}
