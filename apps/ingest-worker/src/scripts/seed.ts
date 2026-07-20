import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, loadDbEnv } from "@clauselens/db";
import { loadEnv } from "../env.js";
import { createOpenAiEmbedder } from "@clauselens/core";
import { ingestDocument, type ContentType } from "../ingest/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.resolve(__dirname, "../../corpus");

interface SeedDocument {
  title: string;
  sourceUrl: string;
  jurisdiction: string;
  version: string;
  contentType: ContentType;
  file: string;
}

// Corpus semilla: extractos públicos reales de EUR-Lex (GDPR en HTML, EU AI
// Act en PDF) para que la demo tenga sustancia desde el día 1 y para
// ejercitar los dos parsers del pipeline.
const SEED_DOCUMENTS: SeedDocument[] = [
  {
    title: "Reglamento General de Protección de Datos (GDPR) — Reglamento (UE) 2016/679",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679",
    jurisdiction: "EU",
    version: "2016/679",
    contentType: "html",
    file: "gdpr.html",
  },
  {
    title: "Reglamento de Inteligencia Artificial (EU AI Act) — Reglamento (UE) 2024/1689",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202401689",
    jurisdiction: "EU",
    version: "2024/1689",
    contentType: "pdf",
    file: "eu-ai-act.pdf",
  },
];

async function readContent(doc: SeedDocument): Promise<Uint8Array | string> {
  const filePath = path.join(CORPUS_DIR, doc.file);
  if (doc.contentType === "pdf") {
    return new Uint8Array(await readFile(filePath));
  }
  return readFile(filePath, "utf-8");
}

async function main(): Promise<void> {
  const env = loadEnv();
  const { DATABASE_URL } = loadDbEnv();
  const db = createDb(DATABASE_URL);
  const embedder = createOpenAiEmbedder(env.OPENAI_API_KEY, env.EMBEDDING_MODEL);

  for (const doc of SEED_DOCUMENTS) {
    console.log(JSON.stringify({ level: "info", msg: "ingesting", title: doc.title }));
    const content = await readContent(doc);
    const result = await ingestDocument(db, embedder, {
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      jurisdiction: doc.jurisdiction,
      version: doc.version,
      contentType: doc.contentType,
      content,
    });
    console.log(JSON.stringify({ level: "info", msg: "ingested", ...result }));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", msg: "seed_failed", error: message }));
  process.exitCode = 1;
});
