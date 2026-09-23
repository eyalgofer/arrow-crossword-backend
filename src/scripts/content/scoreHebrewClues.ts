/**
 * Score hebrewClues.json entries with an LLM and write the results to a review file.
 * Nothing is written to hebrewClues.json here — see reviewHebrewClueScores.ts.
 *
 * Short "glue" answers (2–4 letters) are scored first: they appear in every grid.
 *
 * Usage:
 *   npx ts-node src/scripts/content/scoreHebrewClues.ts --limit 200
 *   npx ts-node src/scripts/content/scoreHebrewClues.ts --max-length 4
 *   npx ts-node src/scripts/content/scoreHebrewClues.ts --model gpt-5.5 --concurrency 6
 *
 * Re-running resumes: answers already in the output file are skipped.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import {
  Difficulty,
  HEBREW_CATEGORIES,
  HebrewCategory,
  HebrewClue,
  RawHebrewEntry,
  readHebrewClues,
} from '../core/hebrewClueStore';

export const DEFAULT_SCORES_FILE = path.join(__dirname, '../../../tmp/hebrew-clue-scores.jsonl');
const MAX_CLUE_LENGTH = 28;

export type EntryFlag = 'wrong' | 'obscure' | 'stale';

export interface ScoredEntry {
  index: number;
  answer: string;
  fillScore: number;
  category: HebrewCategory;
  flag: EntryFlag | null;
  note?: string;
  clues: Array<Required<HebrewClue>>;
  newClues: Array<Required<HebrewClue>>;
}

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const MODEL = argValue('--model', process.env.OPENAI_MODEL ?? 'gpt-5.5')!;
const BATCH_SIZE = parseInt(argValue('--batch', '40')!, 10);
const CONCURRENCY = parseInt(argValue('--concurrency', '4')!, 10);
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit')!, 10) : Infinity;
const MAX_LENGTH = argValue('--max-length') ? parseInt(argValue('--max-length')!, 10) : Infinity;
const OUT_FILE = path.resolve(argValue('--out', DEFAULT_SCORES_FILE)!);

const SYSTEM_PROMPT = `You are the editor of a popular Israeli arrow crossword (תשחץ חצים) app.
You score answer/clue entries so the generator can build puzzles that feel good to solve.

For every entry return:
- fillScore (1-5): how pleasant is it to discover this ANSWER in the grid?
  5 = vivid, well-known, satisfying (אטלנטיס, שוקולד, ירושלים, פיקאסו)
  4 = solid familiar word or name most Israelis know
  3 = ordinary but fine
  2 = dull filler: bland inflections, generic verbs (אבד, אכלו, שלו)
  1 = obscure, arbitrary or unfair: random abbreviations, forgotten minor figures,
      tiny settlements nobody knows, non-words (אבנץ)
  Short 2-3 letter glue words will usually be 2-3; that is fine, rate them honestly.
- category: one of ${HEBREW_CATEGORIES.join(', ')}
  (people = real persons, bible = Tanakh/Jewish sources, geography = places incl. settlements,
   language = abbreviations, grammar, prefixes/suffixes, word-play glue)
- flag: "wrong" if a clue does not actually lead to the answer or is factually incorrect,
  "obscure" if the answer is unreasonable for a mainstream audience, "stale" if it relies on
  outdated facts (e.g. a former office holder described as current); otherwise null.
- note: very short reason when flagged (English or Hebrew), else omit.
- clues: EVERY existing clue, same text, with difficulty (1 easy, 2 medium, 3 hard) and
  quality (1-5: 5 = precise, fair and a little clever; 3 = correct but flat; 1 = wrong or misleading).
- newClues: if the entry has only one clue, or all its clues have quality <= 3, write 1-2 NEW
  Hebrew clues. Rules: at most ${MAX_CLUE_LENGTH} characters, natural Hebrew, must not contain the answer
  or its root, fair for the stated difficulty, playful when possible (double meanings, wordplay,
  cultural references Israelis enjoy). Keep standard crossword conventions like ש"מ, ר"ת, בקיצור.
  Otherwise return [].

Respond with JSON: {"results":[{"id":number,"fillScore":number,"category":string,"flag":string|null,
"note"?:string,"clues":[{"text":string,"difficulty":number,"quality":number}],
"newClues":[{"text":string,"difficulty":number,"quality":number}]}]}
Return exactly one result per input id.`;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clueText(clue: string | HebrewClue): string {
  return typeof clue === 'string' ? clue : clue.text;
}

function sanitizeClue(raw: any, answer: string): Required<HebrewClue> | null {
  const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
  if (!text || text.length > MAX_CLUE_LENGTH) return null;
  if (!/[\u05D0-\u05EA]/.test(text)) return null;
  const bare = answer.replace(/\s+/g, '');
  if (bare.length >= 3 && text.replace(/\s+/g, '').includes(bare)) return null;
  return {
    text,
    difficulty: clamp(raw.difficulty, 1, 3, 2) as Difficulty,
    quality: clamp(raw.quality, 1, 5, 3),
  };
}

async function callModel(batch: Array<{ index: number; entry: RawHebrewEntry }>): Promise<any[]> {
  const payload = batch.map(({ index, entry }) => ({
    id: index,
    answer: entry.answer,
    clues: entry.clues.map(clueText),
  }));
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ entries: payload }) },
        ],
      }),
    });
    if (res.ok) {
      const body: any = await res.json();
      const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
      if (Array.isArray(parsed.results)) return parsed.results;
    } else if (attempt === 3) {
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error('OpenAI returned no results');
}

function toScoredEntry(index: number, entry: RawHebrewEntry, raw: any): ScoredEntry | null {
  if (!raw) return null;
  const existing = entry.clues.map(clueText);
  const byText = new Map<string, any>();
  for (const c of Array.isArray(raw.clues) ? raw.clues : []) {
    if (typeof c?.text === 'string') byText.set(c.text.trim(), c);
  }
  const clues = existing.map((text) => {
    const scored = byText.get(text.trim());
    return {
      text,
      difficulty: clamp(scored?.difficulty, 1, 3, 2) as Difficulty,
      quality: clamp(scored?.quality, 1, 5, 3),
    };
  });
  const newClues = (Array.isArray(raw.newClues) ? raw.newClues : [])
    .map((c: any) => sanitizeClue(c, entry.answer))
    .filter((c: Required<HebrewClue> | null): c is Required<HebrewClue> => c !== null)
    .filter((c: Required<HebrewClue>) => !existing.includes(c.text))
    .slice(0, 2);
  const category = HEBREW_CATEGORIES.includes(raw.category) ? (raw.category as HebrewCategory) : 'general';
  const flag = ['wrong', 'obscure', 'stale'].includes(raw.flag) ? (raw.flag as EntryFlag) : null;
  return {
    index,
    answer: entry.answer,
    fillScore: clamp(raw.fillScore, 1, 5, 3),
    category,
    flag,
    note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined,
    clues,
    newClues,
  };
}

export function readScores(filePath = DEFAULT_SCORES_FILE): ScoredEntry[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScoredEntry);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required in .env');
  const entries = readHebrewClues();
  const done = new Set(readScores(OUT_FILE).map((s) => `${s.index}:${s.answer}`));

  const queue = entries
    .map((entry, index) => ({ index, entry }))
    .filter(({ index, entry }) => !done.has(`${index}:${entry.answer}`))
    .filter(({ entry }) => entry.answer.replace(/\s+/g, '').length <= MAX_LENGTH)
    .sort((a, b) => a.entry.answer.replace(/\s+/g, '').length - b.entry.answer.replace(/\s+/g, '').length)
    .slice(0, LIMIT);

  console.log(
    `Scoring ${queue.length} entries with ${MODEL} (${done.size} already scored) → ${OUT_FILE}`
  );
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const batches: Array<typeof queue> = [];
  for (let i = 0; i < queue.length; i += BATCH_SIZE) batches.push(queue.slice(i, i + BATCH_SIZE));

  let next = 0;
  let scored = 0;
  let failed = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const results = await callModel(batch);
        const byId = new Map<number, any>(results.map((r) => [Number(r.id), r]));
        const lines: string[] = [];
        for (const { index, entry } of batch) {
          const result = toScoredEntry(index, entry, byId.get(index));
          if (result) lines.push(JSON.stringify(result));
          else failed += 1;
        }
        fs.appendFileSync(OUT_FILE, lines.map((l) => `${l}\n`).join(''), 'utf-8');
        scored += lines.length;
        console.log(`  ${scored}/${queue.length} scored${failed ? ` (${failed} missing)` : ''}`);
      } catch (err) {
        failed += batch.length;
        console.error(`  batch failed: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(`Done: ${scored} scored, ${failed} missing. Re-run to retry missing entries.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
