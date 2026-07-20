import type { Database } from "@clauselens/db";
import { keywordSearch, type KeywordHit } from "./keyword-search.js";
import type { RetrievedChunk } from "./types.js";
import { vectorSearch, type VectorHit } from "./vector-search.js";

// Standard Reciprocal Rank Fusion constant: dampens the influence of top
// positions so that a top-1 on a single leg doesn't completely dominate
// over solid matches on both legs.
const RRF_K = 60;
const CANDIDATE_POOL_SIZE = 20;
const DEFAULT_TOP_K = 5;

export interface HybridSearchOptions {
  topK?: number;
  candidatePoolSize?: number;
}

function toRetrievedChunk(
  hit: VectorHit | KeywordHit,
  overrides: Pick<RetrievedChunk, "vectorScore" | "keywordScore" | "fusedScore">,
): RetrievedChunk {
  return {
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    documentTitle: hit.documentTitle,
    sourceUrl: hit.sourceUrl,
    articleRef: hit.articleRef,
    page: hit.page,
    content: hit.content,
    ...overrides,
  };
}

/**
 * Combines two rankings (vector + lexical) via Reciprocal Rank Fusion. Pure
 * function: it doesn't touch the database, so it can be tested with
 * synthetic lists without depending on Postgres.
 */
export function fuseRankings(vectorHits: VectorHit[], keywordHits: KeywordHit[], topK: number): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();

  vectorHits.forEach((hit, rank) => {
    byId.set(
      hit.chunkId,
      toRetrievedChunk(hit, {
        vectorScore: hit.similarity,
        keywordScore: null,
        fusedScore: 1 / (RRF_K + rank + 1),
      }),
    );
  });

  keywordHits.forEach((hit, rank) => {
    const rrfContribution = 1 / (RRF_K + rank + 1);
    const existing = byId.get(hit.chunkId);
    if (existing) {
      existing.keywordScore = hit.rank;
      existing.fusedScore += rrfContribution;
    } else {
      byId.set(
        hit.chunkId,
        toRetrievedChunk(hit, {
          vectorScore: null,
          keywordScore: hit.rank,
          fusedScore: rrfContribution,
        }),
      );
    }
  });

  return [...byId.values()].sort((a, b) => b.fusedScore - a.fusedScore).slice(0, topK);
}

export async function hybridSearch(
  db: Database,
  queryEmbedding: number[],
  queryText: string,
  options: HybridSearchOptions = {},
): Promise<RetrievedChunk[]> {
  const candidatePoolSize = options.candidatePoolSize ?? CANDIDATE_POOL_SIZE;
  const topK = options.topK ?? DEFAULT_TOP_K;

  const [vectorHits, keywordHits] = await Promise.all([
    vectorSearch(db, queryEmbedding, candidatePoolSize),
    keywordSearch(db, queryText, candidatePoolSize),
  ]);

  return fuseRankings(vectorHits, keywordHits, topK);
}
