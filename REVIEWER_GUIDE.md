# ClauseLens — 2-minute technical review

**What it demonstrates:** a regulatory retrieval-augmented generation (RAG) prototype that combines hybrid search, citations tied to source fragments and an evaluation harness. It is **not a deployed legal-advice product**.

## Review the implementation

| Area | Where to look |
| --- | --- |
| Retrieval, rank fusion and confidence checks | [Core retrieval package](packages/core/src/retrieval) |
| Evaluation harness | [Core evaluation package](packages/core/src/eval) |
| Data model and migrations | [Database package](packages/db) |
| Chat interface | [Next.js frontend](apps/web) |
| Ingestion pipeline | [Ingest worker](apps/ingest-worker) |
| Architectural trade-offs | [DECISIONS.md](DECISIONS.md) |
| CI | [GitHub Actions workflow](.github/workflows/ci.yml) |

## Engineering highlights

- Postgres with pgvector and full-text retrieval, combined through Reciprocal Rank Fusion (RRF).
- Source-linked citations and explicit fallback when a search lacks supporting evidence.
- Evaluation of context precision, faithfulness and answer relevance.
- A real PostgreSQL integration test for hybrid retrieval.
- Automated typechecking, linting, migrations, tests and builds in CI.

## Scope and limitations

The original database migration attempted an unsupported HNSW index on 3,072-dimensional pgvector values. The current review PR corrects this by retaining exact cosine search without that index. **This scales differently from indexed approximate search**, and should be revisited before a large corpus. The application has not been fully validated with live model credentials or deployed for public use. Evaluation results are not guarantees of legal accuracy.

**Author:** Juan Pablo Prieto, PhD · [GitHub profile](https://github.com/jpprietoruiz-Axontic-Haiku)
