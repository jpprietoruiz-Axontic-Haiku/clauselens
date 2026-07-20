export interface GoldenQuestion {
  id: string;
  question: string;
  idealAnswer: string;
  /** Números de artículo esperados (p. ej. "Article 5"); [] si se espera "no tengo base suficiente". */
  expectedArticleRefs: string[];
}

export interface EvalResult {
  questionId: string;
  question: string;
  answer: string;
  retrievedChunkIds: string[];
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  latencyMs: number;
  costUsd: number;
}
