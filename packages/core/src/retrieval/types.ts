export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  articleRef: string | null;
  page: number | null;
  content: string;
  /** Similitud coseno (0..1 aprox.), null si el chunk no apareció en la pata vectorial. */
  vectorScore: number | null;
  /** ts_rank de Postgres, null si el chunk no apareció en la pata léxica. */
  keywordScore: number | null;
  /** Reciprocal Rank Fusion de ambas patas; se usa para ordenar el resultado final. */
  fusedScore: number;
}
