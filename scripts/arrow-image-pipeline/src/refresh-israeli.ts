/**
 * Build a fresh Israeli-only review queue.
 *
 * Skips people already uploaded and people who already have photos in the
 * current v2 review list. Previously seen Commons files are skipped so the
 * cards are new. Writes data/candidates_israeli.json.
 */
import path from "node:path";
import { discoverCommonsCandidates } from "./commons.js";
import { pipelineRoot } from "./config.js";
import { CommonsCandidate, ImageClueSeed } from "./types.js";
import { readJson, writeJson } from "./utils.js";

type Group = {
  clue: ImageClueSeed;
  candidates: CommonsCandidate[];
  error?: string | null;
};

type CatalogEntry = { id?: string; answer?: string };

const dataDir = path.join(pipelineRoot, "data");
const outPath = path.join(dataDir, "candidates_israeli.json");

function normalizeAnswer(value: string): string {
  return value.replace(/\s+/g, "");
}

function clue(partial: Pick<ImageClueSeed, "id" | "subject" | "answer_hebrew" | "category"> & Partial<ImageClueSeed>): ImageClueSeed {
  return {
    type: "person",
    country: "Israel",
    recognition: 4,
    difficulty: 2,
    israeli_relevance: 5,
    global_relevance: 2,
    aliases_hebrew: "",
    image_source: "",
    source_url: "",
    author: "",
    license: "",
    s3_key: "",
    active: true,
    notes: "israeli refresh — verify Hebrew spelling and face match",
    ...partial,
  };
}

/** Famous Israelis missing from both seeds. subject|answer|category */
const EXTRA = `
Dudu Aharon|דודו אהרון|music
Zehava Ben|זהבה בן|music
Yonit Levi|יונית לוי|television
Ilana Dayan|אילנה דיין|television
Yardena Arazi|ירדנה ארזי|music
Haim Moshe|חיים משה|music
Zohar Argov|זוהר ארגוב|music
Ehud Manor|אהוד מנור|music
Naomi Shemer|נעמי שמר|music
Guri Alfi|גורי אלפי|comedy
Moshe Ivgy|משה איבגי|actors
Sasson Gabai|ששון גבאי|actors
Noa Koler|נועה קולר|actors
Avri Gilad|אברי גלעד|television
Eli Ohana|אלי אוחנה|football
Avi Nimni|אבי נמני|football
Oded Katash|עודד קטש|basketball
Raz Hershko|רז הרשקו|olympics
Boaz Sharabi|בועז שרעבי|music
Shimi Tavori|שימי תבורי|music
Gali Atari|גלי עטרי|music
Ilanit|אילנית|music
Kobi Oz|קובי אוז|music
Shlomi Shaban|שלומי שבן|music
Ran Danker|רן דנקר|actors
Noa Tishby|נועה תשבי|actors
Eden Golan|עדן גולן|music
Yuval Raphael|יובל רפאל|music
Stephane Legar|סטפן לגר|music
Gila Almagor|גילה אלמגור|actors
Yael Abecassis|יעל אבקסיס|actors
Eviatar Banai|אביתר בנאי|music
Natan Zach|נתן זך|literature
Yehuda Amichai|יהודה עמיחי|literature
Oren Smadja|אורן סמדג'ה|olympics
Yossi Benayoun|יוסי בניון|football
`.trim();

function extraSeeds(startId: number): ImageClueSeed[] {
  return EXTRA.split("\n").map((line, index) => {
    const [subject, answer_hebrew, category] = line.split("|");
    return clue({
      id: `img_${String(startId + index).padStart(4, "0")}`,
      subject: subject.trim(),
      answer_hebrew: answer_hebrew.trim(),
      category: category.trim(),
    });
  });
}

const [v1, v2, catalog, candidatesV1, candidatesV2] = await Promise.all([
  readJson<ImageClueSeed[]>(path.join(dataDir, "arrow_image_clues_500_v1.json")),
  readJson<ImageClueSeed[]>(path.join(dataDir, "arrow_image_clues_1000_v2.json")),
  readJson<CatalogEntry[]>(path.resolve(pipelineRoot, "../../src/scripts/generators/imageClues.generated.json")),
  readJson<Group[]>(path.join(dataDir, "candidates.json")).catch(() => [] as Group[]),
  readJson<Group[]>(path.join(dataDir, "candidates_v2.json")).catch(() => [] as Group[]),
]);

const uploadedAnswers = new Set(catalog.map((entry) => normalizeAnswer(entry.answer ?? "")));
const v2ById = new Map(candidatesV2.map((group) => [group.clue.id, group]));
const oldById = new Map<string, Group>();
for (const group of [...candidatesV1, ...candidatesV2]) oldById.set(group.clue.id, group);

function alreadyOnReviewPage(id: string): boolean {
  const group = v2ById.get(id);
  return Boolean(group?.candidates?.some((candidate) => candidate.allowed));
}

const seenAnswers = new Set<string>(uploadedAnswers);
for (const group of candidatesV2) {
  if (group.clue?.country === "Israel" && group.candidates?.some((candidate) => candidate.allowed)) {
    seenAnswers.add(normalizeAnswer(group.clue.answer_hebrew));
  }
}
const seeds: ImageClueSeed[] = [];

function take(entry: ImageClueSeed) {
  if (entry.type !== "person" || entry.country !== "Israel") return;
  const answer = normalizeAnswer(entry.answer_hebrew);
  if (!answer || seenAnswers.has(answer) || alreadyOnReviewPage(entry.id)) return;
  seenAnswers.add(answer);
  seeds.push(entry);
}

for (const entry of [...v1, ...v2]) take(entry);

const maxId = [...v1, ...v2].reduce((max, entry) => {
  const n = Number(entry.id.replace(/\D/g, ""));
  return Number.isFinite(n) ? Math.max(max, n) : max;
}, 1500);
for (const entry of extraSeeds(maxId + 1)) take(entry);

console.log(`Discovering fresh photos for ${seeds.length} Israeli people...`);

const results: Group[] = [];
for (let index = 0; index < seeds.length; index++) {
  const entry = seeds[index];
  const previous = oldById.get(entry.id);
  const skipTitles = new Set(
    (previous?.candidates ?? []).map((candidate) => candidate.title).filter(Boolean),
  );
  try {
    const fresh = await discoverCommonsCandidates(entry, 6, skipTitles);
    const allowedFresh = fresh.filter((candidate) => candidate.allowed);
    const candidates = allowedFresh.length > 0
      ? fresh
      : [
          ...fresh,
          ...(previous?.candidates ?? []).filter((candidate) => candidate.allowed),
        ].slice(0, 6);
    const allowed = candidates.filter((candidate) => candidate.allowed).length;
    console.log(
      `[${index + 1}/${seeds.length}] ${entry.answer_hebrew}: ${allowed} reusable` +
        (allowedFresh.length === 0 && allowed > 0 ? " (previous photos)" : ""),
    );
    results.push({ clue: entry, candidates, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${index + 1}/${seeds.length}] ${entry.answer_hebrew}: ${message}`);
    results.push({
      clue: entry,
      candidates: (previous?.candidates ?? []).filter((candidate) => candidate.allowed).slice(0, 6),
      error: message,
    });
  }
}

await writeJson(outPath, results);
const ready = results.filter((group) => group.candidates.some((candidate) => candidate.allowed)).length;
console.log(`Wrote ${outPath} (${ready} people with a reusable photo)`);
