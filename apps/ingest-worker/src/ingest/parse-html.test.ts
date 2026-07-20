import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHtml } from "./parse-html.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.resolve(__dirname, "../../corpus");

const SYNTHETIC_HTML = `
<html>
  <body>
    <p class="oj-normal">Este párrafo es preámbulo, antes de cualquier artículo.</p>
    <p class="oj-ti-art">Article 1</p>
    <p class="oj-normal">Texto del artículo 1, primera frase.</p>
    <p class="oj-normal">Texto del artículo 1, segunda frase.</p>
    <p class="oj-ti-art">Article 2</p>
    <p class="oj-normal">Texto del artículo 2.</p>
    <script>console.log("no debe aparecer en el texto extraído");</script>
    <style>.foo { color: red; }</style>
  </body>
</html>
`;

describe("parseHtml (fixture sintético)", () => {
  it("agrupa el contenido bajo el artículo correcto", () => {
    const sections = parseHtml(SYNTHETIC_HTML);

    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ articleRef: null, page: null });
    expect(sections[0]?.text).toContain("preámbulo");

    expect(sections[1]?.articleRef).toBe("Article 1");
    expect(sections[1]?.text).toContain("primera frase");
    expect(sections[1]?.text).toContain("segunda frase");

    expect(sections[2]?.articleRef).toBe("Article 2");
    expect(sections[2]?.text).toContain("Texto del artículo 2");
  });

  it("ignora script y style", () => {
    const sections = parseHtml(SYNTHETIC_HTML);
    const allText = sections.map((s) => s.text).join(" ");
    expect(allText).not.toContain("console.log");
    expect(allText).not.toContain("color: red");
  });

  it("un documento vacío no produce secciones", () => {
    expect(parseHtml("<html><body></body></html>")).toEqual([]);
  });

  it("anexa el subtítulo (oj-sti-art) al número de artículo sin confundirlo con un artículo nuevo", () => {
    const sections = parseHtml(`
      <html><body>
        <p class="oj-ti-art">Article 5</p>
        <p class="oj-sti-art">Principles relating to processing of personal data</p>
        <p class="oj-normal">Cuerpo del artículo 5.</p>
        <p class="oj-ti-art">Article 6</p>
        <p class="oj-sti-art">Lawfulness of processing</p>
        <p class="oj-normal">Cuerpo del artículo 6.</p>
      </body></html>
    `);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      articleRef: "Article 5 — Principles relating to processing of personal data",
    });
    expect(sections[0]?.text).toBe("Cuerpo del artículo 5.");
    expect(sections[1]).toMatchObject({
      articleRef: "Article 6 — Lawfulness of processing",
    });
  });

  it("detecta encabezados de artículo por texto aunque no tengan la clase de EUR-Lex", () => {
    const sections = parseHtml(`
      <html><body>
        <h2>Article 7</h2>
        <p>Cuerpo del artículo 7.</p>
      </body></html>
    `);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.articleRef).toBe("Article 7");
  });
});

describe("parseHtml (corpus real: GDPR)", () => {
  it("extrae los 99 artículos del GDPR desde el HTML oficial de EUR-Lex", async () => {
    const html = await readFile(path.join(CORPUS_DIR, "gdpr.html"), "utf-8");
    const sections = parseHtml(html);

    const articleRefs = sections.map((s) => s.articleRef).filter((ref): ref is string => ref !== null);
    const uniqueArticles = new Set(articleRefs);

    // El GDPR tiene 99 artículos (Article 1 .. Article 99). El nombre
    // descriptivo (clase oj-sti-art) se anexa al número, ej.
    // "Article 1 — Subject-matter and objectives".
    expect([...uniqueArticles].some((ref) => ref.startsWith("Article 1 —"))).toBe(true);
    expect([...uniqueArticles].some((ref) => ref.startsWith("Article 99 —"))).toBe(true);
    expect(uniqueArticles.size).toBeGreaterThanOrEqual(99);

    for (const section of sections) {
      expect(section.text.length).toBeGreaterThan(0);
      expect(section.page).toBeNull();
    }
  }, 20_000);
});
