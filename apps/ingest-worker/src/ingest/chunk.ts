import { getEncoding } from "js-tiktoken";
import type { Chunk, ParsedSection } from "./types.js";

// cl100k_base is the tokenizer used by the text-embedding-3-* family.
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

// Last resort: a single sentence that by itself exceeds maxTokens (rare,
// but it happens in dense legal text) gets cut into token windows. This is
// no longer a "semantic" cut, but it guarantees the hard limit the
// embedding model requires.
function hardSplitByTokens(text: string, maxTokens: number): string[] {
  const tokens = encoding.encode(text);
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i += maxTokens) {
    parts.push(encoding.decode(tokens.slice(i, i + maxTokens)).trim());
  }
  return parts.filter((part) => part.length > 0);
}

// Splits a section into "units" (paragraphs, or sentences if a paragraph by
// itself exceeds maxTokens) that are later packed into chunks. Every
// returned unit has at most maxTokens tokens.
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

// Packs units (paragraph/sentence) into chunks of up to maxTokens, with
// semantic overlap between consecutive chunks. Worst-case bound:
// maxTokens + overlapTokens (the overlap is prepended without trimming
// before adding the next unit, so as not to cut sentences in half).
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

        // Semantic overlap: the last units of the previous chunk are kept
        // until getting close to overlapTokens, without cutting a sentence
        // in half. It stops BEFORE adding a unit that would push the
        // overlap past overlapTokens (rather than checking afterward), so
        // the overlap itself stays bounded regardless of unit size — if
        // none fits, the overlap is left empty.
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
