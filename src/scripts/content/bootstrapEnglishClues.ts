/**
 * Bootstrap englishClues by translating Hebrew answers via MyMemory (no OpenAI key).
 * Produces the same JSONL format as generateEnglishClues.ts for applyEnglishClues.ts.
 *
 * Usage:
 *   npx ts-node src/scripts/content/bootstrapEnglishClues.ts --limit 1200
 *   npx ts-node src/scripts/content/bootstrapEnglishClues.ts --limit 500 --email you@example.com
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import {
  BILINGUAL_PREFERRED_CATEGORIES,
  Difficulty,
  RawHebrewEntry,
  readHebrewClues,
} from '../core/hebrewClueStore';
import {
  DEFAULT_ENGLISH_CLUES_FILE,
  EnglishClueResult,
  readEnglishClueResults,
} from './generateEnglishClues';

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const LIMIT = argValue('--limit') ? parseInt(argValue('--limit')!, 10) : 1200;
const DELAY_MS = parseInt(argValue('--delay', '350')!, 10);
const EMAIL = argValue('--email', process.env.MYMEMORY_EMAIL);
/** Also translate the first Hebrew clue (uses more quota). Default: answer gloss only. */
const ALSO_CLUES = process.argv.includes('--also-clues');
const OUT_FILE = path.resolve(argValue('--out', DEFAULT_ENGLISH_CLUES_FILE)!);
const MAX_CLUE_LENGTH = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function titleCase(text: string): string {
  const t = text.trim().replace(/\.+$/, '');
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function looksEnglish(text: string): boolean {
  return /^[A-Za-z0-9 ,'"!?&/\-()]+$/.test(text) && /[A-Za-z]/.test(text);
}

async function translateHeToEn(text: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: text,
    langpair: 'he|en',
  });
  if (EMAIL) params.set('de', EMAIL);
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body: any = await res.json();
  if (body.quotaFinished) throw new Error('MyMemory daily quota finished');
  const translated = String(body.responseData?.translatedText ?? '').trim();
  if (!translated || /INVALID|QUERY LENGTH|NO QUERY/i.test(translated)) return null;
  // Sometimes returns the Hebrew unchanged
  if (/[\u0590-\u05FF]/.test(translated)) return null;
  return translated;
}

function shouldQueue(entry: RawHebrewEntry): boolean {
  if (entry.englishClues && entry.englishClues.length > 0) return false;
  const category = entry.category ?? 'general';
  return BILINGUAL_PREFERRED_CATEGORIES.has(category as any);
}

function toClue(text: string, difficulty: Difficulty, quality: number) {
  const cleaned = titleCase(text).slice(0, MAX_CLUE_LENGTH);
  if (!cleaned || !looksEnglish(cleaned)) return null;
  return { text: cleaned, difficulty, quality };
}

async function main() {
  const entries = readHebrewClues();
  const done = new Set(readEnglishClueResults(OUT_FILE).map((s) => `${s.index}:${s.answer}`));

  const queue = entries
    .map((entry, index) => ({ index, entry }))
    .filter(({ index, entry }) => !done.has(`${index}:${entry.answer}`))
    .filter(({ entry }) => shouldQueue(entry))
    .sort((a, b) => (b.entry.fillScore ?? 3) - (a.entry.fillScore ?? 3))
    .slice(0, LIMIT);

  console.log(
    `Bootstrapping English clues via MyMemory for ${queue.length} answers ` +
      `(${done.size} already in ${OUT_FILE}${EMAIL ? `, email=${EMAIL}` : ', anonymous quota'})`
  );
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  let written = 0;
  let skipped = 0;
  for (const { index, entry } of queue) {
    try {
      const gloss = await translateHeToEn(entry.answer);
      await sleep(DELAY_MS);
      const englishClues: EnglishClueResult['englishClues'] = [];
      if (gloss) {
        const clue = toClue(gloss, 1, 4);
        if (clue) englishClues.push(clue);
      }
      if (ALSO_CLUES) {
        const firstHe =
          typeof entry.clues[0] === 'string' ? entry.clues[0] : entry.clues[0]?.text;
        if (firstHe && firstHe.length <= 24) {
          const clueGloss = await translateHeToEn(firstHe);
          await sleep(DELAY_MS);
          if (clueGloss) {
            const clue = toClue(clueGloss, 2, 3);
            if (clue && !englishClues.some((c) => c.text === clue.text)) {
              englishClues.push(clue);
            }
          }
        }
      }

      const result: EnglishClueResult = {
        index,
        answer: entry.answer,
        category: entry.category ?? 'general',
        skip: englishClues.length === 0,
        reason: englishClues.length === 0 ? 'no translation' : undefined,
        englishClues,
      };
      fs.appendFileSync(OUT_FILE, `${JSON.stringify(result)}\n`, 'utf-8');
      if (result.skip) skipped += 1;
      else written += 1;
      if ((written + skipped) % 25 === 0) {
        console.log(`  ${written + skipped}/${queue.length} (${written} ok, ${skipped} skipped)`);
      }
    } catch (err) {
      console.error(`Stopping: ${(err as Error).message}`);
      break;
    }
  }

  console.log(
    `Done: ${written} with clues, ${skipped} skipped. Apply with: npm run apply:english-clues`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
