import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export interface UserStats {
  totalGames: number;
  gamesWon: number;
  gamesLost: number;
  totalTime: number;
  averageTime: number;
  fastestTime: number;
}

export interface PuzzleClue {
  number: number;
  direction: 'across' | 'down';
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
  HARD = 'hard',
  EXPERT = 'expert'
}