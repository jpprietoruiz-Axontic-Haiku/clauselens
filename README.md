# ClauseLens

> Asistente RAG de consulta normativa. Pregunta en lenguaje natural sobre un corpus
> regulatorio (EU AI Act, GDPR, ISO...) y recibe respuestas ancladas a las cláusulas
> exactas que las sustentan, con un panel de evaluación que demuestra que no alucina.

**Estado:** en construcción por hitos. Este README es un esqueleto — la versión final
(hero, diagrama de arquitectura, demo) llega en el Hito 6. Ver [DECISIONS.md](./DECISIONS.md)
para las decisiones de arquitectura clave (pendiente, Hito 6).

## Stack

- **Frontend / API:** Next.js 15 (App Router), TypeScript estricto, Tailwind + shadcn/ui,
  streaming con el Vercel AI SDK. Desplegado en Vercel.
- **Worker de ingesta:** Node + Hono, desplegado en Railway.
- **Base de datos:** Postgres + pgvector (target Neon), Drizzle ORM.
- **LLM:** capa de proveedor intercambiable (Anthropic / OpenAI por variable de entorno).

## Estructura del monorepo

```
apps/
  web/             Next.js — frontend + route handlers (/api/chat, /api/documents, /eval)
  ingest-worker/   Hono — pipeline de ingesta (parse, chunking, embeddings, upsert)
    corpus/        Corpus semilla: GDPR (HTML) y EU AI Act (PDF), extractos reales de EUR-Lex
packages/
  db/              Schema Drizzle + cliente Postgres, compartido por web e ingest-worker
docker-compose.yml Postgres + pgvector para desarrollo local
```

## Quickstart

```bash
cp .env.example .env          # rellena ANTHROPIC_API_KEY / OPENAI_API_KEY
npm install
npm run docker:up             # levanta Postgres+pgvector en local
npm run db:migrate
npm run db:seed                # ingiere el corpus semilla (GDPR + EU AI Act)
npm run dev:web                # http://localhost:3000
```

En otra terminal, para el worker de ingesta:

```bash
npm run dev:worker             # http://localhost:8787/healthz
```

## Scripts del monorepo

| Script | Qué hace |
| --- | --- |
| `npm run build` | build de `db` → `ingest-worker` → `web`, en ese orden |
| `npm run typecheck` | `tsc --noEmit` en cada workspace |
| `npm run lint` | ESLint en cada workspace |
| `npm run test` | tests unitarios/integración (Vitest) |
| `npm run db:generate` | genera una migración Drizzle a partir de `packages/db/src/schema.ts` |
| `npm run db:migrate` | aplica las migraciones pendientes |
| `npm run db:studio` | abre Drizzle Studio |
| `npm run db:seed` | parsea, chunkea, embebe e inserta el corpus semilla (`apps/ingest-worker/corpus/`) |

## Roadmap por hitos

- [x] **Hito 1** — Scaffolding del monorepo, schema Drizzle, docker-compose, CI.
- [x] **Hito 2** — Pipeline de ingesta (parse → chunking semántico → embeddings → pgvector).
- [ ] **Hito 3** — Retrieval híbrido + re-ranking, `POST /api/chat` con streaming y citas.
- [ ] **Hito 4** — Frontend de chat con streaming y citas clicables.
- [ ] **Hito 5** — Harness de eval (faithfulness, answer relevancy, context precision) + `/eval`.
- [ ] **Hito 6** — README final, diagrama de arquitectura, `DECISIONS.md`.

## Qué falta tras este hito

- El pipeline de ingesta (parse PDF/HTML → chunking semántico con solape → embeddings
  OpenAI → upsert en pgvector) está completo y probado contra el corpus real, pero
  **no se ha ejecutado de punta a punta contra Postgres** en esta máquina: no hay Docker
  instalado aquí, así que `db:seed` no se ha corrido de verdad (queda para cuando levantes
  el stack localmente o en CI/CD).
- El endpoint `POST /api/ingest` existe y está probado a nivel HTTP, pero su camino de
  persistencia en Postgres solo se verifica con un Postgres real (no con mocks) — pendiente
  de correr en un entorno con Docker.
- No hay endpoints de chat/retrieval todavía (Hito 3).
