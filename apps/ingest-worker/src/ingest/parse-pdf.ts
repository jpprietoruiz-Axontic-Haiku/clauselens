import { extractText, getDocumentProxy } from "unpdf";
import { isArticleHeading } from "./article-heading.js";
import type { ParsedSection } from "./types.js";

export async function parsePdf(buffer: Uint8Array): Promise<ParsedSection[]> {
  // unpdf reexporta los tipos de pdfjs-dist (orientados a navegador, p.ej.
  // referencian OffscreenCanvas); nuestro tsconfig es Node puro sin "dom" en
  // `lib`, así que TS no puede resolver del todo el tipo de PDFDocumentProxy
  // y ESLint lo ve como "error typed". `tsc --noEmit` no reporta nada real
  // aquí: es un choque de `lib`, no un `any` en este código.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pdf = await getDocumentProxy(buffer);
  const { text: pages } = await extractText(pdf, { mergePages: false });

  const sections: ParsedSection[] = [];
  let currentArticleRef: string | null = null;

  pages.forEach((pageText, pageIndex) => {
    const page = pageIndex + 1;
    const lines = pageText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let buffer: string[] = [];

    const flush = (): void => {
      const text = buffer.join(" ").trim();
      if (text.length > 0) {
        sections.push({ articleRef: currentArticleRef, page, text });
      }
      buffer = [];
    };

    for (const line of lines) {
      if (isArticleHeading(line)) {
        flush();
        currentArticleRef = line;
        continue;
      }
      buffer.push(line);
    }
    flush();
  });

  return sections;
}
