import { ImageClueSeed } from "./types.js";
import { readJson } from "./utils.js";

const seedPath = process.argv[2] ?? "data/arrow_image_clues_500_v1.json";
const seeds = await readJson<ImageClueSeed[]>(seedPath);

const errors: string[] = [];
const ids = new Set<string>();
const subjects = new Set<string>();
const answers = new Set<string>();

for (const clue of seeds) {
  if (!clue.id) errors.push("Missing id");
  if (!clue.subject) errors.push(`${clue.id}: missing subject`);
  if (!clue.answer_hebrew) errors.push(`${clue.id}: missing answer_hebrew`);

  if (ids.has(clue.id)) errors.push(`${clue.id}: duplicate id`);
  if (subjects.has(clue.subject)) errors.push(`${clue.id}: duplicate subject ${clue.subject}`);
  if (answers.has(clue.answer_hebrew)) errors.push(`${clue.id}: duplicate Hebrew answer ${clue.answer_hebrew}`);

  ids.add(clue.id);
  subjects.add(clue.subject);
  answers.add(clue.answer_hebrew);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`✓ ${seeds.length} clues validated`);
