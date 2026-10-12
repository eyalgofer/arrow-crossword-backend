/**
 * Merge generated English clues from JSONL into hebrewClues.json.
 *
 * Matches by answer (index is best-effort only — file order can drift across runs).
 *
 *   npx ts-node src/scripts/content/applyEnglishClues.ts
 *   npx ts-node src/scripts/content/applyEnglishClues.ts --dry-run
 *   npx ts-node src/scripts/content/applyEnglishClues.ts --min-quality 3
 */

import path from 'path';
import { readHebrewClues, writeHebrewClues } from '../core/hebrewClueStore';
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

const DRY_RUN = process.argv.includes('--dry-run');
const MIN_QUALITY = parseInt(argValue('--min-quality', '3')!, 10);
const IN_FILE = path.resolve(argValue('--in', DEFAULT_ENGLISH_CLUES_FILE)!);

function main() {
  const entries = readHebrewClues();
  const results = readEnglishClueResults(IN_FILE);
  if (results.length === 0) {
    throw new Error(`No results in ${IN_FILE}. Run generateEnglishClues.ts first.`);
  }

  const byAnswer = new Map<string, number>();
  for (let i = 0; i < entries.length; i++) {
    byAnswer.set(entries[i].answer, i);
  }

  // Later lines win per answer (resume / retries).
  const bestByAnswer = new Map<string, EnglishClueResult>();
  for (const result of results) {
    bestByAnswer.set(result.answer, result);
  }

  let applied = 0;
  let skipped = 0;
  let missing = 0;

  for (const result of bestByAnswer.values()) {
    if (result.skip || result.englishClues.length === 0) {
      skipped += 1;
      continue;
    }
    const idx = byAnswer.get(result.answer);
    if (idx === undefined) {
      missing += 1;
      continue;
    }
    const clues = result.englishClues.filter((c) => c.quality >= MIN_QUALITY);
    if (clues.length === 0) {
      skipped += 1;
      continue;
    }
    entries[idx].englishClues = clues;
    applied += 1;
  }

  console.log(
    `${DRY_RUN ? 'Dry run — would apply' : 'Applying'} ${applied} englishClues ` +
      `(skipped ${skipped}, unmatched answers ${missing}) from ${IN_FILE}`
  );

  if (!DRY_RUN) {
    writeHebrewClues(entries);
    console.log(`Wrote ${entries.length} entries to hebrewClues.json`);
  }
}

main();
