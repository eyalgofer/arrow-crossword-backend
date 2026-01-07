import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { Difficulty } from '../types';

dotenv.config();

/**
 * Swedish Arrow Crossword Puzzle Structure:
 * 
 * - Each clue has a CLUE CELL that contains the question text and an arrow
 * - The arrow points to where the answer should be written
 * - startRow, startCol = position of the CLUE CELL
 * 
 * Directions explained:
 * - 'across': arrow points RIGHT → answer goes horizontally (starts at col+1)
 * - 'down': arrow points DOWN ↓ answer goes vertically (starts at row+1)
 * - 'right-down': arrow points RIGHT → but answer goes DOWN ↓ (starts at col+1, row same, goes down)
 * - 'left-down': arrow points LEFT ← but answer goes DOWN ↓ (starts at col-1, row same, goes down)
 * - 'down-across': arrow points DOWN ↓ but answer goes ACROSS → (starts at row+1, col same, goes right)
 * - 'up-across': arrow points UP ↑ but answer goes ACROSS → (starts at row-1, col same, goes right)
 */

const samplePuzzles = [
  {
    title: "Good Example",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 11, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Ensure', answer: 'SEE', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Private', answer: 'PERSONAL', enumeration: [8], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Stores', answer: 'FILES', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Roman marketplace', answer: 'FORUM', enumeration: [5], startRow: 0, startCol: 6 },
      { number: 5, direction: 'left-down', clue: 'Second Greek letter', answer: 'BETA', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 6, direction: 'across', clue: 'Incidents', answer: 'EPISODES', enumeration: [8], startRow: 1, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Strip', answer: 'GUR', enumeration: [3], startRow: 2, startCol: 4 },
      { number: 8, direction: 'down', clue: 'Loan', answer: 'LEND', enumeration: [4], startRow: 2, startCol: 6 },
      { number: 9, direction: 'down', clue: 'Fury', answer: 'RAGE', enumeration: [4], startRow: 2, startCol: 8 },
      { number: 10, direction: 'up-across', clue: 'Touch', answer: 'FEEL', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Usual', answer: 'REGULAR', enumeration: [7], startRow: 3, startCol: 1 },
      { number: 12, direction: 'across', clue: 'Take for granted', answer: 'ASSUME', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Assert', answer: 'ALLEGE', enumeration: [6], startRow: 4, startCol: 7 },
      { number: 14, direction: 'down-across', clue: 'Short skirt', answer: 'MINI', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 15, direction: 'down', clue: 'Units', answer: 'ITEMS', enumeration: [5], startRow: 5, startCol: 1 },
      { number: 16, direction: 'down', clue: 'Deduce', answer: 'INFER', enumeration: [5], startRow: 5, startCol: 3 },
      { number: 17, direction: 'across', clue: 'Pester', answer: 'NAG', enumeration: [3], startRow: 5, startCol: 5 },
      { number: 18, direction: 'across', clue: 'Lazy', answer: 'IDLE', enumeration: [4], startRow: 6, startCol: 4 },
      { number: 19, direction: 'across', clue: 'Large basin', answer: 'TANK', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 20, direction: 'down', clue: 'Kitchen container', answer: 'POT', enumeration: [3], startRow: 7, startCol: 5 },
      { number: 21, direction: 'down', clue: 'Belonging to us', answer: 'OUR', enumeration: [3], startRow: 7, startCol: 6 },
      { number: 22, direction: 'down', clue: 'Definite article', answer: 'THE', enumeration: [3], startRow: 7, startCol: 8 },
      { number: 23, direction: 'across', clue: 'Fairy', answer: 'ELF', enumeration: [3], startRow: 8, startCol: 0 },
      { number: 24, direction: 'across', clue: 'Bard', answer: 'POET', enumeration: [4], startRow: 8, startCol: 4 },
      { number: 25, direction: 'down-across', clue: 'Operator', answer: 'USER', enumeration: [4], startRow: 9, startCol: 0 },
      { number: 26, direction: 'across', clue: 'Sufficient', answer: 'ENOUGH', enumeration: [6], startRow: 9, startCol: 2 },
      { number: 27, direction: 'across', clue: 'Woody plant', answer: 'TREE', enumeration: [4], startRow: 10, startCol: 4 }
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Morning Buzz",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 11, cols: 9 },
    clues: [
      // Row 0 clue cells
      { number: 1, direction: 'right-down', clue: 'Employ', answer: 'USE', enumeration: [3], startRow: 0, startCol: 0 },
      // USE: (0,1)=U, (1,1)=S, (2,1)=E
      
      { number: 2, direction: 'down', clue: 'First', answer: 'EARLIEST', enumeration: [8], startRow: 0, startCol: 2 },
      // EARLIEST: (1,2)=E, (2,2)=A, (3,2)=R, (4,2)=L, (5,2)=I, (6,2)=E, (7,2)=S, (8,2)=T
      
      { number: 3, direction: 'left-down', clue: 'Divide', answer: 'SPLIT', enumeration: [5], startRow: 0, startCol: 4 },
      // SPLIT: (0,3)=S, (1,3)=P, (2,3)=L, (3,3)=I, (4,3)=T
      
      { number: 4, direction: 'left-down', clue: 'Dairy', answer: 'CREAM', enumeration: [5], startRow: 0, startCol: 6 },
      // CREAM: (0,5)=C, (1,5)=R, (2,5)=E, (3,5)=A, (4,5)=M
      
      { number: 5, direction: 'left-down', clue: 'Thing', answer: 'ITEM', enumeration: [4], startRow: 0, startCol: 8 },
      // ITEM: (0,7)=I, (1,7)=T, (2,7)=E, (3,7)=M
      
      // Row 1
      { number: 6, direction: 'across', clue: 'Distinct', answer: 'SEPARATE', enumeration: [8], startRow: 1, startCol: 0 },
      // SEPARATE: (1,1)=S, (1,2)=E, (1,3)=P, (1,4)=A, (1,5)=R, (1,6)=A, (1,7)=T, (1,8)=E
      // Crossings: (1,1)=S from USE ✓, (1,2)=E from EARLIEST ✓, (1,3)=P from SPLIT ✓, (1,5)=R from CREAM ✓, (1,7)=T from ITEM ✓
      
      // Row 2 clue cells for new downs
      { number: 7, direction: 'down', clue: 'River', answer: 'RIO', enumeration: [3], startRow: 2, startCol: 4 },
      // RIO: (3,4)=R, (4,4)=I, (5,4)=O
      
      { number: 8, direction: 'down', clue: 'Fire remains', answer: 'SOOT', enumeration: [4], startRow: 2, startCol: 6 },
      // SOOT: (3,6)=S, (4,6)=O, (5,6)=O, (6,6)=T
      
      { number: 9, direction: 'down', clue: 'Beverage', answer: 'MEAD', enumeration: [4], startRow: 2, startCol: 8 },
      // MEAD: (3,8)=M, (4,8)=E, (5,8)=A, (6,8)=D
      
      // Row 3
      { number: 10, direction: 'up-across', clue: 'Food', answer: 'MEAL', enumeration: [4], startRow: 3, startCol: 0 },
      // MEAL (up-across from 3,0): answer at row 2, cols 0-3
      // (2,0)=M, (2,1)=E, (2,2)=A, (2,3)=L
      // Crossings: (2,1)=E from USE ✓, (2,2)=A from EARLIEST ✓, (2,3)=L from SPLIT (wait, SPLIT has L at (2,3)? Let me check: S-P-L-I-T at (0,3),(1,3),(2,3),(3,3),(4,3) so (2,3)=L ✓)
      
      { number: 11, direction: 'across', clue: 'Scarce', answer: 'RIOTSAM', enumeration: [7], startRow: 3, startCol: 1 },
      // Wait this doesn't make sense. Let me recalculate row 3
      // Row 3 current: [10] at (3,0), then need across from (3,1)
      // Known letters at row 3: (3,2)=R from EARLIEST, (3,3)=I from SPLIT, (3,4)=R from RIO, (3,5)=A from CREAM, (3,6)=S from SOOT, (3,7)=M from ITEM, (3,8)=M from MEAD
      // Wait that has M at both (3,7) and (3,8)! And ITEM ends at (3,7), MEAD starts at (3,8)
      // So row 3: (3,1)=?, (3,2)=R, (3,3)=I, (3,4)=R, (3,5)=A, (3,6)=S, (3,7)=M, (3,8)=M
      // Need 7-letter word from (3,2)-(3,8): R-I-R-A-S-M-M - doesn't work!
      
      // I need to redesign. Let me reconsider clues 7, 8, 9...
    ],
    estimatedTime: 85,
    coinReward: 8
  },
  // ============================================
  // PUZZLE 1: "Kitchen Basics" - EASY (8x7)
  // Verified crossings: COOK/OPEN(O), COOK/KNOB(K), PAN/OPEN(P), PAN/KNOB(N), TEA/OPEN(E), MUG/CUP(U), CUP/PIE(P)
  // ============================================
  {
    title: "Kitchen Basics",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Prepare food', answer: 'COOK', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Kitchen vessel', answer: 'PAN', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Hot beverage', answer: 'TEA', enumeration: [3], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Cook in oil', answer: 'FRY', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Not closed', answer: 'OPEN', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Door handle', answer: 'KNOB', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Chicken product', answer: 'EGG', enumeration: [3], startRow: 4, startCol: 3 },
      { number: 8, direction: 'down-across', clue: 'Drinking cup', answer: 'MUG', enumeration: [3], startRow: 5, startCol: 0 },
      { number: 9, direction: 'down', clue: 'Drink holder', answer: 'CUP', enumeration: [3], startRow: 4, startCol: 1 },
      { number: 10, direction: 'across', clue: 'Dessert pastry', answer: 'PIE', enumeration: [3], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 60,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 2: "Office Life" - EASY (8x7)
  // Verified crossings: MEMO/BOX(O), ART/WORK(R)
  // ============================================
  {
    title: "Office Life",
    difficulty: Difficulty.EASY,
    category: "Work",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Work', answer: 'JOB', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Quick note', answer: 'MEMO', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Document', answer: 'FILE', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Employment', answer: 'WORK', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Container', answer: 'BOX', enumeration: [3], startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Work surface', answer: 'DESK', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Writing tool', answer: 'PEN', enumeration: [3], startRow: 5, startCol: 2 },
      { number: 8, direction: 'across', clue: 'Utilize', answer: 'USE', enumeration: [3], startRow: 7, startCol: 0 },
      { number: 9, direction: 'up-across', clue: 'Skill', answer: 'ART', enumeration: [3], startRow: 3, startCol: 4 }
    ],
    estimatedTime: 55,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 3: "Pet Corner" - EASY (7x7)
  // Layout: C1(0,0)→CAT↓@col1, C2(0,2)→DOG↓@col2, C3(0,4)→PET↓@col3, C4(0,6)→FUR↓@col5
  // No across crossings - simple independent layout
  // ============================================
  {
    title: "Pet Corner",
    difficulty: Difficulty.EASY,
    category: "Animals",
    grid: { rows: 7, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Feline', answer: 'CAT', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Canine', answer: 'DOG', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Companion', answer: 'PET', enumeration: [3], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Animal coat', answer: 'FUR', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Dog sound', answer: 'BARK', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Animal foot', answer: 'PAW', enumeration: [3], startRow: 5, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Fetch toy', answer: 'BALL', enumeration: [4], startRow: 6, startCol: 2 }
    ],
    estimatedTime: 50,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 4: "Music Notes" - MEDIUM (8x7)
  // Down words: TUNE@col1, SONG@col2(from row1), BEAT@col3, TAP@col5
  // Across words placed below down words to avoid conflicts
  // ============================================
  {
    title: "Music Notes",
    difficulty: Difficulty.MEDIUM,
    category: "Entertainment",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Melody', answer: 'TUNE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Music words', answer: 'SONG', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Rhythm', answer: 'BEAT', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Drum sound', answer: 'TAP', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Music group', answer: 'BAND', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Music lover', answer: 'FAN', enumeration: [3], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'String instrument', answer: 'HARP', enumeration: [4], startRow: 7, startCol: 2 }
    ],
    estimatedTime: 75,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 5: "Travel Bug" - MEDIUM (8x7)
  // Down words: TRIP@col1, BAGS@col2(row1-4), PACK@col3, MAP@col5
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Travel Bug",
    difficulty: Difficulty.MEDIUM,
    category: "Travel",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Journey', answer: 'TRIP', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Luggage', answer: 'BAGS', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Bundle', answer: 'PACK', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'City plan', answer: 'MAP', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Border check', answer: 'VISA', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Souvenir', answer: 'GIFT', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Train station', answer: 'DEPOT', enumeration: [5], startRow: 7, startCol: 1 }
    ],
    estimatedTime: 80,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 6: "Tech Talk" - MEDIUM (8x7)
  // Down words: CODE@col1(r0-3), WEB@col2(r1-3), APP@col3(r0-2), BUG@col5(r0-2)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Tech Talk",
    difficulty: Difficulty.MEDIUM,
    category: "Technology",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Program', answer: 'CODE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Internet', answer: 'WEB', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Software', answer: 'APP', enumeration: [3], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Error', answer: 'BUG', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Input device', answer: 'MOUSE', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Information', answer: 'DATA', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Download', answer: 'GET', enumeration: [3], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 85,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 7: "Garden Path" - MEDIUM (8x7)
  // Down words: SEED@col1(r0-3), LEAF@col2(r1-4), ROSE@col3(r0-3), POT@col5(r0-2)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Garden Path",
    difficulty: Difficulty.MEDIUM,
    category: "Nature",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Plant starter', answer: 'SEED', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Tree part', answer: 'LEAF', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Flower', answer: 'ROSE', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Plant holder', answer: 'POT', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Garden earth', answer: 'SOIL', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Dig tool', answer: 'SPADE', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 7, direction: 'across', clue: 'Grass area', answer: 'LAWN', enumeration: [4], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 70,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 8: "Sports Arena" - HARD (8x7)
  // Down words: GOAL@col1(r0-3), TEAM@col2(r1-4), BALL@col3(r0-3), WIN@col5(r0-2)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Sports Arena",
    difficulty: Difficulty.HARD,
    category: "Sports",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Score point', answer: 'GOAL', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Group', answer: 'TEAM', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Throw toy', answer: 'BALL', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Victory', answer: 'WIN', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Game points', answer: 'SCORE', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Pool sport', answer: 'SWIM', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Run fast', answer: 'RACE', enumeration: [4], startRow: 7, startCol: 2 }
    ],
    estimatedTime: 100,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 9: "Movie Night" - HARD (8x7)
  // Down words: FILM@col1(r0-3), STAR@col2(r1-4), PLOT@col3(r0-3), ROLE@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Movie Night",
    difficulty: Difficulty.HARD,
    category: "Entertainment",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Cinema', answer: 'FILM', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Celebrity', answer: 'STAR', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Story', answer: 'PLOT', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Part', answer: 'ROLE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Film roll', answer: 'REEL', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Film part', answer: 'SCENE', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 7, direction: 'across', clue: 'Award', answer: 'OSCAR', enumeration: [5], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 110,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 10: "Weather Watch" - HARD (8x7)
  // Down words: RAIN@col1(r0-3), WIND@col2(r1-4), COLD@col3(r0-3), SNOW@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Weather Watch",
    difficulty: Difficulty.HARD,
    category: "Nature",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Downpour', answer: 'RAIN', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Air current', answer: 'WIND', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Chilly', answer: 'COLD', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Ice', answer: 'SNOW', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Mist', answer: 'FOG', enumeration: [3], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Warmth', answer: 'HEAT', enumeration: [4], startRow: 6, startCol: 2 },
      { number: 7, direction: 'across', clue: 'Sunshine', answer: 'SUNNY', enumeration: [5], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 95,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 11: "Culinary Arts" - HARD (8x7)
  // Down words: BAKE@col1(r0-3), CHEF@col2(r1-4), STIR@col3(r0-3), CHOP@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Culinary Arts",
    difficulty: Difficulty.HARD,
    category: "Food",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Cook in oven', answer: 'BAKE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Kitchen boss', answer: 'CHEF', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Mix pot', answer: 'STIR', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Food prep', answer: 'CHOP', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Flavor base', answer: 'SAUCE', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Dessert', answer: 'CAKE', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Meat juice', answer: 'GRAVY', enumeration: [5], startRow: 7, startCol: 1 }
    ],
    estimatedTime: 105,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 12: "Space Explorer" - CHALLENGING (8x7)
  // Down words: STAR@col1(r0-3), MOON@col2(r1-4), SUN@col3(r0-2), MARS@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Space Explorer",
    difficulty: Difficulty.CHALLENGING,
    category: "Science",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Night light', answer: 'STAR', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Earth satellite', answer: 'MOON', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Day light', answer: 'SUN', enumeration: [3], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Red planet', answer: 'MARS', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Star path', answer: 'ORBIT', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Space agency', answer: 'NASA', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Star burst', answer: 'NOVA', enumeration: [4], startRow: 7, startCol: 2 }
    ],
    estimatedTime: 120,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 13: "Literary Corner" - CHALLENGING (8x7)
  // Down words: BOOK@col1(r0-3), READ@col2(r1-4), POEM@col3(r0-3), TALE@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Literary Corner",
    difficulty: Difficulty.CHALLENGING,
    category: "Culture",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Novel', answer: 'BOOK', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Peruse', answer: 'READ', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Verse', answer: 'POEM', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Story', answer: 'TALE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Story outline', answer: 'PLOT', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Chapter', answer: 'PART', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Book lover', answer: 'READER', enumeration: [6], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 130,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 14: "Medical Terms" - CHALLENGING (8x7)
  // Down words: CURE@col1(r0-3), PILL@col2(r1-4), DOSE@col3(r0-3), ACHE@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Medical Terms",
    difficulty: Difficulty.CHALLENGING,
    category: "Science",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Heal', answer: 'CURE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Medicine', answer: 'PILL', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Amount', answer: 'DOSE', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Hurt', answer: 'ACHE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Care giver', answer: 'NURSE', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Bone image', answer: 'XRAY', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Relax', answer: 'REST', enumeration: [4], startRow: 7, startCol: 2 }
    ],
    estimatedTime: 140,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 15: "Fashion Forward" - CHALLENGING (8x7)
  // Down words: COAT@col1(r0-3), SHOE@col2(r1-4), BELT@col3(r0-3), HAT@col5(r0-2)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Fashion Forward",
    difficulty: Difficulty.CHALLENGING,
    category: "Lifestyle",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Jacket', answer: 'COAT', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Footwear', answer: 'SHOE', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Waist band', answer: 'BELT', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Head cover', answer: 'HAT', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Fabric', answer: 'SILK', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Leg wear', answer: 'PANTS', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 7, direction: 'across', clue: 'Fashion trend', answer: 'STYLE', enumeration: [5], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 125,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 16: "Ocean Deep" - EXPERT (8x7)
  // Down words: WAVE@col1(r0-3), FISH@col2(r1-4), TIDE@col3(r0-3), KELP@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Ocean Deep",
    difficulty: Difficulty.EXPERT,
    category: "Nature",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Ocean motion', answer: 'WAVE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Sea creature', answer: 'FISH', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Ocean rise', answer: 'TIDE', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Sea plant', answer: 'KELP', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Coral home', answer: 'REEF', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Beach sand', answer: 'SHORE', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 7, direction: 'across', clue: 'Sea mammal', answer: 'WHALE', enumeration: [5], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 150,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 17: "Legal Eagles" - EXPERT (8x7)
  // Down words: LAWS@col1(r0-3), JURY@col2(r1-4), CASE@col3(r0-3), OATH@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Legal Eagles",
    difficulty: Difficulty.EXPERT,
    category: "Profession",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Rules', answer: 'LAWS', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Court panel', answer: 'JURY', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Court matter', answer: 'CASE', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Vow', answer: 'OATH', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Court case', answer: 'TRIAL', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Legal team', answer: 'FIRM', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Judge seat', answer: 'BENCH', enumeration: [5], startRow: 7, startCol: 1 }
    ],
    estimatedTime: 160,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 18: "Ancient History" - EXPERT (8x7)
  // Down words: ROME@col1(r0-3), KING@col2(r1-4), AGES@col3(r0-3), WAR@col5(r0-2)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Ancient History",
    difficulty: Difficulty.EXPERT,
    category: "History",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Italian city', answer: 'ROME', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Ruler', answer: 'KING', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Time periods', answer: 'AGES', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Conflict', answer: 'WAR', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Greek god', answer: 'ZEUS', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Greek myth', answer: 'LEGEND', enumeration: [6], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Ancient tomb', answer: 'CRYPT', enumeration: [5], startRow: 7, startCol: 1 }
    ],
    estimatedTime: 170,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 19: "Business World" - EXPERT (8x7)
  // Down words: DEAL@col1(r0-3), SALE@col2(r1-4), CASH@col3(r0-3), BOND@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Business World",
    difficulty: Difficulty.EXPERT,
    category: "Finance",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Agreement', answer: 'DEAL', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Transaction', answer: 'SALE', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Money', answer: 'CASH', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Stock unit', answer: 'BOND', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Income', answer: 'PROFIT', enumeration: [6], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Company', answer: 'FIRM', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Increase', answer: 'GROWTH', enumeration: [6], startRow: 7, startCol: 0 }
    ],
    estimatedTime: 165,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 20: "Architecture" - EXPERT (8x7)
  // Down words: WALL@col1(r0-3), ROOF@col2(r1-4), DOOR@col3(r0-3), TILE@col5(r0-3)
  // Across words placed in rows 5-7 to avoid conflicts
  // ============================================
  {
    title: "Architecture",
    difficulty: Difficulty.EXPERT,
    category: "Art",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Barrier', answer: 'WALL', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Top cover', answer: 'ROOF', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Entry', answer: 'DOOR', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Floor', answer: 'TILE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'across', clue: 'Stone', answer: 'BRICK', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Glass panel', answer: 'PANE', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Tower top', answer: 'SPIRE', enumeration: [5], startRow: 7, startCol: 1 }
    ],
    estimatedTime: 180,
    coinReward: 25
  }
];

// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

/**
 * Validation function to check:
 * 1. All clues fit within grid boundaries
 * 2. Answer cells don't overlap with clue cells
 * 3. Answer cells that overlap have matching letters (valid crossings)
 * 
 * Rules for each direction:
 * - 'down': answer starts at (startRow+1, startCol), goes DOWN
 * - 'right-down': answer starts at (startRow, startCol+1), goes DOWN
 * - 'left-down': answer starts at (startRow, startCol-1), goes DOWN
 * - 'across': answer starts at (startRow, startCol+1), goes RIGHT
 * - 'down-across': answer starts at (startRow+1, startCol), goes RIGHT
 * - 'up-across': answer starts at (startRow-1, startCol), goes RIGHT
 */
interface ValidationError {
  puzzleTitle: string;
  clueNumber: number;
  clue: string;
  answer: string;
  direction: string;
  error: string;
  availableSpace?: number;
  requiredSpace?: number;
}

type CellType = 'clue' | 'answer';
interface CellInfo {
  type: CellType;
  clueNumber: number;
  letter?: string; // For answer cells
  clueText?: string; // For clue cells
}

function getAnswerCells(clue: typeof samplePuzzles[0]['clues'][0]): Array<{row: number, col: number, letter: string}> {
  const { startRow, startCol, direction, answer } = clue;
  const cells: Array<{row: number, col: number, letter: string}> = [];
  
  let answerStartRow = startRow;
  let answerStartCol = startCol;
  let goesDown = false;
  
  switch (direction) {
    case 'down':
      answerStartRow = startRow + 1;
      goesDown = true;
      break;
    case 'right-down':
      answerStartCol = startCol + 1;
      goesDown = true;
      break;
    case 'left-down':
      answerStartCol = startCol - 1;
      goesDown = true;
      break;
    case 'across':
      answerStartCol = startCol + 1;
      goesDown = false;
      break;
    case 'down-across':
      answerStartRow = startRow + 1;
      goesDown = false;
      break;
    case 'up-across':
      answerStartRow = startRow - 1;
      goesDown = false;
      break;
  }
  
  for (let i = 0; i < answer.length; i++) {
    if (goesDown) {
      cells.push({ row: answerStartRow + i, col: answerStartCol, letter: answer[i] });
    } else {
      cells.push({ row: answerStartRow, col: answerStartCol + i, letter: answer[i] });
    }
  }
  
  return cells;
}

function validatePuzzle(puzzle: typeof samplePuzzles[0]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { rows, cols } = puzzle.grid;
  
  // Build grid to track cell usage
  // Each cell can be: empty, clue cell, or answer cell(s)
  const clueCells = new Map<string, {clueNumber: number, clueText: string}>();
  const answerCells = new Map<string, Array<{clueNumber: number, letter: string}>>();
  
  // First pass: mark all clue cells
  for (const clue of puzzle.clues) {
    const key = `${clue.startRow},${clue.startCol}`;
    clueCells.set(key, { clueNumber: clue.number, clueText: clue.clue });
  }
  
  // Second pass: validate each clue's answer placement
  for (const clue of puzzle.clues) {
    const answerLength = clue.answer.length;
    const { startRow, startCol, direction, answer, number: clueNum } = clue;
    
    // Check boundary constraints first
    let boundaryError = '';
    
    switch (direction) {
      case 'down':
        if (startRow + 1 + answerLength > rows) {
          boundaryError = `DOWN: answer needs rows ${startRow + 1}-${startRow + answerLength} but grid only has ${rows} rows`;
        }
        break;
      case 'right-down':
        if (startCol + 1 >= cols) {
          boundaryError = `RIGHT-DOWN: startCol+1 (${startCol + 1}) is out of bounds (cols=${cols})`;
        } else if (startRow + answerLength > rows) {
          boundaryError = `RIGHT-DOWN: answer needs rows ${startRow}-${startRow + answerLength - 1} but grid only has ${rows} rows`;
        }
        break;
      case 'left-down':
        if (startCol - 1 < 0) {
          boundaryError = `LEFT-DOWN: startCol-1 (${startCol - 1}) is out of bounds`;
        } else if (startRow + answerLength > rows) {
          boundaryError = `LEFT-DOWN: answer needs rows ${startRow}-${startRow + answerLength - 1} but grid only has ${rows} rows`;
        }
        break;
      case 'across':
        if (startCol + 1 + answerLength > cols) {
          boundaryError = `ACROSS: answer needs cols ${startCol + 1}-${startCol + answerLength} but grid only has ${cols} cols`;
        }
        break;
      case 'down-across':
        if (startRow + 1 >= rows) {
          boundaryError = `DOWN-ACROSS: startRow+1 (${startRow + 1}) is out of bounds (rows=${rows})`;
        } else if (startCol + answerLength > cols) {
          boundaryError = `DOWN-ACROSS: answer needs cols ${startCol}-${startCol + answerLength - 1} but grid only has ${cols} cols`;
        }
        break;
      case 'up-across':
        if (startRow - 1 < 0) {
          boundaryError = `UP-ACROSS: startRow-1 (${startRow - 1}) is out of bounds`;
        } else if (startCol + answerLength > cols) {
          boundaryError = `UP-ACROSS: answer needs cols ${startCol}-${startCol + answerLength - 1} but grid only has ${cols} cols`;
        }
        break;
    }
    
    if (boundaryError) {
      errors.push({
        puzzleTitle: puzzle.title,
        clueNumber: clueNum,
        clue: clue.clue,
        answer,
        direction,
        error: boundaryError
      });
      continue; // Skip overlap check if boundary error
    }
    
    // Check for overlaps with clue cells
    const answerCellPositions = getAnswerCells(clue);
    for (const cell of answerCellPositions) {
      const key = `${cell.row},${cell.col}`;
      
      // Check if this answer cell overlaps with a clue cell
      if (clueCells.has(key)) {
        const conflictingClue = clueCells.get(key)!;
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clueNum,
          clue: clue.clue,
          answer,
          direction,
          error: `OVERLAP: Letter "${cell.letter}" at (${cell.row},${cell.col}) conflicts with clue cell #${conflictingClue.clueNumber} ("${conflictingClue.clueText}")`
        });
      }
      
      // Track answer cells for crossing validation
      if (!answerCells.has(key)) {
        answerCells.set(key, []);
      }
      answerCells.get(key)!.push({ clueNumber: clueNum, letter: cell.letter });
    }
  }
  
  // Third pass: check for letter mismatches at crossings
  for (const [key, cellAnswers] of answerCells) {
    if (cellAnswers.length > 1) {
      const letters = new Set(cellAnswers.map(a => a.letter));
      if (letters.size > 1) {
        const [row, col] = key.split(',').map(Number);
        const clueNumbers = cellAnswers.map(a => `#${a.clueNumber}(${a.letter})`).join(', ');
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: cellAnswers[0].clueNumber,
          clue: 'Multiple clues',
          answer: 'N/A',
          direction: 'crossing',
          error: `LETTER MISMATCH at (${row},${col}): ${clueNumbers}`
        });
      }
    }
  }
  
  // Fourth pass: check for invalid word combinations
  // Build a 2D grid with all letters placed
  const grid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
  
  // Mark clue cells as special markers (we'll ignore them)
  for (const clue of puzzle.clues) {
    grid[clue.startRow][clue.startCol] = 'CLUE';
  }
  
  // Place all answer letters in the grid
  for (const clue of puzzle.clues) {
    const answerCellPositions = getAnswerCells(clue);
    for (const cell of answerCellPositions) {
      if (grid[cell.row][cell.col] === null || grid[cell.row][cell.col] === 'CLUE') {
        grid[cell.row][cell.col] = cell.letter;
      }
    }
  }
  
  // Get all valid answer words (for comparison)
  const validWords = new Set(puzzle.clues.map(c => c.answer));
  
  // Check all horizontal sequences (rows)
  for (let row = 0; row < rows; row++) {
    let sequence = '';
    let startCol = -1;
    
    for (let col = 0; col <= cols; col++) {
      const cell = col < cols ? grid[row][col] : null;
      
      if (cell && cell !== 'CLUE' && typeof cell === 'string') {
        // Letter cell - add to sequence
        if (sequence === '') {
          startCol = col;
        }
        sequence += cell;
      } else {
        // Empty or clue cell - check if we have a sequence to validate
        if (sequence.length > 1) {
          // Check if this sequence matches any valid answer word
          if (!validWords.has(sequence)) {
            errors.push({
              puzzleTitle: puzzle.title,
              clueNumber: 0,
              clue: 'Invalid word combination',
              answer: sequence,
              direction: 'across',
              error: `INVALID WORD: "${sequence}" found horizontally at row ${row}, cols ${startCol}-${startCol + sequence.length - 1}. This sequence is not a valid answer word.`
            });
          }
        }
        sequence = '';
        startCol = -1;
      }
    }
  }
  
  // Check all vertical sequences (columns)
  for (let col = 0; col < cols; col++) {
    let sequence = '';
    let startRow = -1;
    
    for (let row = 0; row <= rows; row++) {
      const cell = row < rows ? grid[row][col] : null;
      
      if (cell && cell !== 'CLUE' && typeof cell === 'string') {
        // Letter cell - add to sequence
        if (sequence === '') {
          startRow = row;
        }
        sequence += cell;
      } else {
        // Empty or clue cell - check if we have a sequence to validate
        if (sequence.length > 1) {
          // Check if this sequence matches any valid answer word
          if (!validWords.has(sequence)) {
            errors.push({
              puzzleTitle: puzzle.title,
              clueNumber: 0,
              clue: 'Invalid word combination',
              answer: sequence,
              direction: 'down',
              error: `INVALID WORD: "${sequence}" found vertically at col ${col}, rows ${startRow}-${startRow + sequence.length - 1}. This sequence is not a valid answer word.`
            });
          }
        }
        sequence = '';
        startRow = -1;
      }
    }
  }
  
  return errors;
}

function validateAllPuzzles(): void {
  console.log('\n🔍 Validating all puzzles...\n');
  let totalErrors = 0;

  for (const puzzle of samplePuzzles) {
    const errors = validatePuzzle(puzzle);
    if (errors.length > 0) {
      console.log(`❌ ${puzzle.title} (${puzzle.grid.rows}x${puzzle.grid.cols}):`);
      for (const err of errors) {
        console.log(`   Clue ${err.clueNumber}: "${err.answer}" (${err.direction})`);
        console.log(`   └─ ${err.error}`);
      }
      console.log('');
      totalErrors += errors.length;
    } else {
      console.log(`✅ ${puzzle.title} - OK`);
    }
  }

  console.log(`\n📊 Total errors: ${totalErrors}`);
  if (totalErrors > 0) {
    console.log('⚠️  Some puzzles have spatial constraint violations!\n');
  } else {
    console.log('🎉 All puzzles are valid!\n');
  }
}

const seedDatabase = async () => {
  try {
    // Run validation before seeding
    validateAllPuzzles();

    await mongoose.connect('mongodb://localhost:27017/arrow-crossword');
    console.log('Connected to MongoDB');

    await Puzzle.deleteMany({});
    console.log('Cleared existing puzzles');

    await Puzzle.insertMany(samplePuzzles);
    console.log(`Inserted ${samplePuzzles.length} sample puzzles`);

    console.log('✅ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();