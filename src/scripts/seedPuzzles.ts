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
  // ============================================
  // PUZZLE 1: "Kitchen Basics" - EASY (8x7)
  // ============================================
  {
    title: "Kitchen Basics",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 8, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Prepare food', answer: 'COOK', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Cooking vessel', answer: 'PAN', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Cutting tool', answer: 'KNIFE', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Consume', answer: 'EAT', enumeration: [3], startRow: 0, startCol: 5 },
      { number: 5, direction: 'down', clue: 'Refrigerator', answer: 'FRIDGE', enumeration: [6], startRow: 0, startCol: 6 },
      { number: 6, direction: 'across', clue: 'Oven product', answer: 'BREAD', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Morning meal', answer: 'BRUNCH', enumeration: [6], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Warm liquid', answer: 'SOUP', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 9, direction: 'down-across', clue: 'Frozen water', answer: 'ICE', enumeration: [3], startRow: 4, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Hen product', answer: 'EGG', enumeration: [3], startRow: 4, startCol: 2 },
      { number: 11, direction: 'across', clue: 'Spoon partner', answer: 'FORK', enumeration: [4], startRow: 5, startCol: 1 },
      { number: 12, direction: 'across', clue: 'Beverage', answer: 'TEA', enumeration: [3], startRow: 6, startCol: 0 },
      { number: 13, direction: 'across', clue: 'Dairy product', answer: 'MILK', enumeration: [4], startRow: 7, startCol: 2 }
    ],
    estimatedTime: 60,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 2: "Office Life" - EASY (9x8)
  // ============================================
  {
    title: "Office Life",
    difficulty: Difficulty.EASY,
    category: "Work",
    grid: { rows: 9, cols: 8 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Work surface', answer: 'DESK', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Meeting', answer: 'SESSION', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Electronic mail', answer: 'EMAIL', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Leader', answer: 'BOSS', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'down', clue: 'Occupation', answer: 'WORK', enumeration: [4], startRow: 0, startCol: 7 },
      { number: 6, direction: 'across', clue: 'Employment', answer: 'JOB', enumeration: [3], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Work team', answer: 'STAFF', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Document', answer: 'FILE', enumeration: [4], startRow: 2, startCol: 2 },
      { number: 9, direction: 'down-across', clue: 'Break beverage', answer: 'COFFEE', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Assignment', answer: 'TASK', enumeration: [4], startRow: 3, startCol: 2 },
      { number: 11, direction: 'across', clue: 'Schedule', answer: 'PLAN', enumeration: [4], startRow: 4, startCol: 2 },
      { number: 12, direction: 'across', clue: 'Computer input', answer: 'TYPE', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 13, direction: 'across', clue: 'Phone call', answer: 'RING', enumeration: [4], startRow: 6, startCol: 3 }
    ],
    estimatedTime: 55,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 3: "Pet Corner" - EASY (7x7)
  // ============================================
  {
    title: "Pet Corner",
    difficulty: Difficulty.EASY,
    category: "Animals",
    grid: { rows: 7, cols: 7 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Feline', answer: 'CAT', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Canine', answer: 'DOG', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Aquarium dweller', answer: 'FISH', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Small rodent', answer: 'RAT', enumeration: [3], startRow: 0, startCol: 5 },
      { number: 5, direction: 'down', clue: 'Pet toy', answer: 'BONE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 6, direction: 'across', clue: 'Animal food', answer: 'FEED', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Pet shelter', answer: 'CAGE', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Walk the dog', answer: 'LEAD', enumeration: [4], startRow: 2, startCol: 1 },
      { number: 9, direction: 'down-across', clue: 'Animal hair', answer: 'FUR', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Fetch toy', answer: 'BALL', enumeration: [4], startRow: 3, startCol: 2 },
      { number: 11, direction: 'across', clue: 'Pet sound', answer: 'BARK', enumeration: [4], startRow: 4, startCol: 1 },
      { number: 12, direction: 'across', clue: 'Cat sound', answer: 'MEOW', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 13, direction: 'across', clue: 'Animal foot', answer: 'PAW', enumeration: [3], startRow: 6, startCol: 3 }
    ],
    estimatedTime: 50,
    coinReward: 8
  },

  // ============================================
  // PUZZLE 4: "Music Notes" - MEDIUM (10x8)
  // ============================================
  {
    title: "Music Notes",
    difficulty: Difficulty.MEDIUM,
    category: "Entertainment",
    grid: { rows: 10, cols: 8 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Melody', answer: 'TUNE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Musical drama', answer: 'OPERA', enumeration: [5], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Song words', answer: 'LYRICS', enumeration: [6], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Percussion', answer: 'DRUM', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'down', clue: 'Wind instrument', answer: 'FLUTE', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 6, direction: 'across', clue: 'Music group', answer: 'BAND', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Hit song', answer: 'SINGLE', enumeration: [6], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Record', answer: 'ALBUM', enumeration: [5], startRow: 3, startCol: 2 },
      { number: 9, direction: 'across', clue: 'Music speed', answer: 'TEMPO', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 10, direction: 'down-across', clue: 'Piano key', answer: 'NOTE', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 11, direction: 'down', clue: 'Guitar string', answer: 'WIRE', enumeration: [4], startRow: 5, startCol: 2 },
      { number: 12, direction: 'across', clue: 'Volume', answer: 'LOUD', enumeration: [4], startRow: 5, startCol: 3 },
      { number: 13, direction: 'across', clue: 'Concert venue', answer: 'ARENA', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 14, direction: 'across', clue: 'Jazz style', answer: 'SWING', enumeration: [5], startRow: 7, startCol: 0 },
      { number: 15, direction: 'across', clue: 'Music lover', answer: 'FAN', enumeration: [3], startRow: 8, startCol: 0 },
      { number: 16, direction: 'across', clue: 'String instrument', answer: 'HARP', enumeration: [4], startRow: 9, startCol: 2 }
    ],
    estimatedTime: 75,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 5: "Travel Bug" - MEDIUM (10x9)
  // ============================================
  {
    title: "Travel Bug",
    difficulty: Difficulty.MEDIUM,
    category: "Travel",
    grid: { rows: 10, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Journey', answer: 'TRIP', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Luggage', answer: 'BAGS', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Travel document', answer: 'PASSPORT', enumeration: [8], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Airplane', answer: 'JET', enumeration: [3], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Beach material', answer: 'SAND', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 6, direction: 'across', clue: 'Accommodation', answer: 'HOTEL', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Excursion', answer: 'TOUR', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'City plan', answer: 'MAP', enumeration: [3], startRow: 2, startCol: 2 },
      { number: 9, direction: 'across', clue: 'Ship journey', answer: 'CRUISE', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 10, direction: 'down-across', clue: 'Travel by car', answer: 'DRIVE', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 11, direction: 'down', clue: 'Traveler', answer: 'TOURIST', enumeration: [7], startRow: 2, startCol: 7 },
      { number: 12, direction: 'across', clue: 'Pack clothes', answer: 'FOLD', enumeration: [4], startRow: 4, startCol: 3 },
      { number: 13, direction: 'across', clue: 'Border check', answer: 'VISA', enumeration: [4], startRow: 5, startCol: 1 },
      { number: 14, direction: 'across', clue: 'Navigate', answer: 'GUIDE', enumeration: [5], startRow: 6, startCol: 0 },
      { number: 15, direction: 'across', clue: 'Departure time', answer: 'GATE', enumeration: [4], startRow: 7, startCol: 4 },
      { number: 16, direction: 'across', clue: 'Train station', answer: 'DEPOT', enumeration: [5], startRow: 8, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Souvenir', answer: 'GIFT', enumeration: [4], startRow: 9, startCol: 4 }
    ],
    estimatedTime: 80,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 6: "Tech Talk" - MEDIUM (11x8)
  // ============================================
  {
    title: "Tech Talk",
    difficulty: Difficulty.MEDIUM,
    category: "Technology",
    grid: { rows: 11, cols: 8 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Information', answer: 'DATA', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Software error', answer: 'BUG', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Internet connection', answer: 'WIFI', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Application', answer: 'APP', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'down', clue: 'Restart', answer: 'REBOOT', enumeration: [6], startRow: 0, startCol: 7 },
      { number: 6, direction: 'across', clue: 'Digital image', answer: 'PIXEL', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 7, direction: 'up-across', clue: 'Screen display', answer: 'MONITOR', enumeration: [7], startRow: 2, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Write code', answer: 'PROGRAM', enumeration: [7], startRow: 3, startCol: 0 },
      { number: 9, direction: 'down-across', clue: 'Save location', answer: 'CLOUD', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Web address', answer: 'URL', enumeration: [3], startRow: 4, startCol: 2 },
      { number: 11, direction: 'across', clue: 'Computer brain', answer: 'CPU', enumeration: [3], startRow: 4, startCol: 4 },
      { number: 12, direction: 'across', clue: 'Input device', answer: 'MOUSE', enumeration: [5], startRow: 5, startCol: 1 },
      { number: 13, direction: 'down', clue: 'Computer memory', answer: 'RAM', enumeration: [3], startRow: 6, startCol: 6 },
      { number: 14, direction: 'across', clue: 'Send message', answer: 'TEXT', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 15, direction: 'across', clue: 'Download', answer: 'GET', enumeration: [3], startRow: 8, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Search engine', answer: 'GOOGLE', enumeration: [6], startRow: 10, startCol: 0 }
    ],
    estimatedTime: 85,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 7: "Garden Path" - MEDIUM (10x9)
  // ============================================
  {
    title: "Garden Path",
    difficulty: Difficulty.MEDIUM,
    category: "Nature",
    grid: { rows: 10, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Flower part', answer: 'PETAL', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Garden tool', answer: 'RAKE', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Plant stem', answer: 'STALK', enumeration: [5], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Tree juice', answer: 'SAP', enumeration: [3], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Plant food', answer: 'MULCH', enumeration: [5], startRow: 0, startCol: 8 },
      { number: 6, direction: 'across', clue: 'Grass area', answer: 'LAWN', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Garden pest', answer: 'SLUG', enumeration: [4], startRow: 1, startCol: 5 },
      { number: 8, direction: 'up-across', clue: 'Plant holder', answer: 'POT', enumeration: [3], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Dig tool', answer: 'SPADE', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 10, direction: 'across', clue: 'Water plants', answer: 'SPRAY', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Tree part', answer: 'ROOT', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 12, direction: 'across', clue: 'Garden barrier', answer: 'HEDGE', enumeration: [5], startRow: 5, startCol: 3 },
      { number: 13, direction: 'across', clue: 'Flower gift', answer: 'BLOOM', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 14, direction: 'across', clue: 'Garden earth', answer: 'SOIL', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 15, direction: 'across', clue: 'Rose defense', answer: 'THORN', enumeration: [5], startRow: 8, startCol: 3 }
    ],
    estimatedTime: 70,
    coinReward: 12
  },

  // ============================================
  // PUZZLE 8: "Sports Arena" - HARD (11x9)
  // ============================================
  {
    title: "Sports Arena",
    difficulty: Difficulty.HARD,
    category: "Sports",
    grid: { rows: 11, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Competition', answer: 'MATCH', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Athletic', answer: 'FIT', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Victory', answer: 'WIN', enumeration: [3], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Sports group', answer: 'TEAM', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 5, direction: 'down', clue: 'Ball game', answer: 'TENNIS', enumeration: [6], startRow: 0, startCol: 7 },
      { number: 6, direction: 'down', clue: 'Team uniform', answer: 'JERSEY', enumeration: [6], startRow: 0, startCol: 8 },
      { number: 7, direction: 'across', clue: 'Exercise', answer: 'TRAIN', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Sports field', answer: 'ARENA', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Race finish', answer: 'GOAL', enumeration: [4], startRow: 2, startCol: 2 },
      { number: 10, direction: 'across', clue: 'Sport break', answer: 'TIMEOUT', enumeration: [7], startRow: 3, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Run fast', answer: 'SPRINT', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 12, direction: 'down', clue: 'Medal metal', answer: 'GOLD', enumeration: [4], startRow: 4, startCol: 2 },
      { number: 13, direction: 'across', clue: 'Game official', answer: 'REFEREE', enumeration: [7], startRow: 5, startCol: 1 },
      { number: 14, direction: 'across', clue: 'Game points', answer: 'SCORE', enumeration: [5], startRow: 6, startCol: 0 },
      { number: 15, direction: 'across', clue: 'Sport shoe', answer: 'CLEAT', enumeration: [5], startRow: 7, startCol: 2 },
      { number: 16, direction: 'across', clue: 'Pool sport', answer: 'SWIM', enumeration: [4], startRow: 8, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Ball thrower', answer: 'PITCHER', enumeration: [7], startRow: 10, startCol: 0 }
    ],
    estimatedTime: 100,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 9: "Movie Night" - HARD (12x9)
  // ============================================
  {
    title: "Movie Night",
    difficulty: Difficulty.HARD,
    category: "Entertainment",
    grid: { rows: 12, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Cinema snack', answer: 'POPCORN', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Film location', answer: 'SET', enumeration: [3], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Movie star', answer: 'ACTOR', enumeration: [5], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Film genre', answer: 'DRAMA', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Movie ending', answer: 'CREDITS', enumeration: [7], startRow: 0, startCol: 8 },
      { number: 6, direction: 'across', clue: 'Film script', answer: 'LINES', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Cinema seat', answer: 'ROW', enumeration: [3], startRow: 1, startCol: 6 },
      { number: 8, direction: 'up-across', clue: 'Movie plot', answer: 'STORY', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Film music', answer: 'SCORE', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 10, direction: 'across', clue: 'Movie preview', answer: 'TRAILER', enumeration: [7], startRow: 3, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Film part', answer: 'SCENE', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 12, direction: 'down', clue: 'Camera work', answer: 'SHOT', enumeration: [4], startRow: 4, startCol: 2 },
      { number: 13, direction: 'across', clue: 'Award statue', answer: 'OSCAR', enumeration: [5], startRow: 5, startCol: 3 },
      { number: 14, direction: 'across', clue: 'Film director', answer: 'HELM', enumeration: [4], startRow: 6, startCol: 1 },
      { number: 15, direction: 'down', clue: 'Cinema chain', answer: 'AMC', enumeration: [3], startRow: 6, startCol: 5 },
      { number: 16, direction: 'across', clue: 'Film opening', answer: 'DEBUT', enumeration: [5], startRow: 7, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Horror movie', answer: 'SCARE', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 18, direction: 'across', clue: 'Film roll', answer: 'REEL', enumeration: [4], startRow: 9, startCol: 0 },
      { number: 19, direction: 'across', clue: 'Cast member', answer: 'ROLE', enumeration: [4], startRow: 10, startCol: 3 },
      { number: 20, direction: 'across', clue: 'Film festival', answer: 'CANNES', enumeration: [6], startRow: 11, startCol: 0 }
    ],
    estimatedTime: 110,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 10: "Weather Watch" - HARD (10x10)
  // ============================================
  {
    title: "Weather Watch",
    difficulty: Difficulty.HARD,
    category: "Nature",
    grid: { rows: 10, cols: 10 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Downpour', answer: 'RAIN', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Temperature', answer: 'HEAT', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Weather forecast', answer: 'OUTLOOK', enumeration: [7], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Frozen rain', answer: 'SLEET', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Air movement', answer: 'WIND', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 6, direction: 'down', clue: 'Ice crystal', answer: 'SNOW', enumeration: [4], startRow: 0, startCol: 9 },
      { number: 7, direction: 'across', clue: 'Sky cover', answer: 'CLOUDS', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Electric flash', answer: 'BOLT', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Storm warning', answer: 'ALERT', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 10, direction: 'across', clue: 'Mist', answer: 'FOG', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Tornado', answer: 'TWISTER', enumeration: [7], startRow: 4, startCol: 2 },
      { number: 12, direction: 'down-across', clue: 'Cold season', answer: 'WINTER', enumeration: [6], startRow: 5, startCol: 0 },
      { number: 13, direction: 'across', clue: 'Very hot', answer: 'HUMID', enumeration: [5], startRow: 5, startCol: 4 },
      { number: 14, direction: 'across', clue: 'Rainbow maker', answer: 'PRISM', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 15, direction: 'across', clue: 'Sunshine', answer: 'CLEAR', enumeration: [5], startRow: 7, startCol: 0 },
      { number: 16, direction: 'across', clue: 'Thunder sound', answer: 'RUMBLE', enumeration: [6], startRow: 8, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Air pressure', answer: 'LOW', enumeration: [3], startRow: 9, startCol: 5 }
    ],
    estimatedTime: 95,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 11: "Culinary Arts" - HARD (11x10)
  // ============================================
  {
    title: "Culinary Arts",
    difficulty: Difficulty.HARD,
    category: "Food",
    grid: { rows: 11, cols: 10 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Head chef', answer: 'MASTER', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Bake goods', answer: 'PASTRY', enumeration: [6], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Cookbook list', answer: 'RECIPE', enumeration: [6], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Taste enhancer', answer: 'SPICE', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Oven heat', answer: 'BROIL', enumeration: [5], startRow: 0, startCol: 8 },
      { number: 6, direction: 'down', clue: 'Egg dish', answer: 'OMELET', enumeration: [6], startRow: 0, startCol: 9 },
      { number: 7, direction: 'across', clue: 'Food prep', answer: 'CHOP', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Dessert', answer: 'CAKE', enumeration: [4], startRow: 1, startCol: 5 },
      { number: 9, direction: 'up-across', clue: 'Grill meat', answer: 'SEAR', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Blend smooth', answer: 'PUREE', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 11, direction: 'across', clue: 'Hot pot', answer: 'SIMMER', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 12, direction: 'down-across', clue: 'Cut thin', answer: 'SLICE', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Liquid base', answer: 'STOCK', enumeration: [5], startRow: 4, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Deep fry', answer: 'CRISP', enumeration: [5], startRow: 5, startCol: 4 },
      { number: 15, direction: 'across', clue: 'Flavor base', answer: 'SAUCE', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Bread dough', answer: 'KNEAD', enumeration: [5], startRow: 7, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Meat juice', answer: 'GRAVY', enumeration: [5], startRow: 7, startCol: 4 },
      { number: 18, direction: 'across', clue: 'Wine partner', answer: 'DINE', enumeration: [4], startRow: 8, startCol: 0 },
      { number: 19, direction: 'across', clue: 'Fruit preserve', answer: 'JAM', enumeration: [3], startRow: 9, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Kitchen chief', answer: 'CHEF', enumeration: [4], startRow: 10, startCol: 4 }
    ],
    estimatedTime: 105,
    coinReward: 15
  },

  // ============================================
  // PUZZLE 12: "Space Explorer" - CHALLENGING (12x10)
  // ============================================
  {
    title: "Space Explorer",
    difficulty: Difficulty.CHALLENGING,
    category: "Science",
    grid: { rows: 12, cols: 10 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Night sky', answer: 'STARS', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Space rock', answer: 'ASTEROID', enumeration: [8], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Red planet', answer: 'MARS', enumeration: [4], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Space station', answer: 'ISS', enumeration: [3], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Star path', answer: 'ORBIT', enumeration: [5], startRow: 0, startCol: 8 },
      { number: 6, direction: 'down', clue: 'Space vehicle', answer: 'SHUTTLE', enumeration: [7], startRow: 0, startCol: 9 },
      { number: 7, direction: 'across', clue: 'Space agency', answer: 'NASA', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Moon phase', answer: 'LUNAR', enumeration: [5], startRow: 1, startCol: 4 },
      { number: 9, direction: 'up-across', clue: 'Rocket fuel', answer: 'THRUST', enumeration: [6], startRow: 2, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Space walk', answer: 'EVA', enumeration: [3], startRow: 2, startCol: 4 },
      { number: 11, direction: 'across', clue: 'Solar burst', answer: 'FLARE', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 12, direction: 'down-across', clue: 'Star system', answer: 'GALAXY', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Space suit', answer: 'GEAR', enumeration: [4], startRow: 4, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Alien search', answer: 'SETI', enumeration: [4], startRow: 5, startCol: 5 },
      { number: 15, direction: 'across', clue: 'Icy comet', answer: 'TAIL', enumeration: [4], startRow: 6, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Star death', answer: 'NOVA', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Jupiter moon', answer: 'EUROPA', enumeration: [6], startRow: 8, startCol: 3 },
      { number: 18, direction: 'across', clue: 'Telescope view', answer: 'NEBULA', enumeration: [6], startRow: 9, startCol: 0 },
      { number: 19, direction: 'across', clue: 'Space float', answer: 'ZERO', enumeration: [4], startRow: 10, startCol: 2 },
      { number: 20, direction: 'across', clue: 'Gravity force', answer: 'PULL', enumeration: [4], startRow: 11, startCol: 0 },
      { number: 21, direction: 'across', clue: 'Space probe', answer: 'ROVER', enumeration: [5], startRow: 11, startCol: 4 }
    ],
    estimatedTime: 120,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 13: "Literary Corner" - CHALLENGING (12x12)
  // ============================================
  {
    title: "Literary Corner",
    difficulty: Difficulty.CHALLENGING,
    category: "Culture",
    grid: { rows: 12, cols: 12 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Story writer', answer: 'AUTHOR', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Book part', answer: 'CHAPTER', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Story type', answer: 'GENRE', enumeration: [5], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Book intro', answer: 'PREFACE', enumeration: [7], startRow: 0, startCol: 8 },
      { number: 5, direction: 'down', clue: 'Story end', answer: 'FINALE', enumeration: [6], startRow: 0, startCol: 9 },
      { number: 6, direction: 'down', clue: 'Tale moral', answer: 'LESSON', enumeration: [6], startRow: 0, startCol: 11 },
      { number: 7, direction: 'across', clue: 'Tale setting', answer: 'PLOT', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Book award', answer: 'NOBEL', enumeration: [5], startRow: 1, startCol: 6 },
      { number: 9, direction: 'up-across', clue: 'Story hero', answer: 'PROTAGONIST', enumeration: [11], startRow: 2, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Book shelf', answer: 'LIBRARY', enumeration: [7], startRow: 3, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Writing style', answer: 'PROSE', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 12, direction: 'down', clue: 'Story verse', answer: 'POEM', enumeration: [4], startRow: 4, startCol: 2 },
      { number: 13, direction: 'across', clue: 'Book review', answer: 'CRITIC', enumeration: [6], startRow: 5, startCol: 5 },
      { number: 14, direction: 'across', clue: 'Story quote', answer: 'PASSAGE', enumeration: [7], startRow: 6, startCol: 1 },
      { number: 15, direction: 'across', clue: 'Book print', answer: 'EDITION', enumeration: [7], startRow: 7, startCol: 0 },
      { number: 16, direction: 'across', clue: 'Story form', answer: 'NOVEL', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 17, direction: 'across', clue: 'Book lover', answer: 'READER', enumeration: [6], startRow: 9, startCol: 0 },
      { number: 18, direction: 'across', clue: 'Page turner', answer: 'THRILL', enumeration: [6], startRow: 10, startCol: 4 },
      { number: 19, direction: 'across', clue: 'Story teller', answer: 'NARRATOR', enumeration: [8], startRow: 11, startCol: 0 }
    ],
    estimatedTime: 130,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 14: "Medical Terms" - CHALLENGING (12x12)
  // ============================================
  {
    title: "Medical Terms",
    difficulty: Difficulty.CHALLENGING,
    category: "Science",
    grid: { rows: 12, cols: 12 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Medical exam', answer: 'CHECKUP', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Heart organ', answer: 'CARDIAC', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Bone doctor', answer: 'SURGEON', enumeration: [7], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Medicine dose', answer: 'TABLET', enumeration: [6], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Fever reducer', answer: 'ASPIRIN', enumeration: [7], startRow: 0, startCol: 8 },
      { number: 6, direction: 'down', clue: 'Blood vessel', answer: 'ARTERY', enumeration: [6], startRow: 0, startCol: 11 },
      { number: 7, direction: 'across', clue: 'Hospital bed', answer: 'WARD', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Blood test', answer: 'LAB', enumeration: [3], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Skin doctor', answer: 'DERMA', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 10, direction: 'across', clue: 'Bone image', answer: 'XRAY', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Treatment', answer: 'THERAPY', enumeration: [7], startRow: 4, startCol: 4 },
      { number: 12, direction: 'down-across', clue: 'Heart rate', answer: 'PULSE', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Nerve cell', answer: 'NEURON', enumeration: [6], startRow: 5, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Sleep study', answer: 'REST', enumeration: [4], startRow: 5, startCol: 5 },
      { number: 15, direction: 'down', clue: 'Injection', answer: 'SHOT', enumeration: [4], startRow: 6, startCol: 7 },
      { number: 16, direction: 'across', clue: 'Organ scan', answer: 'MRI', enumeration: [3], startRow: 6, startCol: 1 },
      { number: 17, direction: 'across', clue: 'Pain relief', answer: 'ANALGESIC', enumeration: [9], startRow: 7, startCol: 2 },
      { number: 18, direction: 'across', clue: 'Care giver', answer: 'NURSE', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 19, direction: 'across', clue: 'Illness', answer: 'DISEASE', enumeration: [7], startRow: 9, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Eye doctor', answer: 'OPTICIAN', enumeration: [8], startRow: 10, startCol: 0 },
      { number: 21, direction: 'across', clue: 'Health plan', answer: 'DIET', enumeration: [4], startRow: 11, startCol: 2 },
      { number: 22, direction: 'across', clue: 'First aid', answer: 'BANDAGE', enumeration: [7], startRow: 11, startCol: 4 }
    ],
    estimatedTime: 140,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 15: "Fashion Forward" - CHALLENGING (11x11)
  // ============================================
  {
    title: "Fashion Forward",
    difficulty: Difficulty.CHALLENGING,
    category: "Lifestyle",
    grid: { rows: 11, cols: 11 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Clothes maker', answer: 'TAILOR', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Dress fabric', answer: 'SILK', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Fashion show', answer: 'RUNWAY', enumeration: [6], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Shoe style', answer: 'HEEL', enumeration: [4], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Clothing label', answer: 'BRAND', enumeration: [5], startRow: 0, startCol: 9 },
      { number: 6, direction: 'down', clue: 'Ring holder', answer: 'FINGER', enumeration: [6], startRow: 0, startCol: 10 },
      { number: 7, direction: 'across', clue: 'Hat type', answer: 'CAP', enumeration: [3], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Leg wear', answer: 'PANTS', enumeration: [5], startRow: 1, startCol: 4 },
      { number: 9, direction: 'up-across', clue: 'Fashion trend', answer: 'STYLE', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Neck accessory', answer: 'SCARF', enumeration: [5], startRow: 2, startCol: 3 },
      { number: 11, direction: 'across', clue: 'Jacket type', answer: 'BLAZER', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 12, direction: 'down-across', clue: 'Denim pants', answer: 'JEANS', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Bag type', answer: 'PURSE', enumeration: [5], startRow: 4, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Formal wear', answer: 'SUIT', enumeration: [4], startRow: 4, startCol: 4 },
      { number: 15, direction: 'across', clue: 'Belt buckle', answer: 'CLASP', enumeration: [5], startRow: 5, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Watch band', answer: 'STRAP', enumeration: [5], startRow: 6, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Fabric pattern', answer: 'PLAID', enumeration: [5], startRow: 7, startCol: 4 },
      { number: 18, direction: 'across', clue: 'Casual top', answer: 'SHIRT', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 19, direction: 'across', clue: 'Designer name', answer: 'COUTURE', enumeration: [7], startRow: 9, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Shoe bottom', answer: 'SOLE', enumeration: [4], startRow: 10, startCol: 6 }
    ],
    estimatedTime: 125,
    coinReward: 18
  },

  // ============================================
  // PUZZLE 16: "Ocean Deep" - EXPERT (13x11)
  // ============================================
  {
    title: "Ocean Deep",
    difficulty: Difficulty.EXPERT,
    category: "Nature",
    grid: { rows: 13, cols: 11 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Sea creature', answer: 'DOLPHIN', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Ocean wave', answer: 'TIDE', enumeration: [4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Coral home', answer: 'REEF', enumeration: [4], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Sea plant', answer: 'KELP', enumeration: [4], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Ocean floor', answer: 'SEABED', enumeration: [6], startRow: 0, startCol: 9 },
      { number: 6, direction: 'down', clue: 'Eight arms', answer: 'OCTOPUS', enumeration: [7], startRow: 0, startCol: 10 },
      { number: 7, direction: 'across', clue: 'Water salt', answer: 'BRINE', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Fish eggs', answer: 'ROE', enumeration: [3], startRow: 1, startCol: 6 },
      { number: 9, direction: 'up-across', clue: 'Deep diver', answer: 'SCUBA', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Shell home', answer: 'CONCH', enumeration: [5], startRow: 2, startCol: 3 },
      { number: 11, direction: 'across', clue: 'Sea mammal', answer: 'WHALE', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 12, direction: 'across', clue: 'Ocean zone', answer: 'PELAGIC', enumeration: [7], startRow: 4, startCol: 3 },
      { number: 13, direction: 'down-across', clue: 'Sailor term', answer: 'NAUTICAL', enumeration: [8], startRow: 5, startCol: 0 },
      { number: 14, direction: 'down', clue: 'Sea predator', answer: 'SHARK', enumeration: [5], startRow: 5, startCol: 2 },
      { number: 15, direction: 'across', clue: 'Beach bird', answer: 'GULL', enumeration: [4], startRow: 5, startCol: 5 },
      { number: 16, direction: 'across', clue: 'Ocean depth', answer: 'ABYSS', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 17, direction: 'across', clue: 'Sea current', answer: 'STREAM', enumeration: [6], startRow: 7, startCol: 0 },
      { number: 18, direction: 'across', clue: 'Fish breathe', answer: 'GILLS', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 19, direction: 'across', clue: 'Ocean motion', answer: 'SWELL', enumeration: [5], startRow: 9, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Sea foam', answer: 'FROTH', enumeration: [5], startRow: 10, startCol: 4 },
      { number: 21, direction: 'across', clue: 'Fishing net', answer: 'TRAWL', enumeration: [5], startRow: 11, startCol: 1 },
      { number: 22, direction: 'across', clue: 'Sea anchor', answer: 'MOORING', enumeration: [7], startRow: 12, startCol: 0 },
      { number: 23, direction: 'across', clue: 'Beach sand', answer: 'SHORE', enumeration: [5], startRow: 12, startCol: 5 }
    ],
    estimatedTime: 150,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 17: "Legal Eagles" - EXPERT (14x11)
  // ============================================
  {
    title: "Legal Eagles",
    difficulty: Difficulty.EXPERT,
    category: "Profession",
    grid: { rows: 14, cols: 11 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Court case', answer: 'TRIAL', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Legal advisor', answer: 'COUNSEL', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Judge decision', answer: 'VERDICT', enumeration: [7], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Court order', answer: 'WRIT', enumeration: [4], startRow: 0, startCol: 7 },
      { number: 5, direction: 'down', clue: 'Legal paper', answer: 'DOCUMENT', enumeration: [8], startRow: 0, startCol: 8 },
      { number: 6, direction: 'down', clue: 'Legal binding', answer: 'CONTRACT', enumeration: [8], startRow: 0, startCol: 10 },
      { number: 7, direction: 'across', clue: 'Legal team', answer: 'FIRM', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Court panel', answer: 'JURY', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Witness stand', answer: 'BOX', enumeration: [3], startRow: 2, startCol: 3 },
      { number: 10, direction: 'across', clue: 'Legal suit', answer: 'LAWSUIT', enumeration: [7], startRow: 3, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Court plea', answer: 'APPEAL', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 12, direction: 'down', clue: 'Evidence', answer: 'PROOF', enumeration: [5], startRow: 4, startCol: 2 },
      { number: 13, direction: 'across', clue: 'Legal right', answer: 'CLAIM', enumeration: [5], startRow: 5, startCol: 5 },
      { number: 14, direction: 'across', clue: 'Court fine', answer: 'PENALTY', enumeration: [7], startRow: 6, startCol: 1 },
      { number: 15, direction: 'across', clue: 'Judge robe', answer: 'GOWN', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 16, direction: 'across', clue: 'Legal oath', answer: 'SWEAR', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 17, direction: 'across', clue: 'Court session', answer: 'HEARING', enumeration: [7], startRow: 9, startCol: 0 },
      { number: 18, direction: 'across', clue: 'Legal defense', answer: 'ALIBI', enumeration: [5], startRow: 10, startCol: 1 },
      { number: 19, direction: 'across', clue: 'Court charge', answer: 'INDICT', enumeration: [6], startRow: 11, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Legal brief', answer: 'MOTION', enumeration: [6], startRow: 12, startCol: 4 },
      { number: 21, direction: 'across', clue: 'Witness list', answer: 'ROSTER', enumeration: [6], startRow: 13, startCol: 0 }
    ],
    estimatedTime: 160,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 18: "Ancient History" - EXPERT (13x12)
  // ============================================
  {
    title: "Ancient History",
    difficulty: Difficulty.EXPERT,
    category: "History",
    grid: { rows: 13, cols: 12 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Egyptian king', answer: 'PHARAOH', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Greek temple', answer: 'PARTHENON', enumeration: [9], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Roman ruler', answer: 'EMPEROR', enumeration: [7], startRow: 0, startCol: 6 },
      { number: 4, direction: 'left-down', clue: 'Ancient text', answer: 'SCROLL', enumeration: [6], startRow: 0, startCol: 8 },
      { number: 5, direction: 'down', clue: 'Stone pillar', answer: 'OBELISK', enumeration: [7], startRow: 0, startCol: 10 },
      { number: 6, direction: 'down', clue: 'Greek warrior', answer: 'HOPLITE', enumeration: [7], startRow: 0, startCol: 11 },
      { number: 7, direction: 'across', clue: 'Battle ground', answer: 'ARENA', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Greek city', answer: 'SPARTA', enumeration: [6], startRow: 2, startCol: 5 },
      { number: 9, direction: 'up-across', clue: 'Roman road', answer: 'VIA', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 10, direction: 'across', clue: 'Ancient ship', answer: 'GALLEY', enumeration: [6], startRow: 3, startCol: 4 },
      { number: 11, direction: 'across', clue: 'Greek myth', answer: 'LEGEND', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 12, direction: 'down-across', clue: 'Ancient tomb', answer: 'PYRAMID', enumeration: [7], startRow: 5, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Greek god', answer: 'ZEUS', enumeration: [4], startRow: 5, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Roman bath', answer: 'THERMAE', enumeration: [7], startRow: 6, startCol: 4 },
      { number: 15, direction: 'across', clue: 'Ancient coin', answer: 'DENARIUS', enumeration: [8], startRow: 7, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Roman senate', answer: 'FORUM', enumeration: [5], startRow: 8, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Ancient empire', answer: 'PERSIAN', enumeration: [7], startRow: 9, startCol: 4 },
      { number: 18, direction: 'across', clue: 'Greek column', answer: 'IONIC', enumeration: [5], startRow: 10, startCol: 2 },
      { number: 19, direction: 'across', clue: 'Ancient art', answer: 'MOSAIC', enumeration: [6], startRow: 11, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Roman soldier', answer: 'LEGION', enumeration: [6], startRow: 11, startCol: 5 },
      { number: 21, direction: 'across', clue: 'Greek theater', answer: 'DRAMA', enumeration: [5], startRow: 12, startCol: 6 },
      { number: 22, direction: 'across', clue: 'Ancient script', answer: 'HIEROGLYPH', enumeration: [10], startRow: 12, startCol: 0 }
    ],
    estimatedTime: 170,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 19: "Business World" - EXPERT (13x11)
  // ============================================
  {
    title: "Business World",
    difficulty: Difficulty.EXPERT,
    category: "Finance",
    grid: { rows: 13, cols: 11 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Company head', answer: 'CHAIRMAN', enumeration: [8], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Stock market', answer: 'EXCHANGE', enumeration: [8], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Business plan', answer: 'STRATEGY', enumeration: [8], startRow: 0, startCol: 6 },
      { number: 4, direction: 'left-down', clue: 'Profit margin', answer: 'GAIN', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 5, direction: 'down', clue: 'Market share', answer: 'SEGMENT', enumeration: [7], startRow: 0, startCol: 9 },
      { number: 6, direction: 'down', clue: 'Investment', answer: 'CAPITAL', enumeration: [7], startRow: 0, startCol: 10 },
      { number: 7, direction: 'across', clue: 'Bank account', answer: 'DEPOSIT', enumeration: [7], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Trade deal', answer: 'MERGER', enumeration: [6], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Budget item', answer: 'EXPENSE', enumeration: [7], startRow: 3, startCol: 3 },
      { number: 10, direction: 'across', clue: 'Company stock', answer: 'SHARES', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 11, direction: 'down-across', clue: 'Tax report', answer: 'RETURN', enumeration: [6], startRow: 5, startCol: 0 },
      { number: 12, direction: 'down', clue: 'Money lender', answer: 'BANKER', enumeration: [6], startRow: 5, startCol: 2 },
      { number: 13, direction: 'across', clue: 'Sales pitch', answer: 'PROPOSAL', enumeration: [8], startRow: 6, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Asset value', answer: 'EQUITY', enumeration: [6], startRow: 7, startCol: 1 },
      { number: 15, direction: 'across', clue: 'Board meeting', answer: 'AGENDA', enumeration: [6], startRow: 8, startCol: 0 },
      { number: 16, direction: 'across', clue: 'Market trend', answer: 'GROWTH', enumeration: [6], startRow: 9, startCol: 2 },
      { number: 17, direction: 'across', clue: 'Trade balance', answer: 'SURPLUS', enumeration: [7], startRow: 10, startCol: 0 },
      { number: 18, direction: 'across', clue: 'Finance term', answer: 'REVENUE', enumeration: [7], startRow: 11, startCol: 1 },
      { number: 19, direction: 'across', clue: 'Startup fund', answer: 'VENTURE', enumeration: [7], startRow: 12, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Stock option', answer: 'BOND', enumeration: [4], startRow: 12, startCol: 6 },
      { number: 21, direction: 'across', clue: 'Annual report', answer: 'STATEMENT', enumeration: [9], startRow: 12, startCol: 0 }
    ],
    estimatedTime: 165,
    coinReward: 22
  },

  // ============================================
  // PUZZLE 20: "Architecture" - EXPERT (14x12)
  // ============================================
  {
    title: "Architecture",
    difficulty: Difficulty.EXPERT,
    category: "Art",
    grid: { rows: 14, cols: 12 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Building design', answer: 'BLUEPRINT', enumeration: [9], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Roof style', answer: 'GABLE', enumeration: [5], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Support beam', answer: 'PILLAR', enumeration: [6], startRow: 0, startCol: 5 },
      { number: 4, direction: 'left-down', clue: 'Window type', answer: 'DORMER', enumeration: [6], startRow: 0, startCol: 8 },
      { number: 5, direction: 'down', clue: 'Floor plan', answer: 'LAYOUT', enumeration: [6], startRow: 0, startCol: 10 },
      { number: 6, direction: 'down', clue: 'Roof edge', answer: 'EAVES', enumeration: [5], startRow: 0, startCol: 11 },
      { number: 7, direction: 'across', clue: 'Building front', answer: 'FACADE', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 8, direction: 'up-across', clue: 'Curved roof', answer: 'DOME', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Stone work', answer: 'MASONRY', enumeration: [7], startRow: 3, startCol: 4 },
      { number: 10, direction: 'across', clue: 'Entry hall', answer: 'FOYER', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Stair rail', answer: 'BANISTER', enumeration: [8], startRow: 4, startCol: 3 },
      { number: 12, direction: 'down-across', clue: 'Design style', answer: 'MODERN', enumeration: [6], startRow: 5, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Column base', answer: 'PLINTH', enumeration: [6], startRow: 5, startCol: 2 },
      { number: 14, direction: 'across', clue: 'Window frame', answer: 'SASH', enumeration: [4], startRow: 5, startCol: 5 },
      { number: 15, direction: 'across', clue: 'Floor tile', answer: 'MARBLE', enumeration: [6], startRow: 6, startCol: 1 },
      { number: 16, direction: 'across', clue: 'Wall finish', answer: 'PLASTER', enumeration: [7], startRow: 7, startCol: 0 },
      { number: 17, direction: 'across', clue: 'Open area', answer: 'ATRIUM', enumeration: [6], startRow: 8, startCol: 2 },
      { number: 18, direction: 'across', clue: 'Stone arch', answer: 'KEYSTONE', enumeration: [8], startRow: 9, startCol: 0 },
      { number: 19, direction: 'across', clue: 'Room divider', answer: 'PARTITION', enumeration: [9], startRow: 10, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Ceiling art', answer: 'FRESCO', enumeration: [6], startRow: 11, startCol: 1 },
      { number: 21, direction: 'across', clue: 'Building wing', answer: 'ANNEX', enumeration: [5], startRow: 12, startCol: 0 },
      { number: 22, direction: 'across', clue: 'Design plan', answer: 'SKETCH', enumeration: [6], startRow: 12, startCol: 5 },
      { number: 23, direction: 'across', clue: 'Tower top', answer: 'SPIRE', enumeration: [5], startRow: 13, startCol: 2 },
      { number: 24, direction: 'across', clue: 'Porch column', answer: 'POST', enumeration: [4], startRow: 13, startCol: 7 }
    ],
    estimatedTime: 180,
    coinReward: 25
  }
];

// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

/**
 * Validation function to check if all clues fit within the grid boundaries.
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
  availableSpace: number;
  requiredSpace: number;
}

function validatePuzzle(puzzle: typeof samplePuzzles[0]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { rows, cols } = puzzle.grid;

  for (const clue of puzzle.clues) {
    const answerLength = clue.answer.length;
    const { startRow, startCol, direction, answer, number: clueNum } = clue;
    
    let availableSpace = 0;
    let requiredSpace = answerLength;
    let errorMsg = '';

    switch (direction) {
      case 'down':
        // Answer starts at (startRow+1, startCol), goes DOWN
        availableSpace = rows - startRow - 1;
        if (answerLength > availableSpace) {
          errorMsg = `DOWN: starts at row ${startRow + 1}, needs ${answerLength} rows but only ${availableSpace} available`;
        }
        break;

      case 'right-down':
        // Answer starts at (startRow, startCol+1), goes DOWN
        availableSpace = rows - startRow;
        if (answerLength > availableSpace) {
          errorMsg = `RIGHT-DOWN: starts at row ${startRow}, needs ${answerLength} rows but only ${availableSpace} available`;
        }
        if (startCol + 1 >= cols) {
          errorMsg = `RIGHT-DOWN: startCol+1 (${startCol + 1}) is out of bounds (cols=${cols})`;
        }
        break;

      case 'left-down':
        // Answer starts at (startRow, startCol-1), goes DOWN
        availableSpace = rows - startRow;
        if (answerLength > availableSpace) {
          errorMsg = `LEFT-DOWN: starts at row ${startRow}, needs ${answerLength} rows but only ${availableSpace} available`;
        }
        if (startCol - 1 < 0) {
          errorMsg = `LEFT-DOWN: startCol-1 (${startCol - 1}) is out of bounds`;
        }
        break;

      case 'across':
        // Answer starts at (startRow, startCol+1), goes RIGHT
        availableSpace = cols - startCol - 1;
        if (answerLength > availableSpace) {
          errorMsg = `ACROSS: starts at col ${startCol + 1}, needs ${answerLength} cols but only ${availableSpace} available`;
        }
        break;

      case 'down-across':
        // Answer starts at (startRow+1, startCol), goes RIGHT
        availableSpace = cols - startCol;
        if (answerLength > availableSpace) {
          errorMsg = `DOWN-ACROSS: starts at col ${startCol}, needs ${answerLength} cols but only ${availableSpace} available`;
        }
        if (startRow + 1 >= rows) {
          errorMsg = `DOWN-ACROSS: startRow+1 (${startRow + 1}) is out of bounds (rows=${rows})`;
        }
        break;

      case 'up-across':
        // Answer starts at (startRow-1, startCol), goes RIGHT
        availableSpace = cols - startCol;
        if (answerLength > availableSpace) {
          errorMsg = `UP-ACROSS: starts at col ${startCol}, needs ${answerLength} cols but only ${availableSpace} available`;
        }
        if (startRow - 1 < 0) {
          errorMsg = `UP-ACROSS: startRow-1 (${startRow - 1}) is out of bounds`;
        }
        break;
    }

    if (errorMsg) {
      errors.push({
        puzzleTitle: puzzle.title,
        clueNumber: clueNum,
        clue: clue.clue,
        answer,
        direction,
        error: errorMsg,
        availableSpace,
        requiredSpace
      });
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

// Run validation before seeding
validateAllPuzzles();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arrow-crossword');
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