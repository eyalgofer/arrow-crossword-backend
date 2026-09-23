import { Puzzle } from '../core/types';
import { getClueProvider } from '../core/clueProvider';

export interface ContentStats {
  avgFillScore: number;
  lowFillWords: string[];
  avgClueQuality: number;
  topCategory: string;
  topCategoryCount: number;
}

export function contentStats(puzzle: Puzzle): ContentStats {
  const provider = getClueProvider('he');
  const fill: number[] = [];
  const quality: number[] = [];
  const lowFillWords: string[] = [];
  const categories = new Map<string, number>();
  for (const item of puzzle.puzzleItems) {
    if (item.clueType === 'image') continue;
    const meta = provider.getWordMeta?.(item.answer);
    if (meta) {
      fill.push(meta.fillScore);
      if (meta.fillScore <= 2) lowFillWords.push(item.answer);
      if (meta.category) categories.set(meta.category, (categories.get(meta.category) ?? 0) + 1);
    }
    const clue = provider.getScoredClues?.(item.answer).find((c) => c.text === item.clue);
    if (clue) quality.push(clue.quality);
  }
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const [topCategory, topCategoryCount] = [...categories].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  return { avgFillScore: avg(fill), lowFillWords, avgClueQuality: avg(quality), topCategory, topCategoryCount };
}
