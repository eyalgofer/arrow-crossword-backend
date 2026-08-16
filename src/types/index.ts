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

export interface PuzzleItem {
  number: number;
  direction: 'across' | 'down' | 'right-down' | 'left-down' | 'down-across' | 'up-across';
  clue: string;
  answer: string;
  startRow: number;
  startCol: number;
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
    progress: number;
  }[];
  puzzleId: string;
  moves: PlayerMove[];
  startedAt?: Date;
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