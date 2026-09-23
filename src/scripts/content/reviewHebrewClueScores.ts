/**
 * Review LLM clue scores, then merge them into hebrewClues.json.
 *
 *   export — writes a TSV (open in Google Sheets / Excel) with every entry scored 1 or 5,
 *            every flagged entry, and a random sample of the rest:
 *     npx ts-node src/scripts/content/reviewHebrewClueScores.ts export --sample 200
 *
 *   Edit the `keep`, `fillScore`, `category`, `excludeFromDaily` and `newClues` columns.
 *   keep=n drops the LLM result for that entry. newClues are separated by " | ".
 *
 *   merge  — applies all scores; reviewed rows use your edits:
 *     npx ts-node src/scripts/content/reviewHebrewClueScores.ts merge
 *     npx ts-node src/scripts/content/reviewHebrewClueScores.ts merge --dry-run
 *
 * Entries flagged "wrong" or "obscure" become excludeFromDaily unless the review says otherwise.
 */

import fs from 'fs';
import path from 'path';
import {
  HEBREW_CATEGORIES,
  HebrewCategory,
  HebrewClue,
  RawHebrewEntry,
  readHebrewClues,
  writeHebrewClues,
} from '../core/hebrewClueStore';
import { DEFAULT_SCORES_FILE, ScoredEntry, readScores } from './scoreHebrewClues';

const DEFAULT_REVIEW_FILE = path.join(__dirname, '../../../tmp/hebrew-clue-review.tsv');

const COLUMNS = [
  'index',
  'answer',
  'keep',
  'fillScore',
  'category',
  'excludeFromDaily',
  'flag',
  'note',
  'clues',
  'newClues',
  'reason',
] as const;

interface ReviewRow {
  index: number;
  answer: string;
  keep: boolean;
  fillScore: number;
  category: HebrewCategory;
  excludeFromDaily: boolean;
  newClues: string[];
}

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function cell(value: string): string {
  return value.replace(/[\t\n\r]+/g, ' ');
}

function shouldExclude(score: ScoredEntry): boolean {
  return score.flag === 'wrong' || score.flag === 'obscure' || score.fillScore <= 1;
}

function exportReview(scores: ScoredEntry[], sampleSize: number, outFile: string): void {
  const picked = new Map<number, string>();
  for (const s of scores) {
    if (s.flag) picked.set(s.index, `flag:${s.flag}`);
    else if (s.fillScore === 1) picked.set(s.index, 'fill=1');
    else if (s.fillScore === 5) picked.set(s.index, 'fill=5');
  }
  const rest = scores.filter((s) => !picked.has(s.index));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  for (const s of rest.slice(0, sampleSize)) picked.set(s.index, 'sample');

  const rows = scores
    .filter((s) => picked.has(s.index))
    .map((s) =>
      [
        String(s.index),
        s.answer,
        'y',
        String(s.fillScore),
        s.category,
        shouldExclude(s) ? 'y' : 'n',
        s.flag ?? '',
        s.note ?? '',
        s.clues.map((c) => `${c.text} (d${c.difficulty} q${c.quality})`).join(' | '),
        s.newClues.map((c) => c.text).join(' | '),
        picked.get(s.index)!,
      ]
        .map(cell)
        .join('\t')
    );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, [COLUMNS.join('\t'), ...rows].join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${rows.length} rows for review → ${outFile}`);
}

function readReview(file: string): Map<number, ReviewRow> {
  const reviewed = new Map<number, ReviewRow>();
  if (!fs.existsSync(file)) return reviewed;
  const [header, ...lines] = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter((l) => l.trim());
  const cols = header.split('\t');
  const at = (parts: string[], name: string) => (parts[cols.indexOf(name)] ?? '').trim();
  for (const line of lines) {
    const parts = line.split('\t');
    const index = parseInt(at(parts, 'index'), 10);
    if (!Number.isInteger(index)) continue;
    const category = at(parts, 'category') as HebrewCategory;
    reviewed.set(index, {
      index,
      answer: at(parts, 'answer'),
      keep: !/^n/i.test(at(parts, 'keep')),
      fillScore: Math.min(5, Math.max(1, parseInt(at(parts, 'fillScore'), 10) || 3)),
      category: HEBREW_CATEGORIES.includes(category) ? category : 'general',
      excludeFromDaily: /^y/i.test(at(parts, 'excludeFromDaily')),
      newClues: at(parts, 'newClues')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean),
    });
  }
  return reviewed;
}

function mergeEntry(entry: RawHebrewEntry, score: ScoredEntry, review?: ReviewRow): RawHebrewEntry {
  const scoredByText = new Map(score.clues.map((c) => [c.text, c]));
  const clues: HebrewClue[] = entry.clues.map((clue) => {
    const text = typeof clue === 'string' ? clue : clue.text;
    const scored = scoredByText.get(text);
    return scored ? { text, difficulty: scored.difficulty, quality: scored.quality } : typeof clue === 'string' ? { text } : clue;
  });
  const llmNew = new Map(score.newClues.map((c) => [c.text, c]));
  const newTexts = review ? review.newClues : score.newClues.map((c) => c.text);
  for (const text of newTexts) {
    if (clues.some((c) => c.text === text)) continue;
    const fromLlm = llmNew.get(text);
    clues.push(fromLlm ? { ...fromLlm } : { text, difficulty: 2, quality: 4 });
  }
  return {
    ...entry,
    fillScore: review ? review.fillScore : score.fillScore,
    category: review ? review.category : score.category,
    excludeFromDaily: (review ? review.excludeFromDaily : shouldExclude(score)) || undefined,
    clues,
  };
}

function merge(scores: ScoredEntry[], reviewFile: string, dryRun: boolean): void {
  const entries = readHebrewClues();
  const reviewed = readReview(reviewFile);
  let merged = 0;
  let dropped = 0;
  let mismatched = 0;
  const indexByAnswer = new Map<string, number>();
  entries.forEach((e, i) => {
    if (!indexByAnswer.has(e.answer)) indexByAnswer.set(e.answer, i);
  });
  for (const score of scores) {
    const index =
      entries[score.index]?.answer === score.answer ? score.index : indexByAnswer.get(score.answer);
    if (index === undefined) {
      mismatched += 1;
      continue;
    }
    const review = reviewed.get(score.index);
    if (review && !review.keep) {
      dropped += 1;
      continue;
    }
    entries[index] = mergeEntry(entries[index], score, review);
    merged += 1;
  }
  console.log(
    `Merged ${merged} (${reviewed.size} reviewed, ${dropped} dropped, ${mismatched} index mismatches)`
  );
  const excluded = entries.filter((e) => e.excludeFromDaily).length;
  console.log(`excludeFromDaily: ${excluded} entries`);
  if (dryRun) {
    console.log('Dry run — hebrewClues.json unchanged');
    return;
  }
  writeHebrewClues(entries);
  console.log('✅ hebrewClues.json updated');
}

function main() {
  const command = process.argv[2];
  const scores = readScores(path.resolve(argValue('--scores', DEFAULT_SCORES_FILE)!));
  const reviewFile = path.resolve(argValue('--review', DEFAULT_REVIEW_FILE)!);
  if (scores.length === 0) throw new Error('No scores found — run scoreHebrewClues.ts first');
  if (command === 'export') {
    exportReview(scores, parseInt(argValue('--sample', '200')!, 10), reviewFile);
  } else if (command === 'merge') {
    merge(scores, reviewFile, process.argv.includes('--dry-run'));
  } else {
    throw new Error('Usage: reviewHebrewClueScores.ts export|merge [--scores file] [--review file]');
  }
}

main();
