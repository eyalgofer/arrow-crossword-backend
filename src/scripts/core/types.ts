import { Difficulty, Language } from '../../types';

export { Difficulty, Language };

export type ClueType = 'text' | 'image';

export interface PuzzleItem {
  number: number;
  direction: Direction;
  clue: string;
  answer: string;
  enumeration?: number[] | null;
  startRow: number;
  startCol: number;
  clueType?: ClueType;
  imageUrl?: string;
  exitRow?: number;
  exitCol?: number;
}

export interface Puzzle {
  title: string;
  difficulty: Difficulty;
  category: string;
  language: Language;
  grid: {
    rows: number;
    cols: number;
  };
  puzzleItems: PuzzleItem[];
  estimatedTime: number;
  coinReward: number;
  metadata?: {
    templateId?: string;
    generationMethod?: string;
    [key: string]: any;
  };
}


export interface CrossingPoint {
  slotId: string;
  thisPosition: number;
  otherPosition: number;
}

export interface ClueSlot {
  id: string;
  direction: Direction;
  startRow: number;
  startCol: number;
  length: number;
  crossings: CrossingPoint[];
  /** When set, solver uses these cells directly instead of deriving from startRow/startCol/direction (needed for Engel geometry types 3,4,6). */
  cells?: Array<{ row: number; col: number }>;
  clueType?: ClueType;
  imageUrl?: string;
  exitRow?: number;
  exitCol?: number;
  fixedAnswer?: string;
  fixedEnumeration?: number[] | null;
}

export type Direction = 'across' | 'down' | 'right-down' | 'left-down' | 'down-across' | 'up-across';

export interface GridTemplate {
  id: string;
  name: string;
  rows: number;
  cols: number;
  slots: ClueSlot[];
  clueCells: Array<{ row: number; col: number; direction: Direction }>;
  difficulty: Difficulty;
  categories: string[];
  metadata?: {
    verified?: boolean;
    successRate?: number;
    [key: string]: any;
  };
}
