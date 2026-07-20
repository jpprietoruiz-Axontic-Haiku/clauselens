import { chunks, documents, type Database } from "@clauselens/db";
import { desc, eq, sql } from "drizzle-orm";

export interface KeywordHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  articleRef: string | null;
  page: number | null;
  content: string;
  /** ts_rank de Postgres: mayor es más relevante, sin cota superior fija. */
  rank: number;
}

// Reutiliza el índice GIN de expresión definido en chunks_content_fts_idx
// (packages/db/src/schema.ts). websearch_to_tsquery tolera entrada libre de
// usuario sin lanzar error de sintaxis, a diferencia de to_tsquery.
export async function keywordSearch(db: Database, queryText: string, limit: number): Promise<KeywordHit[]> {
  const tsQuery = sql`websearch_to_tsquery('english', ${queryText})`;
  const rank = sql<number>`ts_rank(to_tsvector('english', ${chunks.content}), ${tsQuery})`;

  return db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      documentTitle: documents.title,
      sourceUrl: documents.sourceUrl,
      articleRef: chunks.articleRef,
      page: chunks.page,
      content: chunks.content,
      rank,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(sql`to_tsvector('english', ${chunks.content}) @@ ${tsQuery}`)
    .orderBy(desc(rank))
    .limit(limit);
}
