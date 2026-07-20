// Detects lines that are *only* an article heading ("Article 5",
// "Artículo 5", "Art. 5") rather than body text. EUR-Lex documents (the
// source of our seed corpus) follow this pattern both in HTML and in text
// extracted from PDF.
export const ARTICLE_HEADING_RE = /^(?:Article|Artículo|Art\.)\s*\d+[a-zA-Z]?\.?$/i;

export function isArticleHeading(text: string): boolean {
  return ARTICLE_HEADING_RE.test(text.trim());
}
