import { chunks as chunksTable, documents, type Database } from "@clauselens/db";
import { chunkSections, DEFAULT_CHUNK_OPTIONS } from "./chunk.js";
import type { Embedder } from "@clauselens/core";
import { parseHtml } from "./parse-html.js";
import { parsePdf } from "./parse-pdf.js";
import type { ParsedSection } from "./types.js";

export type ContentType = "pdf" | "html";

export interface IngestInput {
  title: string;
  sourceUrl: string;
  jurisdiction: string;
  version: string;
  contentType: ContentType;
  /** Buffer/Uint8Array for PDF, or the HTML as a string. */
  content: Uint8Array | string;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
}

interface BuiltChunk {
  content: string;
  articleRef: string | null;
  page: number | null;
  tokenCount: number;
  embedding: number[];
}

export interface BuiltIngestion {
  document: {
    title: string;
    sourceUrl: string;
    jurisdiction: string;
    version: string;
  };
  chunks: BuiltChunk[];
}

async function parse(input: IngestInput): Promise<ParsedSection[]> {
  if (input.contentType === "pdf") {
    const buffer = typeof input.content === "string" ? Buffer.from(input.content, "base64") : input.content;
    return parsePdf(buffer);
  }
  const html = typeof input.content === "string" ? input.content : Buffer.from(input.content).toString("utf-8");
  return parseHtml(html);
}

/**
 * Pure part of the pipeline (parse -> chunk -> embed): it doesn't touch the
 * database, so it can be tested with a fake Embedder and real data.
 */
export async function buildIngestion(embedder: Embedder, input: IngestInput): Promise<BuiltIngestion> {
  const sections = await parse(input);
  if (sections.length === 0) {
    throw new Error(`No text was extracted from "${input.title}"; check the source format.`);
  }

  const documentChunks = chunkSections(sections, DEFAULT_CHUNK_OPTIONS);
  if (documentChunks.length === 0) {
    throw new Error(`Chunking produced no fragments for "${input.title}".`);
  }

  const embeddings = await embedder.embed(documentChunks.map((chunk) => chunk.content));

  const chunksWithEmbeddings = documentChunks.map((chunk, index) => {
    const embedding = embeddings[index];
    if (!embedding) {
      throw new Error(`Missing embedding for chunk ${index} while ingesting "${input.title}".`);
    }
    return { ...chunk, embedding };
  });

  return {
    document: {
      title: input.title,
      sourceUrl: input.sourceUrl,
      jurisdiction: input.jurisdiction,
      version: input.version,
    },
    chunks: chunksWithEmbeddings,
  };
}

export async function ingestDocument(db: Database, embedder: Embedder, input: IngestInput): Promise<IngestResult> {
  const built = await buildIngestion(embedder, input);

  return db.transaction(async (tx) => {
    const [document] = await tx.insert(documents).values(built.document).returning({ id: documents.id });
    if (!document) {
      throw new Error(`Could not create the document record for "${input.title}".`);
    }

    await tx.insert(chunksTable).values(
      built.chunks.map((chunk) => ({
        documentId: document.id,
        content: chunk.content,
        articleRef: chunk.articleRef,
        page: chunk.page,
        embedding: chunk.embedding,
        tokenCount: chunk.tokenCount,
      })),
    );

    return { documentId: document.id, chunkCount: built.chunks.length };
  });
}
