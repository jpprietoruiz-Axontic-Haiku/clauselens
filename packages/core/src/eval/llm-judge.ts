import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

const judgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export interface JudgeScore {
  score: number;
  reasoning: string;
}

/** ¿Todas las afirmaciones de la respuesta están respaldadas por el contexto recuperado? */
export async function judgeFaithfulness(model: LanguageModel, answer: string, context: string): Promise<JudgeScore> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: judgeScoreSchema }),
    prompt: `Eres un evaluador estricto de un sistema RAG normativo. Se te da un CONTEXTO (fragmentos recuperados de un corpus legal) y una RESPUESTA generada a partir de ese contexto.

Evalúa si TODAS las afirmaciones de la RESPUESTA están respaldadas por el CONTEXTO, sin añadir información inventada. Devuelve:
- score = 1 si cada afirmación de la respuesta se apoya en el contexto.
- score = 0 si la respuesta inventa información que no está en el contexto (alucinación).
- un valor intermedio si solo una parte de la respuesta está respaldada.

Si la respuesta es explícitamente "no tengo base suficiente" o equivalente, score = 1 (no afirma nada que pueda ser falso).

CONTEXTO:
${context || "(sin contexto: no se recuperó ningún fragmento)"}

RESPUESTA:
${answer}`,
  });
  return output;
}

/** ¿La respuesta aborda directamente lo que se preguntó? */
export async function judgeAnswerRelevancy(model: LanguageModel, question: string, answer: string): Promise<JudgeScore> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: judgeScoreSchema }),
    prompt: `Eres un evaluador estricto de un sistema RAG normativo. Dada una PREGUNTA y una RESPUESTA, evalúa en qué medida la respuesta aborda directamente lo que se preguntó. Devuelve:
- score = 1 si la respuesta aborda completa y directamente la pregunta.
- score = 0 si es irrelevante, evasiva o no responde a lo preguntado.
- un valor intermedio si la responde solo parcialmente.

Si la pregunta está fuera del ámbito del corpus y la respuesta lo indica honestamente en vez de inventar (p. ej. "no tengo base suficiente"), score = 1: esa es la respuesta correcta para una pregunta sin soporte.

PREGUNTA: ${question}

RESPUESTA: ${answer}`,
  });
  return output;
}
