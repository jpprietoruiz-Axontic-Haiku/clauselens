// Detecta líneas que son *solo* un encabezado de artículo ("Article 5",
// "Artículo 5", "Art. 5") en vez de texto de cuerpo. Los documentos de
// EUR-Lex (fuente de nuestro corpus semilla) siguen este patrón tanto en
// HTML como en el texto extraído de PDF.
export const ARTICLE_HEADING_RE = /^(?:Article|Artículo|Art\.)\s*\d+[a-zA-Z]?\.?$/i;

export function isArticleHeading(text: string): boolean {
  return ARTICLE_HEADING_RE.test(text.trim());
}
