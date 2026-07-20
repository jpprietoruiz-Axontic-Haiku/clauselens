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
    <p class="oj-normal">This paragraph is preamble, before any article.</p>
    <p class="oj-ti-art">Article 1</p>
    <p class="oj-normal">Article 1 text, first sentence.</p>
    <p class="oj-normal">Article 1 text, second sentence.</p>
    <p class="oj-ti-art">Article 2</p>
    <p class="oj-normal">Article 2 text.</p>
    <script>console.log("should not appear in the extracted text");</script>
    <style>.foo { color: red; }</style>
  </body>
</html>
`;

describe("parseHtml (synthetic fixture)", () => {
  it("groups content under the correct article", () => {
    const sections = parseHtml(SYNTHETIC_HTML);

    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ articleRef: null, page: null });
    expect(sections[0]?.text).toContain("preamble");

    expect(sections[1]?.articleRef).toBe("Article 1");
    expect(sections[1]?.text).toContain("first sentence");
    expect(sections[1]?.text).toContain("second sentence");

    expect(sections[2]?.articleRef).toBe("Article 2");
    expect(sections[2]?.text).toContain("Article 2 text");
  });

  it("ignores script and style", () => {
    const sections = parseHtml(SYNTHETIC_HTML);
    const allText = sections.map((s) => s.text).join(" ");
    expect(allText).not.toContain("console.log");
    expect(allText).not.toContain("color: red");
  });

  it("an empty document produces no sections", () => {
    expect(parseHtml("<html><body></body></html>")).toEqual([]);
  });

  it("appends the subtitle (oj-sti-art) to the article number without confusing it with a new article", () => {
    const sections = parseHtml(`
      <html><body>
        <p class="oj-ti-art">Article 5</p>
        <p class="oj-sti-art">Principles relating to processing of personal data</p>
        <p class="oj-normal">Body of article 5.</p>
        <p class="oj-ti-art">Article 6</p>
        <p class="oj-sti-art">Lawfulness of processing</p>
        <p class="oj-normal">Body of article 6.</p>
      </body></html>
    `);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      articleRef: "Article 5 — Principles relating to processing of personal data",
    });
    expect(sections[0]?.text).toBe("Body of article 5.");
    expect(sections[1]).toMatchObject({
      articleRef: "Article 6 — Lawfulness of processing",
    });
  });

  it("detects article headings by text even without the EUR-Lex class", () => {
    const sections = parseHtml(`
      <html><body>
        <h2>Article 7</h2>
        <p>Body of article 7.</p>
      </body></html>
    `);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.articleRef).toBe("Article 7");
  });
});

describe("parseHtml (real corpus: GDPR)", () => {
  it("extracts the 99 GDPR articles from the official EUR-Lex HTML", async () => {
    const html = await readFile(path.join(CORPUS_DIR, "gdpr.html"), "utf-8");
    const sections = parseHtml(html);

    const articleRefs = sections.map((s) => s.articleRef).filter((ref): ref is string => ref !== null);
    const uniqueArticles = new Set(articleRefs);

    // The GDPR has 99 articles (Article 1 .. Article 99). The descriptive
    // name (oj-sti-art class) is appended to the number, e.g.
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
