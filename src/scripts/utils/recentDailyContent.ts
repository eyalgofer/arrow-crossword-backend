import fs from 'fs';
import { DailyPuzzle } from '../../models/DailyPuzzle';
import { Puzzle } from '../../models/Puzzle';

export interface RecentDailyContent {
  answers: string[];
  clues: string[];
}

/** Text answers and clues of Hebrew dailies from `days` ago onward, including already-scheduled ones. */
export async function loadRecentDailyContent(days = 14): Promise<RecentDailyContent> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dailies = await DailyPuzzle.find({ language: 'he', date: { $gte: since } }).lean();
  const puzzles = await Puzzle.find({ _id: { $in: dailies.map((d) => d.puzzleId) } }).lean();
  const answers = new Set<string>();
  const clues = new Set<string>();
  for (const puzzle of puzzles) {
    for (const item of puzzle.puzzleItems ?? []) {
      if (item.clueType === 'image') continue;
      if (item.answer) answers.add(item.answer);
      if (item.clue) clues.add(item.clue);
    }
  }
  return { answers: [...answers], clues: [...clues] };
}

export function writeRecentDailyContent(file: string, content: RecentDailyContent): void {
  fs.writeFileSync(file, JSON.stringify(content));
}

export function readRecentDailyContent(file: string | undefined): RecentDailyContent {
  if (!file || !fs.existsSync(file)) return { answers: [], clues: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RecentDailyContent;
}
