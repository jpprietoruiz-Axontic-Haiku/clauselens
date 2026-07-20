import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoldenQuestion } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// golden-set.json vive en la raíz del paquete (no en src/ ni en dist/) para
// que esta ruta relativa resuelva igual en dev (tsx sobre src/eval) y en
// producción (node sobre dist/eval) sin necesidad de copiarlo en el build.
const GOLDEN_SET_PATH = path.resolve(__dirname, "../../golden-set.json");

export function loadGoldenSet(): GoldenQuestion[] {
  const raw = readFileSync(GOLDEN_SET_PATH, "utf-8");
  return JSON.parse(raw) as GoldenQuestion[];
}
