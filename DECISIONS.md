# Architecture decisions

This document captures ClauseLens's non-obvious decisions and their justification. It isn't an
exhaustive record of every line of code — it's what a reviewer would need to know to understand
*why* it's built this way, not just *what* it does.

## Retrieval

### Why hybrid (vector + lexical) and not just vector similarity

Embeddings capture semantic meaning, but they systematically fail in two cases that are very
common in a regulatory assistant:

- **Exact terms and legal references**: if someone literally asks "what does article 17 say?",
  an embedding might place that question near articles *thematically* related to the right to
  erasure without necessarily prioritizing the chunk that contains exactly "Article 17" in its
  title.
- **Rare vocabulary or acronyms**: general-purpose embeddings don't always distinguish highly
  domain-specific legal terms well.

Lexical search (`websearch_to_tsquery` over a GIN expression index, with no need for a
materialized `tsvector` column) covers exactly these cases. Neither leg is sufficient on its
own, which is why they're combined.

### Why Reciprocal Rank Fusion (RRF) instead of normalizing and summing scores

Cosine similarity lives in a bounded, interpretable range (~[-1, 1], in practice close to [0, 1]
with normalized embeddings). Postgres's `ts_rank` has no fixed or comparable scale: two
different corpora, or even two different queries over the same corpus, can produce completely
different `ts_rank` ranges. Normalizing and summing these two heterogeneous magnitudes would
produce an arbitrary fusion that depends on implementation details of each search engine.

RRF (`score = Σ 1 / (k + rank)`, with `k = 60`, the standard value from the literature) solves
this by ignoring each score's absolute value and using only its *position* in each ranking. It's
robust to scale differences between the two legs, it's deterministic, it requires no training or
calibration, and it's the technique the RAG community itself usually calls "re-ranking" when no
dedicated re-ranking model is introduced (see below).

### Why not a dedicated re-ranker (e.g. Cohere Rerank, cross-encoder)

A purpose-built re-ranker (a cross-encoder model that scores each question-fragment pair)
usually gives better results than plain RRF, but it introduces an extra network call per query,
one more provider dependency, and added cost — all for a two-document seed corpus where the
margin of improvement is marginal. RRF over vector+lexical already covers the two relevant
failure modes at this scope. If the corpus grew to dozens of documents, a dedicated re-ranker
would be the first piece to add.

### Why the confidence threshold looks at the top result's cosine similarity, not `fusedScore`

`fusedScore` is a sum of RRF contributions: its magnitude depends on how many legs a chunk
appeared on and at what position, not on "how semantically related it is to the question". It
has no absolute interpretation — there's no "0.5 fusedScore" that means the same thing across
two different queries.

The top result's cosine similarity *is* interpretable: 1 is identical, low or negative values
mean not even the best candidate is semantically close to the question. That's why the threshold
(`CONFIDENCE_THRESHOLD = 0.35`, `packages/core/src/retrieval/confidence.ts`) is applied there.
It's a conservative value chosen by manual inspection with `text-embedding-3-large` over the
seed corpus, not statistically calibrated against a large validation set — with a corpus of only
two documents, calibrating an "optimal" threshold would mean overfitting to noise. If the corpus
grew, this value should be revisited with a broader set of negative questions than the two
included in the current golden set.

When the threshold isn't met, the system **doesn't call the LLM at all**: it answers with a
fixed message. This avoids both hallucination and the cost of a call that would almost certainly
produce an answer with no real grounding.

## Data schema and storage

### Why Postgres + pgvector and not a dedicated vector database

A single Postgres hosts vector search (pgvector, HNSW index), full-text search (native GIN
index) and relational data (documents, conversations, eval results) in the same transactions.
For this project's volume (a two-document seed corpus, a few hundred chunks), a dedicated vector
database (Pinecone, Weaviate...) would add one more piece of infrastructure, another provider to
manage and sync, with no appreciable performance advantage at this scale. Neon (serverless
Postgres with native pgvector) lets this be deployed with zero self-managed infrastructure.

### Why Drizzle ORM

End-to-end typing from the TypeScript schema through to SQL queries, without generating a
separate client (unlike Prisma) and without losing the ability to write raw SQL when needed
(rank fusion and the full-text search GIN expression rely on Drizzle's `sql\`...\``).
Migrations are plain, versioned, readable SQL, not an opaque abstraction layer.

### Why `chunks.embedding` is fixed to 3072 dimensions

OpenAI's `text-embedding-3-large` produces 3072-dimension vectors. This is a decision with a
real cost to change: the schema column, the HNSW index, and the entire already-ingested corpus
depend on that exact dimension. Switching embedding models means a full migration and
re-ingestion, not just changing an environment variable — documented as such in `.env.example`
and in the schema itself.

## Generation and LLM provider

### Why a swappable provider layer (Anthropic / OpenAI)

The Vercel AI SDK unifies the `streamText`/`generateText` interface across providers: switching
models is an environment variable (`LLM_PROVIDER`), not a code change
(`packages/core/src/llm/provider.ts`). This demonstrates a real production capability (not
depending on a single provider) and makes it easy to compare cost/quality across models without
touching business logic.

### Why embeddings are fixed to OpenAI even when `LLM_PROVIDER=anthropic`

Anthropic doesn't offer an embeddings API. The swappable provider layer covers the *chat* model;
embeddings are a separate, deliberately non-swappable dependency, documented as such
(`OPENAI_API_KEY` is required regardless of the chosen chat provider).

## Evaluation harness

### Why these three metrics (faithfulness, answer relevancy, context precision)

Each isolates a different failure mode of a RAG system, and together they cover the whole
pipeline:

- **Faithfulness** — did the *generation* step make up something that isn't in the context?
  This is the anti-hallucination metric par excellence.
- **Answer relevancy** — even if faithful to the context, did the generation step actually
  answer what was asked? An answer can be 100% faithful to the context and still be evasive or
  tangential.
- **Context precision** — did the *retrieval* step fetch the correct fragments? If this metric
  is low, the problem is upstream of the LLM, and neither faithfulness nor answer relevancy will
  reveal it on their own.

This is the same breakdown popularized by RAGAS, without adopting the full library: the harness
here is custom and deliberately small.

### Why LLM-as-judge for two metrics and a heuristic for the third

Determining whether a natural-language claim is "backed by the context", or whether an answer
"addresses the question", requires semantic understanding — there's no cheap heuristic that does
this well, so faithfulness and answer relevancy use an LLM judge (`generateText` +
`Output.object` with a Zod schema to force a structured `{ score, reasoning }` output).

Context precision, on the other hand, can be computed deterministically and for free by
comparing each retrieved chunk's article number against the articles the golden set expects
(`packages/core/src/eval/context-precision.ts`). Using an LLM there would be slower and more
expensive without adding signal, since the golden set already annotates the correct answer.

### Why the judge uses the same model that generates the answers

Simplicity and cost: a single configured provider is enough to run the whole harness. The known
downside is the "the model judges itself" bias (it tends to score itself better than an
independent judge would). `RunEvalDeps.judgeModel` is kept separate from `chatModel` precisely
so that pointing the judge at a different provider is a one-line change, not a redesign, the day
that bias needs to be removed.

### Why the golden set includes questions deliberately outside the corpus

Two of the golden set's ten questions have no answer in the corpus (GDPR + EU AI Act) on
purpose. Without them, the harness would only measure "does it answer well when there's
context?" and never "does it know when it doesn't know?" — which is precisely the property that
distinguishes this system from a RAG that hallucinates with confidence. `context-precision.ts`
handles these cases correctly: any chunk retrieved for a question with no expected articles
counts as "not relevant", so a retrieval that returns noise for an unanswerable question is
penalized too.

## What was left out of scope (and why)

- **Authentication and multi-tenancy**: the corpus is 100% public and the goal is to demonstrate
  the RAG pipeline, not a multi-user product.
- **Dedicated re-ranker**: see above — RRF covers the current scope with no extra cost or
  dependency.
- **Real-time verified citation streaming** (validating each `[n]` marker against the context as
  it's generated, not only at the end): would add per-token latency in exchange for a guarantee
  the eval harness's faithfulness metric already measures in aggregate.
- **Corpus beyond GDPR and the EU AI Act**: the seed corpus's goal is to demonstrate the full
  pipeline (both HTML parsing and PDF parsing exercised) with real data, not to maximize
  regulatory coverage.
