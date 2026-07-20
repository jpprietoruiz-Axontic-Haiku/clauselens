export interface GoldenQuestion {
  id: string;
  question: string;
  idealAnswer: string;
  /** Expected article numbers (e.g. "Article 5"); [] if "not enough basis" is expected. */
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
