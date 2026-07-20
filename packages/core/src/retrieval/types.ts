export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  articleRef: string | null;
  page: number | null;
  content: string;
  /** Cosine similarity (~0..1), null if the chunk didn't appear on the vector leg. */
  vectorScore: number | null;
  /** Postgres ts_rank, null if the chunk didn't appear on the lexical leg. */
  keywordScore: number | null;
  /** Reciprocal Rank Fusion of both legs; used to sort the final result. */
  fusedScore: number;
}
