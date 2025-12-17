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
 * - 'across': arrow points RIGHT → answer goes horizontally starting at (row, col+1)
 * - 'down': arrow points DOWN ↓ answer goes vertically starting at (row+1, col)
 * - 'right-down': arrow points DIAGONAL ↘ answer goes DOWN starting at (row, col+1)
 * - 'left-down': arrow points DIAGONAL ↙ answer goes DOWN starting at (row, col-1)
 * - 'down-across': arrow points DOWN-RIGHT ⌐ answer goes RIGHT starting at (row+1, col)
 * - 'up-across': arrow points UP-RIGHT ⌐ answer goes RIGHT starting at (row-1, col)
 * 
 * Grid cells are either:
 * - CLUE CELLS: contain question + arrow (not fillable by player)
 * - LETTER CELLS: contain the answer letters (fillable by player)
 * 
 * Proper crossword design requires answers to INTERSECT and share letters!
 */

const samplePuzzles = [
  // ============================================
  // EASY PUZZLES - 10x10 grid
  // ============================================
  {
    title: "Pet Paradise",
    difficulty: Difficulty.EASY,
    category: "Animals",
    grid: {
      rows: 10,
      cols: 10
    },
    /**
     * Grid Layout (C = clue cell, letters show answers):
     * 
     *     0   1   2   3   4   5   6   7   8   9
     * 0   C→  D   O   G   C→  C   A   T   _   _
     * 1   C↓  _   _   C↓  C→  I   S   H   _   _
     * 2   B   _   _   R   _   _   _   _   _   _
     * 3   I   _   _   A   _   C→  A   N   T   _
     * 4   R   _   _   T   _   _   _   _   _   _
     * 5   D   _   _   _   _   _   _   _   _   _
     * 6   C→  B   E   E   _   _   _   _   _   _
     * 7   _   _   _   _   _   _   _   _   _   _
     * 8   C→  H   E   N   _   _   _   _   _   _
     * 9   _   _   _   _   _   _   _   _   _   _
     * 
     * Intersections: DOG/D from BIRD, CAT/A shares column with RAT, etc.
     */
    clues: [
      { number: 1, direction: 'across', clue: "Man's best friend", answer: 'DOG', startRow: 0, startCol: 0 },
      { number: 2, direction: 'across', clue: 'Purring pet', answer: 'CAT', startRow: 0, startCol: 4 },
      { number: 3, direction: 'down', clue: 'Flying animal with feathers', answer: 'BIRD', startRow: 1, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Cheese lover rodent', answer: 'RAT', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Swims with fins', answer: 'FISH', startRow: 1, startCol: 4 },
      { number: 6, direction: 'across', clue: 'Tiny insect at picnics', answer: 'ANT', startRow: 3, startCol: 5 },
      { number: 7, direction: 'across', clue: 'Makes honey', answer: 'BEE', startRow: 6, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Female chicken', answer: 'HEN', startRow: 8, startCol: 0 },
    ],
    estimatedTime: 120,
    coinReward: 15
  },
  {
    title: "Kitchen Basics",
    difficulty: Difficulty.EASY,
    category: "Food",
    grid: {
      rows: 10,
      cols: 10
    },
    /**
     * Grid Layout:
     *     0   1   2   3   4   5   6   7   8   9
     * 0   C→  R   I   C   E   _   _   _   _   _
     * 1   _   _   _   _   C↓  _   _   _   _   _
     * 2   C→  M   E   A   T   _   _   _   _   _
     * 3   _   C↓  _   _   E   _   _   _   _   _
     * 4   _   I   _   _   A   _   _   _   _   _
     * 5   C→  L   E   M   O   N   _   _   _   _
     * 6   _   K   _   _   _   C↓  _   _   _   _
     * 7   _   _   _   _   _   U   _   _   _   _
     * 8   C→  P   I   E   _   T   _   _   _   _
     * 9   _   _   _   _   _   S   _   _   _   _
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Asian staple grain', answer: 'RICE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Hot drink from leaves', answer: 'TEA', startRow: 1, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Protein from animals', answer: 'MEAT', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'White drink from cows', answer: 'MILK', startRow: 3, startCol: 1 },
      { number: 5, direction: 'across', clue: 'Sour yellow citrus', answer: 'LEMON', startRow: 5, startCol: 0 },
      { number: 6, direction: 'down', clue: 'Seeds that go in trail mix', answer: 'NUTS', startRow: 6, startCol: 5 },
      { number: 7, direction: 'across', clue: 'Dessert with crust', answer: 'PIE', startRow: 8, startCol: 0 },
    ],
    estimatedTime: 120,
    coinReward: 15
  },
  {
    title: "Nature Walk",
    difficulty: Difficulty.EASY,
    category: "Nature",
    grid: {
      rows: 10,
      cols: 10
    },
    /**
     * Grid with interlocking nature words
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Blue expanse above us', answer: 'SKY', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Bright star we orbit', answer: 'SUN', startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Tall plant with bark', answer: 'TREE', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Rain storage in sky', answer: 'CLOUD', startRow: 1, startCol: 7 },
      { number: 5, direction: 'across', clue: 'H2O from faucet', answer: 'WATER', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Beautiful bloom', answer: 'ROSE', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Green ground cover', answer: 'GRASS', startRow: 3, startCol: 3 },
      { number: 8, direction: 'across', clue: 'Night sky body', answer: 'MOON', startRow: 8, startCol: 0 },
    ],
    estimatedTime: 120,
    coinReward: 15
  },

  // ============================================
  // MEDIUM PUZZLES - 12x12 grid
  // ============================================
  {
    title: "City Life",
    difficulty: Difficulty.MEDIUM,
    category: "Geography",
    grid: {
      rows: 12,
      cols: 12
    },
    /**
     * Larger grid with more complex interlocking
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Capital of France', answer: 'PARIS', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Eternal city in Italy', answer: 'ROME', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Big Apple city', answer: 'NEWYORK', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Egyptian capital', answer: 'CAIRO', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Japan capital', answer: 'TOKYO', startRow: 4, startCol: 0 },
      { number: 6, direction: 'down', clue: 'City of love (same as 1)', answer: 'PARIS', startRow: 3, startCol: 8 },
      { number: 7, direction: 'across', clue: 'British capital', answer: 'LONDON', startRow: 6, startCol: 0 },
      { number: 8, direction: 'across', clue: 'German capital', answer: 'BERLIN', startRow: 8, startCol: 0 },
      { number: 9, direction: 'down', clue: 'Spanish capital', answer: 'MADRID', startRow: 5, startCol: 5 },
      { number: 10, direction: 'across', clue: 'Greek capital', answer: 'ATHENS', startRow: 10, startCol: 0 },
    ],
    estimatedTime: 240,
    coinReward: 25
  },
  {
    title: "Movie Night",
    difficulty: Difficulty.MEDIUM,
    category: "Movies",
    grid: {
      rows: 12,
      cols: 12
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Spielberg shark film', answer: 'JAWS', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Space saga by Lucas', answer: 'STARWARS', startRow: 0, startCol: 5 },
      { number: 3, direction: 'across', clue: 'Ridley Scott alien film', answer: 'ALIEN', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Pixar fish movie', answer: 'NEMO', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'DiCaprio dream heist', answer: 'INCEPTION', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Boat disaster film', answer: 'TITANIC', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Boxing underdog film', answer: 'ROCKY', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Matrix hero', answer: 'NEO', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Wizard of ___ (1939)', answer: 'OZ', startRow: 10, startCol: 0 },
    ],
    estimatedTime: 240,
    coinReward: 25
  },
  {
    title: "Sports Arena",
    difficulty: Difficulty.MEDIUM,
    category: "Sports",
    grid: {
      rows: 12,
      cols: 12
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Soccer objective', answer: 'GOAL', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Basketball league', answer: 'NBA', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Group of players', answer: 'TEAM', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Tennis equipment', answer: 'RACKET', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Running competition', answer: 'RACE', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Baseball hit for four bases', answer: 'HOMERUN', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Olympic host city 2024', answer: 'PARIS', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Swimming pool length', answer: 'LAP', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Golf target', answer: 'HOLE', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Football shape', answer: 'OVAL', startRow: 7, startCol: 5 },
    ],
    estimatedTime: 240,
    coinReward: 25
  },

  // ============================================
  // HARD PUZZLES - 14x14 grid
  // ============================================
  {
    title: "Hip Hop Legends",
    difficulty: Difficulty.HARD,
    category: "Music",
    grid: {
      rows: 14,
      cols: 14
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Lose Yourself rapper', answer: 'EMINEM', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Headphones brand founder', answer: 'DRE', startRow: 0, startCol: 8 },
      { number: 3, direction: 'across', clue: 'Hotline Bling artist', answer: 'DRAKE', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Spoken word over beats', answer: 'RAP', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'Yeezy creator', answer: 'KANYE', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: '99 Problems artist', answer: 'JAYZ', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Instrumental backing', answer: 'BEATS', startRow: 5, startCol: 7 },
      { number: 8, direction: 'across', clue: 'Illmatic rapper', answer: 'NAS', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Alright rapper Kendrick', answer: 'LAMAR', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Hit song', answer: 'TRACK', startRow: 7, startCol: 10 },
      { number: 11, direction: 'across', clue: 'California Love rapper', answer: 'TUPAC', startRow: 12, startCol: 0 },
    ],
    estimatedTime: 360,
    coinReward: 40
  },
  {
    title: "Science Lab",
    difficulty: Difficulty.HARD,
    category: "Science",
    grid: {
      rows: 14,
      cols: 14
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Smallest particle of element', answer: 'ATOM', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Genetic blueprint', answer: 'DNA', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Focused light beam', answer: 'LASER', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Table of elements is...', answer: 'PERIODIC', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Basic unit of life', answer: 'CELL', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Einsteins famous equation letter', answer: 'EMC', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'H2O state at 100C', answer: 'STEAM', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Study of stars', answer: 'ASTRONOMY', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Resistance unit', answer: 'OHM', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Chemical reaction speed', answer: 'RATE', startRow: 9, startCol: 5 },
      { number: 11, direction: 'across', clue: 'Proton home', answer: 'NUCLEUS', startRow: 12, startCol: 0 },
    ],
    estimatedTime: 360,
    coinReward: 40
  },
  {
    title: "Tech World",
    difficulty: Difficulty.HARD,
    category: "Technology",
    grid: {
      rows: 14,
      cols: 14
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Programmers write this', answer: 'CODE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Mobile program', answer: 'APP', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Popular programming language', answer: 'PYTHON', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Random access memory', answer: 'RAM', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Google Chrome is one', answer: 'BROWSER', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Apples assistant', answer: 'SIRI', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Central processing unit', answer: 'CPU', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Cloud storage giant', answer: 'AWS', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Version control system', answer: 'GIT', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Software interface', answer: 'API', startRow: 9, startCol: 5 },
      { number: 11, direction: 'across', clue: 'Elon Musks AI company', answer: 'OPENAI', startRow: 12, startCol: 0 },
    ],
    estimatedTime: 360,
    coinReward: 40
  },

  // ============================================
  // EXPERT PUZZLES - 16x16 grid
  // ============================================
  {
    title: "History Quest",
    difficulty: Difficulty.EXPERT,
    category: "History",
    grid: {
      rows: 16,
      cols: 16
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Ancient empire capital in Italy', answer: 'ROME', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Egyptian boy king', answer: 'TUT', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Greek philosopher who drank hemlock', answer: 'SOCRATES', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'French emperor', answer: 'NAPOLEON', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'American civil rights leader', answer: 'MLKING', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'British WWII prime minister', answer: 'CHURCHILL', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Roman emperor who fiddled', answer: 'NERO', startRow: 5, startCol: 10 },
      { number: 8, direction: 'across', clue: 'Viking explorer to America', answer: 'LEIF', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Indian independence leader', answer: 'GANDHI', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Russian revolution leader', answer: 'LENIN', startRow: 9, startCol: 6 },
      { number: 11, direction: 'across', clue: 'Macedonian conqueror', answer: 'ALEXANDER', startRow: 12, startCol: 0 },
      { number: 12, direction: 'across', clue: 'Chinese dynasty known for wall', answer: 'MING', startRow: 14, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 60
  },
  {
    title: "Literature Classics",
    difficulty: Difficulty.EXPERT,
    category: "Literature",
    grid: {
      rows: 16,
      cols: 16
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Romeo and Juliet author', answer: 'SHAKESPEARE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Great Gatsby author F. Scott', answer: 'FITZGERALD', startRow: 0, startCol: 12 },
      { number: 3, direction: 'across', clue: '1984 author George', answer: 'ORWELL', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Harry Potter creator', answer: 'ROWLING', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'Pride and Prejudice author', answer: 'AUSTEN', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Lord of the Rings author', answer: 'TOLKIEN', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Sherlock Holmes creator', answer: 'DOYLE', startRow: 5, startCol: 9 },
      { number: 8, direction: 'across', clue: 'The Raven poet', answer: 'POE', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Don Quixote author', answer: 'CERVANTES', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Tale of Two Cities author', answer: 'DICKENS', startRow: 9, startCol: 6 },
      { number: 11, direction: 'across', clue: 'Moby Dick author', answer: 'MELVILLE', startRow: 12, startCol: 0 },
      { number: 12, direction: 'across', clue: 'War and Peace author', answer: 'TOLSTOY', startRow: 14, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 60
  },
  {
    title: "World Capitals Challenge",
    difficulty: Difficulty.EXPERT,
    category: "Geography",
    grid: {
      rows: 16,
      cols: 16
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Australian capital (not Sydney)', answer: 'CANBERRA', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Brazilian capital (not Rio)', answer: 'BRASILIA', startRow: 0, startCol: 10 },
      { number: 3, direction: 'across', clue: 'Canadian capital', answer: 'OTTAWA', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'South African legislative capital', answer: 'CAPETOWN', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'Indian capital', answer: 'NEWDELHI', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Moroccan capital (not Casablanca)', answer: 'RABAT', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Turkish capital (not Istanbul)', answer: 'ANKARA', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Vietnamese capital', answer: 'HANOI', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Nigerian capital (not Lagos)', answer: 'ABUJA', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Myanmar capital', answer: 'NAYPYIDAW', startRow: 9, startCol: 6 },
      { number: 11, direction: 'across', clue: 'Swiss capital', answer: 'BERN', startRow: 12, startCol: 0 },
      { number: 12, direction: 'across', clue: 'South Korean capital', answer: 'SEOUL', startRow: 14, startCol: 0 },
    ],
    estimatedTime: 540,
    coinReward: 70
  },
  {
    title: "Brain Buster",
    difficulty: Difficulty.EXPERT,
    category: "General",
    grid: {
      rows: 16,
      cols: 16
    },
    clues: [
      { number: 1, direction: 'across', clue: 'You are solving one now', answer: 'CROSSWORD', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Reasoning skill', answer: 'LOGIC', startRow: 0, startCol: 10 },
      { number: 3, direction: 'across', clue: 'Hint to find answer', answer: 'CLUE', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Thinking organ', answer: 'BRAIN', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'Mental challenge', answer: 'PUZZLE', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Quick thinking', answer: 'WIT', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Smart', answer: 'CLEVER', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Memory recall', answer: 'REMEMBER', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Creative thought', answer: 'IDEA', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Deep thought', answer: 'PONDER', startRow: 9, startCol: 6 },
      { number: 11, direction: 'across', clue: 'Figure it out', answer: 'SOLVE', startRow: 12, startCol: 0 },
      { number: 12, direction: 'across', clue: 'Intelligence test', answer: 'IQ', startRow: 14, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 60
  },

  // ============================================
  // ADDITIONAL VARIETY PUZZLES
  // ============================================
  {
    title: "TV Binge",
    difficulty: Difficulty.MEDIUM,
    category: "TV Shows",
    grid: {
      rows: 12,
      cols: 12
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Island mystery series', answer: 'LOST', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'NYC coffee shop sitcom', answer: 'FRIENDS', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Medical drama Dr. ___', answer: 'HOUSE', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Meth cooking drama', answer: 'BREAKING', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Upside down Netflix horror', answer: 'STRANGER', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Westeros fantasy show', answer: 'GOT', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Paper company sitcom', answer: 'OFFICE', startRow: 5, startCol: 7 },
      { number: 8, direction: 'across', clue: 'High school musical show', answer: 'GLEE', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Crime scene investigators', answer: 'CSI', startRow: 10, startCol: 0 },
    ],
    estimatedTime: 240,
    coinReward: 25
  },
  {
    title: "Animal Kingdom",
    difficulty: Difficulty.MEDIUM,
    category: "Animals",
    grid: {
      rows: 12,
      cols: 12
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Striped big cat', answer: 'TIGER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Ocean gentle giant', answer: 'WHALE', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'King of the jungle', answer: 'LION', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Tall African animal', answer: 'GIRAFFE', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Bird with sharp eyes', answer: 'EAGLE', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Ocean predator with fins', answer: 'SHARK', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Black and white bear', answer: 'PANDA', startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Slow shelled reptile', answer: 'TURTLE', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Cunning forest animal', answer: 'FOX', startRow: 10, startCol: 0 },
    ],
    estimatedTime: 240,
    coinReward: 25
  },
  {
    title: "Music Icons",
    difficulty: Difficulty.HARD,
    category: "Music",
    grid: {
      rows: 14,
      cols: 14
    },
    clues: [
      { number: 1, direction: 'across', clue: 'King of Pop', answer: 'MICHAEL', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Like a Virgin singer', answer: 'MADONNA', startRow: 0, startCol: 9 },
      { number: 3, direction: 'across', clue: 'British band: ___ Zeppelin', answer: 'LED', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'Bohemian Rhapsody band', answer: 'QUEEN', startRow: 1, startCol: 3 },
      { number: 5, direction: 'across', clue: 'Purple Rain artist', answer: 'PRINCE', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Fab Four from Liverpool', answer: 'BEATLES', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Rolling in the Deep singer', answer: 'ADELE', startRow: 5, startCol: 10 },
      { number: 8, direction: 'across', clue: 'Satisfaction rockers', answer: 'STONES', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Hello singer (same as 7)', answer: 'ADELE', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Jazz legend Louis', answer: 'ARMSTRONG', startRow: 9, startCol: 5 },
      { number: 11, direction: 'across', clue: 'Rocket Man singer', answer: 'ELTON', startRow: 12, startCol: 0 },
    ],
    estimatedTime: 360,
    coinReward: 40
  },
  {
    title: "Food World Tour",
    difficulty: Difficulty.HARD,
    category: "Food",
    grid: {
      rows: 14,
      cols: 14
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Italian pie with toppings', answer: 'PIZZA', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Japanese raw fish', answer: 'SUSHI', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Mexican wrapped dish', answer: 'BURRITO', startRow: 2, startCol: 0 },
      { number: 4, direction: 'down', clue: 'French pastry', answer: 'CROISSANT', startRow: 1, startCol: 4 },
      { number: 5, direction: 'across', clue: 'Indian spiced dish', answer: 'CURRY', startRow: 4, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Chinese stir fry pan', answer: 'WOK', startRow: 6, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Greek yogurt dip', answer: 'TZATZIKI', startRow: 5, startCol: 9 },
      { number: 8, direction: 'across', clue: 'Thai noodle dish', answer: 'PADTHAI', startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Spanish rice dish', answer: 'PAELLA', startRow: 10, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Middle Eastern chickpea spread', answer: 'HUMMUS', startRow: 9, startCol: 5 },
      { number: 11, direction: 'across', clue: 'Korean fermented cabbage', answer: 'KIMCHI', startRow: 12, startCol: 0 },
    ],
    estimatedTime: 360,
    coinReward: 40
  }
];


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
