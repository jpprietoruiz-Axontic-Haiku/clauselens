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
  db/              Schema Drizzle + cliente Postgres, compartido por el resto de paquetes
  core/            Retrieval híbrido (vector + léxico, RRF), umbral de confianza, proveedor
                   LLM intercambiable, construcción de prompt — compartido por web e ingest-worker
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
- [x] **Hito 3** — Retrieval híbrido + re-ranking, `POST /api/chat` con streaming y citas.
- [ ] **Hito 4** — Frontend de chat con streaming y citas clicables.
- [ ] **Hito 5** — Harness de eval (faithfulness, answer relevancy, context precision) + `/eval`.
- [ ] **Hito 6** — README final, diagrama de arquitectura, `DECISIONS.md`.

## Retrieval híbrido y umbral de confianza (Hito 3)

`POST /api/chat` (`apps/web/src/app/api/chat/route.ts`): recibe `{ conversationId?, message }`,
persiste el mensaje del usuario, embebe la pregunta y ejecuta retrieval híbrido antes de
decidir si responde:

1. **Vector search** — similitud coseno sobre `chunks.embedding` (índice HNSW).
2. **Keyword search** — `websearch_to_tsquery` sobre un índice GIN de expresión
   (`to_tsvector('english', content)`), sin necesidad de una columna `tsvector` aparte.
3. **Fusión (re-ranking)** — Reciprocal Rank Fusion (RRF) de ambas listas; no se normalizan
   los scores (coseno y `ts_rank` no son comparables), se fusiona por posición en el ranking.
4. **Umbral de confianza** — si la similitud coseno del mejor resultado vectorial cae por
   debajo de `CONFIDENCE_THRESHOLD` (`packages/core/src/retrieval/confidence.ts`), se responde
   con un mensaje fijo de "no tengo base suficiente" **sin llamar al LLM**, en vez de alucinar.
5. Si hay base suficiente, se arma el prompt con el contexto citado (`packages/core/src/chat/build-prompt.ts`)
   y se transmite la respuesta en streaming (Vercel AI SDK, `createUIMessageStream`), junto con
   un `data-citations` part con los chunks fuente (id, artículo, página) para que el Hito 4
   pueda renderizar citas clicables.

`GET /api/documents`: lista el corpus disponible.

La justificación completa de estas decisiones (por qué RRF y no un re-ranker aparte, por qué
0.35 de umbral, por qué estas métricas) se documenta en `DECISIONS.md` en el Hito 6.

## Qué falta tras este hito

- El retrieval híbrido tiene un test de integración contra Postgres real
  (`packages/core/src/retrieval/hybrid.integration.test.ts`, sin mocks) que corre en CI, pero
  **no se ha verificado en esta máquina**: hay un Postgres nativo (no Docker) ya escuchando en
  el puerto 5432 con credenciales que no coinciden con `docker-compose.yml`, así que no pude
  conectar. Antes de levantar `npm run docker:up` aquí, libera el puerto 5432 o cambia el
  mapeo de puertos.
- El pipeline de ingesta tampoco se ha corrido de punta a punta contra Postgres por el mismo
  motivo (`db:seed`, `POST /api/ingest`): quedan pendientes de un entorno con Docker limpio.
- No hay frontend todavía — `/api/chat` solo se ha probado con `curl`/tipado, no desde un
  cliente real (Hito 4).
