import type { RetrievedChunk } from "../retrieval/types.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const NO_BASIS_MESSAGE =
  "No tengo base suficiente en el corpus para responder esto con confianza. " +
  "Prueba a reformular la pregunta o consulta directamente la fuente normativa.";

const SYSTEM_PROMPT = `Eres ClauseLens, un asistente que responde preguntas de normativa citando exclusivamente el contexto proporcionado.

Reglas estrictas:
- Responde solo con información contenida en el CONTEXTO. No uses conocimiento externo ni inventes artículos.
- Cada afirmación debe ir acompañada de una cita entre corchetes al número de fragmento correspondiente, p. ej. [1] o [2][3].
- Si el CONTEXTO no contiene la respuesta, dilo explícitamente en vez de inventar.
- Responde en el mismo idioma en que se formuló la pregunta.`;

function chunkLabel(chunk: RetrievedChunk): string {
  return [chunk.documentTitle, chunk.articleRef, chunk.page !== null ? `p. ${chunk.page}` : null]
    .filter((part): part is string => Boolean(part))
    .join(" — ");
}

export function buildContextBlock(retrieved: RetrievedChunk[]): string {
  return retrieved.map((chunk, i) => `[${i + 1}] (${chunkLabel(chunk)})\n${chunk.content}`).join("\n\n");
}

export function buildChatMessages(question: string, retrieved: RetrievedChunk[]): ChatMessage[] {
  const context = buildContextBlock(retrieved);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `CONTEXTO:\n${context}\n\nPREGUNTA: ${question}` },
  ];
}
