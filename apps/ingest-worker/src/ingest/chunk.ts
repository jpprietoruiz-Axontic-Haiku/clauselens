import { getEncoding } from "js-tiktoken";
import type { Chunk, ParsedSection } from "./types.js";

// cl100k_base es el tokenizer usado por la familia text-embedding-3-*.
const encoding = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return encoding.encode(text).length;
}

export interface ChunkOptions {
  maxTokens: number;
  overlapTokens: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxTokens: 400,
  overlapTokens: 60,
};

// Última instancia: una sola frase que por sí sola supera maxTokens (poco
// habitual, pero ocurre en texto legal denso) se corta en ventanas de
// tokens. Ya no es un corte "semántico", pero garantiza el límite duro que
// exige el modelo de embeddings.
function hardSplitByTokens(text: string, maxTokens: number): string[] {
  const tokens = encoding.encode(text);
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i += maxTokens) {
    parts.push(encoding.decode(tokens.slice(i, i + maxTokens)).trim());
  }
  return parts.filter((part) => part.length > 0);
}

// Divide una sección en "unidades" (párrafos, o frases si un párrafo por sí
// solo excede maxTokens) que luego se empaquetan en chunks. Toda unidad
// devuelta tiene como máximo maxTokens tokens.
function splitIntoUnits(text: string, maxTokens: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (countTokens(paragraph) <= maxTokens) {
      units.push(paragraph);
      continue;
    }
    const sentences = paragraph
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
    for (const sentence of sentences) {
      if (countTokens(sentence) <= maxTokens) {
        units.push(sentence);
      } else {
        units.push(...hardSplitByTokens(sentence, maxTokens));
      }
    }
  }

  if (units.length > 0) return units;
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  return countTokens(trimmed) <= maxTokens ? [trimmed] : hardSplitByTokens(trimmed, maxTokens);
}

// Empaqueta unidades (párrafo/frase) en chunks de hasta maxTokens, con
// solape semántico entre chunks consecutivos. Cota en el peor caso:
// maxTokens + overlapTokens (el solape se antepone sin recortarse antes de
// añadir la siguiente unidad, para no partir frases a mitad).
export function chunkSections(sections: ParsedSection[], options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const units = splitIntoUnits(section.text, options.maxTokens);

    let buffer: string[] = [];
    let bufferTokens = 0;

    const flush = (): void => {
      if (buffer.length === 0) return;
      const content = buffer.join("\n\n");
      chunks.push({
        content,
        articleRef: section.articleRef,
        page: section.page,
        tokenCount: countTokens(content),
      });
    };

    for (const unit of units) {
      const unitTokens = countTokens(unit);

      if (buffer.length > 0 && bufferTokens + unitTokens > options.maxTokens) {
        flush();

        // Solape semántico: se retienen las últimas unidades del chunk
        // anterior hasta acercarse a overlapTokens, sin cortar a mitad de frase.
        // Se detiene ANTES de añadir una unidad que haría que el solape
        // superase overlapTokens (en vez de comprobarlo después), para que
        // el solape en sí quede acotado con independencia del tamaño de
        // las unidades — si no cabe ninguna, el solape queda vacío.
        const overlapUnits: string[] = [];
        let overlapTokens = 0;
        for (let i = buffer.length - 1; i >= 0; i--) {
          const previousUnit = buffer[i];
          if (previousUnit === undefined) continue;
          const candidateTokens = overlapTokens + countTokens(previousUnit);
          if (candidateTokens > options.overlapTokens) break;
          overlapUnits.unshift(previousUnit);
          overlapTokens = candidateTokens;
        }
        buffer = overlapUnits;
        bufferTokens = overlapTokens;
      }

      buffer.push(unit);
      bufferTokens += unitTokens;
    }
    flush();
  }

  return chunks;
}
