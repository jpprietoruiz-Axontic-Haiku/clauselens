import * as cheerio from "cheerio";
import { isArticleHeading } from "./article-heading.js";
import type { ParsedSection } from "./types.js";

const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li";

// EUR-Lex classes: "oj-ti-art" is the article number ("Article 1") and
// "oj-sti-art" is its descriptive name ("Subject-matter and objectives"),
// in a separate <p> right after it. They must be compared as exact tokens:
// "oj-sti-art" contains the substring "ti-art", so a naive `.includes()`
// confuses the subtitle with the article number.
function hasClassToken(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}

export function parseHtml(html: string): ParsedSection[] {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();

  const sections: ParsedSection[] = [];
  let currentArticleRef: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join("\n\n").trim();
    if (text.length > 0) {
      sections.push({ articleRef: currentArticleRef, page: null, text });
    }
    buffer = [];
  };

  $(BLOCK_SELECTOR).each((_, el) => {
    const node = $(el);
    const text = node.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const className = node.attr("class") ?? "";

    if (hasClassToken(className, "oj-ti-art")) {
      flush();
      currentArticleRef = text;
      return;
    }

    if (hasClassToken(className, "oj-sti-art") && currentArticleRef) {
      currentArticleRef = `${currentArticleRef} — ${text}`;
      return;
    }

    if (isArticleHeading(text)) {
      flush();
      currentArticleRef = text;
      return;
    }

    buffer.push(text);
  });
  flush();

  return sections;
}
