import { extractText, getDocumentProxy } from "unpdf";
import { isArticleHeading } from "./article-heading.js";
import type { ParsedSection } from "./types.js";

export async function parsePdf(buffer: Uint8Array): Promise<ParsedSection[]> {
  // unpdf re-exports pdfjs-dist's types (browser-oriented, e.g. they
  // reference OffscreenCanvas); our tsconfig is Node-only without "dom" in
  // `lib`, so TS can't fully resolve PDFDocumentProxy's type and ESLint
  // sees it as "error typed". `tsc --noEmit` reports nothing real here:
  // it's a `lib` mismatch, not an `any` in this code.
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
