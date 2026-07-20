import { chunks as chunksTable, documents, type Database } from "@clauselens/db";
import { chunkSections, DEFAULT_CHUNK_OPTIONS } from "./chunk.js";
import type { Embedder } from "./embed.js";
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
  /** Buffer/Uint8Array para PDF, o el HTML como string. */
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
 * Parte pura del pipeline (parse -> chunk -> embed): no toca la base de
 * datos, así que se puede testear con un Embedder falso y datos reales.
 */
export async function buildIngestion(embedder: Embedder, input: IngestInput): Promise<BuiltIngestion> {
  const sections = await parse(input);
  if (sections.length === 0) {
    throw new Error(`No se extrajo texto de "${input.title}"; revisa el formato de origen.`);
  }

  const documentChunks = chunkSections(sections, DEFAULT_CHUNK_OPTIONS);
  if (documentChunks.length === 0) {
    throw new Error(`El chunking no produjo fragmentos para "${input.title}".`);
  }

  const embeddings = await embedder.embed(documentChunks.map((chunk) => chunk.content));

  const chunksWithEmbeddings = documentChunks.map((chunk, index) => {
    const embedding = embeddings[index];
    if (!embedding) {
      throw new Error(`Falta el embedding del chunk ${index} al ingerir "${input.title}".`);
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
      throw new Error(`No se pudo crear el registro del documento para "${input.title}".`);
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
