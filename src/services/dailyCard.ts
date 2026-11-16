export interface DailyCardProgress {
  isCompleted?: boolean;
  completedCluesCount?: number;
  totalClues?: number;
  bestTime?: number | null;
  elapsedTime?: number | null;
}

export interface DailyCardPuzzle {
  _id: string;
  difficulty: string;
  grid: { rows: number; cols: number };
  isCompleted: boolean;
  isInProgress: boolean;
  progress: number;
  bestTime: number | null;
  elapsedTime: number | null;
  completedCluesCount: number;
  totalClues: number;
}

export function viewerProgress(row: DailyCardProgress | null | undefined): {
  isCompleted: boolean;
  isInProgress: boolean;
  progress: number;
  completedCluesCount: number;
  totalClues: number;
  bestTime: number | null;
  elapsedTime: number | null;
} {
  const isCompleted = row?.isCompleted === true;
  const totalClues = typeof row?.totalClues === 'number' ? row.totalClues : 0;
  const completedCluesCount =
    typeof row?.completedCluesCount === 'number' ? row.completedCluesCount : 0;
  const progress = isCompleted
    ? 100
    : totalClues > 0
      ? Math.min(100, Math.max(0, Math.round((completedCluesCount / totalClues) * 100)))
      : 0;
  return {
    isCompleted,
    isInProgress: !isCompleted && progress > 0,
    progress,
    completedCluesCount,
    totalClues,
    bestTime: typeof row?.bestTime === 'number' ? row.bestTime : null,
    elapsedTime: typeof row?.elapsedTime === 'number' ? row.elapsedTime : null,
  };
}

/** Play-tab daily card. No clues, answers, or cells. */
export function toDailyCard(
  puzzle: {
    _id: unknown;
    difficulty?: string | null;
    grid?: { rows?: number; cols?: number } | null;
  },
  progress: DailyCardProgress | null | undefined
): DailyCardPuzzle {
  return {
    _id: String(puzzle._id),
    difficulty: puzzle.difficulty || 'easy',
    grid: {
      rows: puzzle.grid?.rows ?? 0,
      cols: puzzle.grid?.cols ?? 0,
    },
    ...viewerProgress(progress),
  };
}
