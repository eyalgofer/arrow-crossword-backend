/**
 * Converts a solved grid state into a complete puzzle with clues,
 * and validates that every answer obeys the boundary rule.
 */

import { Puzzle, PuzzleItem, GridTemplate, Difficulty, Language } from '../core/types';
import { GridState } from './grid-state';
import { getSlotCells } from './direction-utils';
import { normalizeWord, validateWordBoundaries } from './validation-utils';
import { getClueProvider, ClueProvider } from '../core/clueProvider';

const MAX_CLUE_LENGTH_BY_LANG: Record<string, number> = {
  he: 28,
  en: 50,
};

/**
 * Pick a clue for a word. Hebrew clues stay in curated file order;
 * English clues are already sorted best-first in the CSV database.
 * Hebrew תשחץ cells only fit a short definition, so we keep that pool tight.
 */
export type ClueDifficulty = 1 | 2 | 3;

export interface ClueDifficultyWeights {
  1: number;
  2: number;
  3: number;
}

/** Share of clue difficulties 1 / 2 / 3. Every board still includes easy clues. */
export const PACKAGE_CLUE_WEIGHTS: Record<'easy' | 'medium' | 'hard', ClueDifficultyWeights> = {
  easy: { 1: 70, 2: 25, 3: 5 },
  medium: { 1: 30, 2: 50, 3: 20 },
  hard: { 1: 20, 2: 35, 3: 45 },
};

export interface ClueSelection {
  /** 1 easy … 3 hard; clues closer to it win when difficultyWeights is unset. */
  targetDifficulty: number;
  /** When set, each clue samples a bucket, then takes the best clue in that bucket. */
  difficultyWeights?: ClueDifficultyWeights;
  /** Clue texts shown recently (e.g. last weeks' dailies) — used only as a last resort. */
  avoidClues?: Set<string>;
}

export function sampleClueDifficulty(
  weights: ClueDifficultyWeights,
  random: () => number = Math.random
): ClueDifficulty {
  const total = weights[1] + weights[2] + weights[3];
  if (total <= 0) return 1;
  let roll = random() * total;
  if (roll < weights[1]) return 1;
  roll -= weights[1];
  if (roll < weights[2]) return 2;
  return 3;
}

export function dominantClueDifficulty(weights: ClueDifficultyWeights): ClueDifficulty {
  const buckets: ClueDifficulty[] = [1, 2, 3];
  return buckets.reduce((best, bucket) => (weights[bucket] > weights[best] ? bucket : best));
}

/**
 * Realized mean clue difficulty must match the package label.
 * Easy stays at or under 1.6, medium sits in 1.55–2.25, hard stays at or above 2.15.
 */
export function clueDifficultyMeanOk(label: 'easy' | 'medium' | 'hard', mean: number): boolean {
  if (label === 'easy') return mean <= 1.6;
  if (label === 'medium') return mean >= 1.55 && mean <= 2.25;
  return mean >= 2.15;
}

export function meanChosenClueDifficulty(
  items: Array<{ clue: string; answer: string; clueType?: string }>,
  scoredCluesFor: (answer: string) => Array<{ text: string; difficulty: number }>
): number | null {
  return chosenClueDifficultyStats(items, scoredCluesFor)?.mean ?? null;
}

export function chosenClueDifficultyStats(
  items: Array<{ clue: string; answer: string; clueType?: string }>,
  scoredCluesFor: (answer: string) => Array<{ text: string; difficulty: number }>
): { mean: number; easyShare: number } | null {
  const difficulties: number[] = [];
  for (const item of items) {
    if (item.clueType === 'image') continue;
    const match = scoredCluesFor(item.answer)?.find((clue) => clue.text === item.clue);
    if (match) difficulties.push(match.difficulty);
  }
  if (difficulties.length === 0) return null;
  const mean = difficulties.reduce((sum, difficulty) => sum + difficulty, 0) / difficulties.length;
  const easyShare = difficulties.filter((difficulty) => difficulty === 1).length / difficulties.length;
  return { mean, easyShare };
}

/** Mean must match the label, and medium/hard boards must still include easy clues. */
export function clueMixOk(
  label: 'easy' | 'medium' | 'hard',
  mean: number,
  easyShare: number
): boolean {
  if (!clueDifficultyMeanOk(label, mean)) return false;
  if (label === 'easy') return true;
  return easyShare >= 0.1;
}

function nearestDifficultyBucket<T extends { difficulty: ClueDifficulty }>(
  clues: T[],
  target: ClueDifficulty,
  prefer?: ClueDifficulty
): T[] {
  for (const distance of [0, 1, 2]) {
    let bucket = clues.filter((clue) => Math.abs(clue.difficulty - target) === distance);
    if (bucket.length === 0) continue;
    if (prefer != null && bucket.some((clue) => clue.difficulty === prefer)) {
      bucket = bucket.filter((clue) => clue.difficulty === prefer);
    }
    return bucket;
  }
  return clues;
}

/** Scored pick: best quality near the target difficulty, a little noise so repeats vary. */
function pickScoredClue(
  word: string,
  usedClues: Set<string>,
  provider: ClueProvider,
  maxLen: number,
  selection: ClueSelection
): string | null {
  const clues = (provider.getScoredClues?.(word) ?? []).filter((c) => c.text.length <= maxLen);
  if (clues.length === 0) return null;
  const pool = selection.difficultyWeights
    ? nearestDifficultyBucket(
        clues,
        sampleClueDifficulty(selection.difficultyWeights),
        dominantClueDifficulty(selection.difficultyWeights)
      )
    : clues;
  const ranked = pool
    .map((c) => ({
      text: c.text,
      value:
        c.quality * 2 -
        (selection.difficultyWeights ? 0 : Math.abs(c.difficulty - selection.targetDifficulty) * 1.5) -
        (usedClues.has(c.text) ? 100 : 0) -
        (selection.avoidClues?.has(c.text) ? 6 : 0) +
        Math.random() * 1.2,
    }))
    .sort((a, b) => b.value - a.value);
  return ranked[0].text;
}

function pickClue(
  word: string,
  usedClues: Set<string>,
  provider: ClueProvider,
  language: Language,
  selection?: ClueSelection
): string {
  const maxLen = MAX_CLUE_LENGTH_BY_LANG[language] ?? 50;
  if (selection && provider.getScoredClues) {
    const scored = pickScoredClue(word, usedClues, provider, maxLen, selection);
    if (scored) return scored;
  }
  const clues = provider.getCluesForWord(word).filter(c => c.length <= maxLen);
  if (clues.length === 0) {
    throw new Error(`No clue available for word "${word}" - word pool and clue database are out of sync`);
  }
  const unused = clues.filter(c => !usedClues.has(c));
  const take = language === 'he' ? 2 : 3;
  const pool = (unused.length > 0 ? unused : clues).slice(0, take);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generatePuzzleFromGrid(
  template: GridTemplate,
  gridState: GridState,
  config: {
    title: string;
    category: string;
    language?: Language;
    clueSelection?: ClueSelection;
  }
): Puzzle {
  const language: Language = config.language ?? 'en';
  const clueProvider = getClueProvider(language);

  const puzzleItems: PuzzleItem[] = [];
  const slotIdToClueNumber = new Map<string, number>();
  const usedClues = new Set<string>();
  const usedAnswers = new Set<string>();

  let puzzleItemNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }

    const normalizedAnswer = normalizeWord(word);
    if (usedAnswers.has(normalizedAnswer)) {
      // Duplicates are prevented during solving; skip defensively if one slips through
      console.warn(`⚠️  Duplicate answer "${word}" detected - skipping clue`);
      puzzleItemNumber++;
      continue;
    }

    const clueNumber = puzzleItemNumber++;
    slotIdToClueNumber.set(slot.id, clueNumber);

    if (slot.clueType === 'image') {
      const imageAnswer = slot.fixedAnswer ?? word;
      const imageParts = imageAnswer.split(/\s+/).filter(Boolean);
      const imageEnumeration =
        slot.fixedEnumeration !== undefined
          ? slot.fixedEnumeration
          : imageParts.length > 1
            ? imageParts.map(part => Array.from(part).length)
            : null;
      const imageUrl =
        slot.imageUrl ||
        slot.imageUrlByAnswer?.[imageAnswer] ||
        slot.imageUrlByAnswer?.[normalizeWord(imageAnswer)];
      usedAnswers.add(normalizeWord(imageAnswer));
      puzzleItems.push({
        number: clueNumber,
        direction: slot.direction,
        clue: 'IMAGE',
        answer: imageParts.length > 1 ? imageParts.join(' ') : normalizeWord(imageAnswer),
        enumeration: imageEnumeration,
        startRow: slot.startRow,
        startCol: slot.startCol,
        clueType: 'image',
        imageUrl,
        exitRow: slot.exitRow,
        exitCol: slot.exitCol,
      });
      continue;
    }

    const clueText = pickClue(word, usedClues, clueProvider, language, config.clueSelection);
    usedClues.add(clueText);
    usedAnswers.add(normalizedAnswer);

    const wordParts = word.split(/\s+/).filter(Boolean);
    const enumeration =
      wordParts.length > 1 ? wordParts.map(part => Array.from(part).length) : null;

    puzzleItems.push({
      number: clueNumber,
      direction: slot.direction,
      clue: clueText,
      answer: wordParts.length > 1 ? wordParts.join(' ') : normalizedAnswer,
      enumeration,
      startRow: slot.startRow,
      startCol: slot.startCol,
      clueType: 'text',
    });
  }

  // --------------------------------------------------------------------------
  // Boundary validation: the cell before/after every answer must be a clue
  // cell, blocked cell, or the grid edge. Uses the same slot geometry the
  // solver filled (getSlotCells).
  // --------------------------------------------------------------------------
  const clueCellPositions = new Set<string>();
  const answerCellPositions = new Set<string>();
  for (const slot of template.slots) {
    if (!gridState.placedWords.has(slot.id)) continue;
    if (slot.clueType === 'image' && slot.exitRow != null && slot.exitCol != null) {
      clueCellPositions.add(`${slot.exitRow},${slot.exitCol}`);
      // Whole 3×3 counts as blocked/clue footprint for boundary purposes
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          clueCellPositions.add(`${slot.startRow + dr},${slot.startCol + dc}`);
        }
      }
    } else {
      clueCellPositions.add(`${slot.startRow},${slot.startCol}`);
    }
    for (const c of getSlotCells(slot)) {
      answerCellPositions.add(`${c.row},${c.col}`);
    }
  }

  const blockedCellPositions = new Set<string>();
  for (let r = 0; r < template.rows; r++) {
    for (let c = 0; c < template.cols; c++) {
      const key = `${r},${c}`;
      if (!clueCellPositions.has(key) && !answerCellPositions.has(key)) {
        blockedCellPositions.add(key);
      }
    }
  }

  const validationErrors: string[] = [];
  for (const slot of template.slots) {
    if (!gridState.placedWords.has(slot.id)) continue;
    const answerCells = getSlotCells(slot);
    if (answerCells.length === 0) continue;

    const validation = validateWordBoundaries(
      slot.direction,
      answerCells,
      template.rows,
      template.cols,
      clueCellPositions,
      answerCellPositions,
      blockedCellPositions
    );

    if (!validation.isValid) {
      const clueNumber = slotIdToClueNumber.get(slot.id);
      validationErrors.push(`Clue #${clueNumber} (${slot.direction}): ${validation.reason}`);
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(
      `Puzzle validation failed: ${validationErrors.length} clues violate boundary rule: ${validationErrors.slice(0, 5).join('; ')}`
    );
  }

  return {
    difficulty: Difficulty.MEDIUM,
    title: config.title,
    category: config.category,
    language,
    grid: { rows: template.rows, cols: template.cols },
    puzzleItems,
    estimatedTime: puzzleItems.length * 20,
    coinReward: Math.ceil(puzzleItems.length / 4),
    metadata: {
      templateId: template.id,
      generationMethod: 'algorithmic',
    },
  };
}
