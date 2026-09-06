import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

/** Content languages served by the API. Israeli users receive 'he'. */
export type Language = 'en' | 'he';

export const DEFAULT_LANGUAGE: Language = 'en';

export interface UserStats {
  totalGames: number;
  gamesWon: number;
  gamesLost: number;
  totalTime: number;
  averageTime: number;
  fastestTime: number;
}

export type ClueType = 'text' | 'image';

export interface PuzzleItem {
  number: number;
  direction: 'across' | 'down' | 'right-down' | 'left-down' | 'down-across' | 'up-across';
  clue: string;
  answer: string;
  startRow: number;
  startCol: number;
  enumeration?: number[] | null;
  /** Defaults to 'text' when omitted. */
  clueType?: ClueType;
  /** Image URL when clueType === 'image'. */
  imageUrl?: string;
  /** Perimeter cell of the 3×3 image used for direction/arrow math. */
  exitRow?: number;
  exitCol?: number;
}

export interface PuzzleGrid {
  rows: number;
  cols: number;
}

export enum MatchStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum MatchMode {
  QUICK = 'quick',
  NORMAL = 'normal'
}

export enum MatchCompletionReason {
  COMPLETED = 'completed',
  BOARD_COMPLETED = 'board_completed',
  TIMEOUT = 'timeout',
  FORFEIT = 'forfeit'
}

export interface ClaimedWord {
  clueId: string;
  answer: string;
  userId?: any; // Can be ObjectId or string
  displayName: string;
  claimedAt: Date;
}

export interface PlayerMove {
  userId?: any; // Can be ObjectId or string
  row: number;
  col: number;
  letter: string;
  timestamp: Date;
}

export interface GameState {
  matchId: string;
  players: {
    userId: string;
    displayName: string;
    photoURL?: string;
    progress: number;
    claimedCount: number;
  }[];
  puzzleId: string;
  moves: PlayerMove[];
  claimedWords: ClaimedWord[];
  mode: MatchMode;
  timed: boolean;
  startedAt?: Date;
  durationSeconds?: number | null;
  endsAt?: Date | null;
  completedAt?: Date;
}

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  CHALLENGING = 'challenging',
  HARD = 'hard',
  EXPERT = 'expert'
}

export interface ProgressCell {
  row: number;
  col: number;
  value: string;
  locked: boolean;
}

export interface ProgressSummary {
  puzzleId: string;
  progress: number;
  isCompleted: boolean;
  isInProgress: boolean;
  bestTime: number | null;
  lastPlayedAt: Date;
}