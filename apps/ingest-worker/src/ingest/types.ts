export interface ParsedSection {
  articleRef: string | null;
  page: number | null;
  text: string;
}

export interface Chunk {
  content: string;
  articleRef: string | null;
  page: number | null;
  tokenCount: number;
}
