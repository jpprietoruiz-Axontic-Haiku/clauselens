# Decisiones de arquitectura

Este documento recoge las decisiones no obvias de ClauseLens y su justificación. No es un
registro exhaustivo de cada línea de código — es lo que un revisor necesitaría saber para
entender *por qué* está construido así, no solo *qué* hace.

## Retrieval

### Por qué híbrido (vector + léxico) y no solo similitud vectorial

Los embeddings capturan significado semántico, pero fallan sistemáticamente en dos casos muy
frecuentes en un asistente normativo:

- **Términos exactos y referencias legales**: si alguien pregunta literalmente "¿qué dice el
  artículo 17?", un embedding puede situar esa pregunta cerca de artículos *temáticamente*
  relacionados con el derecho de supresión sin necesariamente priorizar el chunk que
  contiene exactamente "Article 17" en su título.
- **Vocabulario poco frecuente o siglas**: los embeddings generalistas no siempre distinguen
  bien términos técnicos muy específicos del dominio legal.

La búsqueda léxica (`websearch_to_tsquery` sobre un índice GIN de expresión, sin necesidad de
una columna `tsvector` materializada) cubre exactamente esos casos. Ninguna de las dos patas es
suficiente por sí sola; por eso se combinan.

### Por qué Reciprocal Rank Fusion (RRF) y no normalizar y sumar scores

La similitud coseno vive en un rango acotado e interpretable (~[-1, 1], en la práctica cercano a
[0, 1] con embeddings normalizados). `ts_rank` de Postgres no tiene una escala fija ni
comparable: dos corpus distintos, o incluso dos consultas distintas sobre el mismo corpus,
pueden producir rangos de `ts_rank` completamente distintos. Normalizar y sumar esas dos
magnitudes heterogéneas produciría una fusión arbitraria que depende de detalles de
implementación de cada motor de búsqueda.

RRF (`score = Σ 1 / (k + rank)`, con `k = 60`, el valor estándar de la literatura) resuelve esto
ignorando el valor absoluto de cada score y usando solo la *posición* en cada ranking. Es robusto
a diferencias de escala entre las dos patas, es determinista, no requiere entrenar ni calibrar
nada, y es la técnica que la propia comunidad de RAG suele llamar "re-ranking" cuando no se
introduce un modelo de re-ranking dedicado (ver más abajo).

### Por qué no un re-ranker dedicado (p. ej. Cohere Rerank, cross-encoder)

Un re-ranker de propósito específico (modelo cross-encoder que puntúa cada par
pregunta-fragmento) suele dar mejores resultados que RRF puro, pero introduce una llamada de red
adicional por consulta, una dependencia de proveedor más, y coste adicional — todo ello para un
corpus semilla de dos documentos donde el margen de mejora es marginal. RRF sobre vector+léxico
ya cubre los dos modos de fallo relevantes en este alcance. Si el corpus creciera a decenas de
documentos, un re-ranker dedicado sería la primera pieza a añadir.

### Por qué el umbral de confianza mira la similitud coseno del mejor resultado, y no `fusedScore`

`fusedScore` es una suma de contribuciones de RRF: su magnitud depende de en cuántas patas
apareció un chunk y en qué posición, no de "cuán relacionado semánticamente está con la
pregunta". No tiene una interpretación absoluta — no existe un "0.5 de fusedScore" que
signifique lo mismo entre dos consultas distintas.

La similitud coseno del mejor resultado *sí* es interpretable: 1 es idéntico, valores bajos o
negativos indican que ni siquiera el mejor candidato está semánticamente cerca de la pregunta.
Por eso el umbral (`CONFIDENCE_THRESHOLD = 0.35`, `packages/core/src/retrieval/confidence.ts`)
se aplica ahí. Es un valor conservador elegido por inspección manual con `text-embedding-3-large`
sobre el corpus semilla, no calibrado estadísticamente contra un conjunto de validación grande
— con un corpus de solo dos documentos, calibrar un umbral "óptimo" sería sobreajustar a ruido.
Si el corpus creciera, este valor debería revisarse con un conjunto de preguntas negativas más
amplio que las dos incluidas en el golden set actual.

Cuando no se supera el umbral, el sistema **no llama al LLM en absoluto**: responde con un
mensaje fijo. Esto evita tanto la alucinación como el coste de una llamada que casi con
seguridad produciría una respuesta sin fundamento real.

## Esquema de datos y almacenamiento

### Por qué Postgres + pgvector y no una base de datos vectorial dedicada

Un único Postgres aloja el vector search (pgvector, índice HNSW), la búsqueda de texto completo
(índice GIN nativo) y los datos relacionales (documentos, conversaciones, resultados de eval) en
las mismas transacciones. Para el volumen de este proyecto (un corpus semilla de dos documentos,
unos pocos cientos de chunks), una base de datos vectorial dedicada (Pinecone, Weaviate...)
añadiría una pieza de infraestructura más, otro proveedor que gestionar y sincronizar, sin
ninguna ventaja de rendimiento apreciable a esta escala. Neon (Postgres serverless con pgvector
nativo) permite desplegar esto con cero infraestructura propia que mantener.

### Por qué Drizzle ORM

Tipado end-to-end desde el schema de TypeScript hasta las consultas SQL, sin generar un cliente
aparte (a diferencia de Prisma) ni perder la capacidad de escribir SQL crudo cuando hace falta
(la fusión de rankings y la expresión GIN de full-text search se apoyan en `sql\`...\`` de
Drizzle). Las migraciones son SQL plano versionado y legible, no una capa de abstracción opaca.

### Por qué `chunks.embedding` está fijado a 3072 dimensiones

`text-embedding-3-large` de OpenAI produce vectores de 3072 dimensiones. Es una decisión con
coste real de cambiar: la columna del schema, el índice HNSW y todo el corpus ya ingerido
dependen de esa dimensión exacta. Cambiar de modelo de embeddings implica una migración y
reingesta completas, no solo cambiar una variable de entorno — está documentado como tal en
`.env.example` y en el propio schema.

## Generación y proveedor de LLM

### Por qué una capa de proveedor intercambiable (Anthropic / OpenAI)

El Vercel AI SDK unifica la interfaz de `streamText`/`generateText` entre proveedores: cambiar
de modelo es una variable de entorno (`LLM_PROVIDER`), no un cambio de código
(`packages/core/src/llm/provider.ts`). Esto demuestra una capacidad real de producción (no
depender de un único proveedor) y facilita comparar coste/calidad entre modelos sin tocar la
lógica de negocio.

### Por qué los embeddings están fijos a OpenAI incluso cuando `LLM_PROVIDER=anthropic`

Anthropic no ofrece una API de embeddings. La capa de proveedor intercambiable cubre el modelo de
*chat*; los embeddings son una dependencia aparte y deliberadamente no intercambiable, documentada
como tal (`OPENAI_API_KEY` es obligatorio con independencia del proveedor de chat elegido).

## Harness de evaluación

### Por qué estas tres métricas (faithfulness, answer relevancy, context precision)

Cada una aísla un modo de fallo distinto de un sistema RAG, y juntas cubren el pipeline completo:

- **Faithfulness** — ¿el paso de *generación* inventó algo que no está en el contexto? Es la
  métrica anti-alucinación por excelencia.
- **Answer relevancy** — ¿el paso de generación, aun siendo fiel al contexto, respondió
  realmente lo que se preguntó? Una respuesta puede ser 100% fiel al contexto y aun así ser
  evasiva o tangencial.
- **Context precision** — ¿el paso de *retrieval* recuperó los fragmentos correctos? Si esta
  métrica es baja, el problema está antes de llegar al LLM, y ni faithfulness ni answer
  relevancy lo van a revelar por sí solas.

Este es el mismo desglose que populariza RAGAS, sin adoptar la librería completa: aquí el
harness es propio y deliberadamente pequeño.

### Por qué LLM-as-judge para dos métricas y heurística para la tercera

Determinar si una afirmación en lenguaje natural está "respaldada por el contexto" o si una
respuesta "aborda la pregunta" requiere comprensión semántica — no hay una heurística barata que
lo haga bien, así que faithfulness y answer relevancy usan un juez LLM
(`generateText` + `Output.object` con un schema de Zod para forzar una salida estructurada
`{ score, reasoning }`).

Context precision, en cambio, se puede calcular de forma determinista y gratuita comparando el
número de artículo de cada chunk recuperado contra los artículos que el golden set espera
(`packages/core/src/eval/context-precision.ts`). Usar un LLM ahí sería más caro y más lento sin
aportar más señal, dado que el golden set ya anota la respuesta correcta.

### Por qué el juez usa el mismo modelo que genera las respuestas

Simplicidad y coste: un único proveedor configurado basta para correr el harness completo. La
desventaja conocida es el sesgo de "el modelo se juzga a sí mismo" (tiende a puntuarse mejor de
lo que un juez independiente lo haría). `RunEvalDeps.judgeModel` está separado de `chatModel`
precisamente para que apuntar el juez a un proveedor distinto sea un cambio de una línea, no un
rediseño, el día que se quiera eliminar ese sesgo.

### Por qué el golden set incluye preguntas deliberadamente fuera de corpus

Dos de las diez preguntas del golden set no tienen respuesta en el corpus (GDPR + EU AI Act) a
propósito. Sin ellas, el harness solo mediría "¿responde bien cuando hay contexto?" y nunca
"¿sabe decir que no sabe?" — que es precisamente la propiedad que distingue a este sistema de un
RAG que alucina con confianza. `context-precision.ts` trata estos casos correctamente: cualquier
chunk recuperado para una pregunta sin artículos esperados cuenta como "no relevante", así que un
retrieval que devuelve ruido para una pregunta sin respuesta también se penaliza.

## Qué se dejó fuera del alcance (y por qué)

- **Autenticación y multi-tenancy**: el corpus es 100% público y el objetivo es demostrar el
  pipeline RAG, no un producto multiusuario.
- **Re-ranker dedicado**: ver más arriba — RRF cubre el alcance actual sin coste ni dependencia
  extra.
- **Streaming de citas verificadas en tiempo real** (validar cada marcador `[n]` contra el
  contexto mientras se genera, no solo al final): añadiría latencia por token a cambio de una
  garantía que el faithfulness del harness de eval ya mide de forma agregada.
- **Corpus más allá de GDPR y EU AI Act**: el objetivo del corpus semilla es demostrar el
  pipeline completo (parse HTML + parse PDF, ambos ejercitados) con datos reales, no maximizar
  cobertura normativa.
