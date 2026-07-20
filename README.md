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
| `npm run eval` | corre el golden set completo, guarda scores en `eval_runs`/`eval_results` |

## Roadmap por hitos

- [x] **Hito 1** — Scaffolding del monorepo, schema Drizzle, docker-compose, CI.
- [x] **Hito 2** — Pipeline de ingesta (parse → chunking semántico → embeddings → pgvector).
- [x] **Hito 3** — Retrieval híbrido + re-ranking, `POST /api/chat` con streaming y citas.
- [x] **Hito 4** — Frontend de chat con streaming y citas clicables.
- [x] **Hito 5** — Harness de eval (faithfulness, answer relevancy, context precision) + `/eval`.
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

## Frontend de chat (Hito 4)

`apps/web/src/components/chat/chat.tsx` (`"use client"`), sobre `useChat` del AI SDK
(`@ai-sdk/react`) con un `DefaultChatTransport` cuyo `prepareSendMessagesRequest` adapta el
payload por defecto al contrato simple de `/api/chat` (`{ conversationId?, message }`).

- **Estados de carga**: `status === "submitted"` → "Buscando en el corpus…";
  `status === "streaming"` → "Redactando…" (el `data-citations` part llega antes de que
  empiece el texto, así que para cuando el estado pasa a streaming las citas ya están listas).
- **Citas clicables**: el prompt le pide al modelo citar con marcadores `[n]` inline. `AnswerText`
  parte el texto acumulado por esos marcadores en cada render — funciona igual de bien a mitad
  de streaming — y los convierte en botones que abren un diálogo (`CitationDialog`) con el
  fragmento fuente completo (documento, artículo, página, contenido, enlace a EUR-Lex).
- **Tipado de punta a punta**: `ClauseLensUIMessage` (`apps/web/src/lib/chat-types.ts`)
  parametriza tanto `createUIMessageStream` (servidor) como `useChat` (cliente), así que los
  `data-conversation`/`data-citations` parts están tipados sin *casts* a ambos lados.
- El endpoint ahora envuelve la preparación (crear conversación, guardar el mensaje, embeber,
  recuperar) en un `try/catch` que devuelve JSON con status explícito — un 500 HTML sin
  manejar dejaba al cliente colgado en "Buscando en el corpus…" para siempre, según se
  comprobó en el navegador.

## Harness de eval (Hito 5)

Golden set de 10 preguntas (`packages/core/src/eval/golden-set.json`, 8 sobre el corpus real —
GDPR y EU AI Act — y 2 deliberadamente fuera de corpus) con la respuesta ideal y los artículos
que se espera recuperar. `npm run eval` (`apps/ingest-worker/src/scripts/eval.ts`) corre cada
pregunta contra el mismo pipeline que `/api/chat` (retrieval híbrido → umbral de confianza →
generación) y calcula tres métricas por pregunta:

- **Faithfulness** (LLM-as-judge) — ¿toda afirmación de la respuesta está respaldada por el
  contexto recuperado, sin inventar nada?
- **Answer relevancy** (LLM-as-judge) — ¿la respuesta aborda directamente lo que se preguntó?
  (una respuesta honesta de "no tengo base suficiente" ante una pregunta fuera de corpus puntúa 1).
- **Context precision** (heurística, sin LLM) — de los chunks recuperados, ¿qué fracción
  pertenece a los artículos que el golden set espera? Sirve también como señal barata y
  determinista para las 2 preguntas fuera de corpus (`packages/core/src/eval/context-precision.ts`).

Los resultados se guardan en `eval_runs`/`eval_results` (schema del Hito 1) junto al SHA de git
y al coste estimado en USD. El dashboard `GET /eval` (`apps/web/src/app/eval/page.tsx`) lista
las últimas ejecuciones con flechas de regresión (↑/↓) comparando cada run contra la anterior.

## Qué falta tras este hito

- El harness de eval **no se ha corrido de verdad en esta máquina**: necesita Postgres real y
  claves de Anthropic/OpenAI, ninguna disponible aquí (mismo motivo que los hitos anteriores).
  Se verificó que `/eval` degrada con un mensaje explícito en vez de crashear cuando la consulta
  a Postgres falla (mismo patrón de manejo de errores que `/api/chat` en el Hito 4).
- El juez LLM usa el mismo modelo que genera las respuestas (por simplicidad y coste); nada
  impide apuntar el juez a un proveedor distinto para evitar el sesgo de "se juzga a sí mismo".
- **Bug real encontrado y corregido en este hito**: `apps/web` no cargaba el `.env` de la raíz
  del monorepo (Next.js solo autocarga `.env` desde la raíz de la propia app). `next dev` nunca
  veía `DATABASE_URL` ni las claves de API. Se corrigió cargando `../../.env` con `dotenv` desde
  `next.config.ts`, igual que ya hacían `drizzle.config.ts` y `packages/core/vitest.config.ts`.
  Verificado en el navegador con Playwright (`webapp-testing`): antes del fix, el error era
  "DATABASE_URL inválido"; después, el error pasa a ser el fallo real de autenticación de
  Postgres de esta máquina — confirmando que la carga de env ya funciona.
- El camino feliz (respuesta real del LLM con citas) **no se ha podido probar de punta a
  punta**: hay un Postgres nativo (no Docker) ya escuchando en el puerto 5432 con credenciales
  que no coinciden con `docker-compose.yml`, y no hay claves de Anthropic/OpenAI configuradas
  en esta máquina. Lo que sí se verificó en el navegador: render de la página, envío de
  mensajes, la transición a "Buscando en el corpus…", y que un error de servidor ahora se
  muestra correctamente en vez de dejar la UI colgada.
- El retrieval híbrido tiene un test de integración contra Postgres real
  (`packages/core/src/retrieval/hybrid.integration.test.ts`, sin mocks) que corre en CI, pero
  tampoco se ha verificado aquí por el mismo motivo de credenciales.
