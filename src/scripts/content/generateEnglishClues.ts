/**
 * Generate English gloss clues for hebrewClues.json answers (vocab-learning packs).
 * Writes JSONL for resume; apply with applyEnglishClues.ts.
 *
 * Prefers general/science/food/culture/sport/language. Skips obscure Israel-local entries.
 *
 * Usage:
 *   npx ts-node src/scripts/content/generateEnglishClues.ts --limit 500
 *   npx ts-node src/scripts/content/generateEnglishClues.ts --model gpt-5.5 --concurrency 6
 *   npx ts-node src/scripts/content/generateEnglishClues.ts --include-local  # also geography/people/bible
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import {
  BILINGUAL_PREFERRED_CATEGORIES,
  Difficulty,
  HebrewClue,
  RawHebrewEntry,
  readHebrewClues,
} from '../core/hebrewClueStore';

export const DEFAULT_ENGLISH_CLUES_FILE = path.join(
  __dirname,
  '../../../tmp/hebrew-english-clues.jsonl'
);

export interface EnglishClueResult {
  index: number;
  answer: string;
  category: string;
  skip: boolean;
  reason?: string;
  englishClues: Array<Required<HebrewClue>>;
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
const INCLUDE_LOCAL = process.argv.includes('--include-local');
const OUT_FILE = path.resolve(argValue('--out', DEFAULT_ENGLISH_CLUES_FILE)!);
const MAX_CLUE_LENGTH = 50;

const SYSTEM_PROMPT = `You write English crossword clues for Hebrew answers in an Israeli app that teaches English vocabulary.
Each entry has a Hebrew answer (and optional Hebrew clues for context only). Produce 1–3 short English clues that lead to that Hebrew word when the solver knows Hebrew.

Rules:
- Clues are in English; the answer the solver fills is the Hebrew word.
- Prefer simple vocab glosses ("Father", "Chocolate", "Capital of France") over translating witty Hebrew wordplay.
- At most ${MAX_CLUE_LENGTH} characters per clue. No Hebrew letters in the clue text.
- Do not include the English transliteration of the answer as the only clue when a real gloss exists.
- difficulty: 1 easy, 2 medium, 3 hard. quality: 1–5 (5 = precise and fair).
- If the answer is an obscure Israeli place, minor celeb, abbreviation, or has no fair English gloss for language learners, set skip=true and explain in reason. Otherwise skip=false and give englishClues.

Respond with JSON:
{"results":[{"id":number,"skip":boolean,"reason"?:string,"englishClues":[{"text":string,"difficulty":number,"quality":number}]}]}
Return exactly one result per input id.`;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clueText(clue: string | HebrewClue): string {
  return typeof clue === 'string' ? clue : clue.text;
}

function sanitizeEnglishClue(raw: any, answer: string): Required<HebrewClue> | null {
  const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
  if (!text || text.length > MAX_CLUE_LENGTH) return null;
  if (/[\u0590-\u05FF]/.test(text)) return null;
  const bare = answer.replace(/\s+/g, '');
  if (bare.length >= 3 && text.replace(/\s+/g, '').toLowerCase().includes(bare.toLowerCase())) {
    return null;
  }
  return {
    text,
    difficulty: clamp(raw.difficulty, 1, 3, 2) as Difficulty,
    quality: clamp(raw.quality, 1, 5, 3),
  };
}

async function callModel(
  batch: Array<{ index: number; entry: RawHebrewEntry }>
): Promise<any[]> {
  const payload = batch.map(({ index, entry }) => ({
    id: index,
    answer: entry.answer,
    category: entry.category ?? 'general',
    hebrewClues: entry.clues.map(clueText).slice(0, 3),
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

function toResult(
  index: number,
  entry: RawHebrewEntry,
  raw: any
): EnglishClueResult | null {
  if (!raw) return null;
  const skip = raw.skip === true;
  const englishClues = (Array.isArray(raw.englishClues) ? raw.englishClues : [])
    .map((c: any) => sanitizeEnglishClue(c, entry.answer))
    .filter((c: Required<HebrewClue> | null): c is Required<HebrewClue> => c !== null)
    .slice(0, 3);
  if (!skip && englishClues.length === 0) {
    return {
      index,
      answer: entry.answer,
      category: entry.category ?? 'general',
      skip: true,
      reason: typeof raw.reason === 'string' ? raw.reason : 'no usable English clues',
      englishClues: [],
    };
  }
  return {
    index,
    answer: entry.answer,
    category: entry.category ?? 'general',
    skip,
    reason: typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason.trim() : undefined,
    englishClues: skip ? [] : englishClues,
  };
}

export function readEnglishClueResults(filePath = DEFAULT_ENGLISH_CLUES_FILE): EnglishClueResult[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EnglishClueResult);
}

function shouldQueue(entry: RawHebrewEntry): boolean {
  if (entry.englishClues && entry.englishClues.length > 0) return false;
  const category = entry.category ?? 'general';
  if (!INCLUDE_LOCAL && !BILINGUAL_PREFERRED_CATEGORIES.has(category as any)) return false;
  return true;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required in .env');
  const entries = readHebrewClues();
  const done = new Set(readEnglishClueResults(OUT_FILE).map((s) => `${s.index}:${s.answer}`));

  const queue = entries
    .map((entry, index) => ({ index, entry }))
    .filter(({ index, entry }) => !done.has(`${index}:${entry.answer}`))
    .filter(({ entry }) => shouldQueue(entry))
    .sort((a, b) => (b.entry.fillScore ?? 3) - (a.entry.fillScore ?? 3))
    .slice(0, LIMIT);

  console.log(
    `Generating English clues for ${queue.length} entries with ${MODEL} ` +
      `(${done.size} already done; preferred categories${!INCLUDE_LOCAL ? ' only' : ' + local'}) → ${OUT_FILE}`
  );
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const batches: Array<typeof queue> = [];
  for (let i = 0; i < queue.length; i += BATCH_SIZE) batches.push(queue.slice(i, i + BATCH_SIZE));

  let next = 0;
  let written = 0;
  let skipped = 0;
  let failed = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const results = await callModel(batch);
        const byId = new Map<number, any>(results.map((r) => [Number(r.id), r]));
        const lines: string[] = [];
        for (const { index, entry } of batch) {
          const result = toResult(index, entry, byId.get(index));
          if (!result) {
            failed += 1;
            continue;
          }
          if (result.skip) skipped += 1;
          lines.push(JSON.stringify(result));
        }
        fs.appendFileSync(OUT_FILE, lines.map((l) => `${l}\n`).join(''), 'utf-8');
        written += lines.length;
        console.log(
          `  ${written}/${queue.length} written (${skipped} skipped, ${failed} missing)`
        );
      } catch (err) {
        failed += batch.length;
        console.error(`  batch failed: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(
    `Done: ${written} written, ${skipped} skipped, ${failed} missing. ` +
      `Apply with: npx ts-node src/scripts/content/applyEnglishClues.ts`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
