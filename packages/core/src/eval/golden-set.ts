import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoldenQuestion } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// golden-set.json lives at the package root (not in src/ nor dist/) so this
// relative path resolves the same way in dev (tsx over src/eval) and in
// production (node over dist/eval) without needing to copy it during build.
const GOLDEN_SET_PATH = path.resolve(__dirname, "../../golden-set.json");

export function loadGoldenSet(): GoldenQuestion[] {
  const raw = readFileSync(GOLDEN_SET_PATH, "utf-8");
  return JSON.parse(raw) as GoldenQuestion[];
}
