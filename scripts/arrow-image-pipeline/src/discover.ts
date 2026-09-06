import { config } from "./config.js";
import { discoverCommonsCandidates } from "./commons.js";
import { ImageClueSeed } from "./types.js";
import { mapLimit, readJson, writeJson } from "./utils.js";

const seedPath = process.argv[2] ?? "data/arrow_image_clues_500_v1.json";
const outPath = process.argv[3] ?? "data/candidates.json";

const seeds = await readJson<ImageClueSeed[]>(seedPath);

console.log(`Discovering candidates for ${seeds.length} clues...`);
console.log(`Concurrency: ${config.discoveryConcurrency}`);

const results = await mapLimit(
  seeds,
  config.discoveryConcurrency,
  async (clue, index) => {
    try {
      const candidates = await discoverCommonsCandidates(
        clue,
        config.candidatesPerClue
      );
      console.log(
        `[${index + 1}/${seeds.length}] ${clue.subject}: ${candidates.length} candidates`
      );
      return { clue, candidates, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${index + 1}/${seeds.length}] ${clue.subject}: ${message}`);
      return { clue, candidates: [], error: message };
    }
  }
);

await writeJson(outPath, results);
console.log(`Wrote ${outPath}`);
