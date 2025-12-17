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
    title: "Simple Beginnings",
    difficulty: Difficulty.EASY,
    category: "General",
    grid: {
      rows: 5,
      cols: 6
    },
    /**
     * Grid visualization (C = clue cell, letters = answer):
     * 
     *   0   1   2   3   4   5
     * 0 [C→][D ][O ][G ][C↓][ ]
     * 1 [C→][C ][A ][T ][S ][ ]
     * 2 [C→][R ][E ][D ][U ][ ]
     * 3 [C→][A ][N ][T ][N ][ ]
     * 4 [C→][B ][E ][D ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Mans best friend', answer: 'DOG', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Bright star', answer: 'SUN', startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Color of blood', answer: 'RED', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Tiny insect', answer: 'ANT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'You sleep in it', answer: 'BED', startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Nature Walk",
    difficulty: Difficulty.EASY,
    category: "Nature",
    grid: {
      rows: 5,
      cols: 6
    },
    /**
     * Grid visualization:
     *   0   1   2   3   4   5
     * 0 [C→][S ][K ][Y ][C↓][ ]
     * 1 [C→][T ][R ][E ][E ][ ]
     * 2 [C→][S ][E ][A ][A ][ ]
     * 3 [C→][S ][U ][N ][R ][ ]
     * 4 [C→][B ][E ][E ][T ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Above us, its blue', answer: 'SKY', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Planet we live on', answer: 'EARTH', startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Has leaves and bark', answer: 'TREE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Salty water body', answer: 'SEA', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Gives us light and heat', answer: 'SUN', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Makes honey', answer: 'BEE', startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Daily Challenge",
    difficulty: Difficulty.MEDIUM,
    category: "General",
    grid: {
      rows: 6,
      cols: 7
    },
    /**
     * Grid visualization:
     *   0   1   2   3   4   5   6
     * 0 [C→][P ][A ][R ][I ][S ][C↓]
     * 1 [C→][L ][I ][O ][N ][ ][T ]
     * 2 [C→][A ][P ][P ][L ][E ][A ]
     * 3 [C→][N ][O ][S ][E ][ ][R ]
     * 4 [C→][E ][A ][R ][ ][ ][ ]
     * 5 [C→][T ][I ][M ][E ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Capital of France', answer: 'PARIS', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Celestial body', answer: 'STAR', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'King of the jungle', answer: 'LION', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Newton\'s fruit', answer: 'APPLE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Smell sensor', answer: 'NOSE', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Hearing organ', answer: 'EAR', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Clock measures it', answer: 'TIME', startRow: 5, startCol: 0 },
      { number: 8, direction: 'down', clue: 'Earth is one', answer: 'PLANET', startRow: 0, startCol: 1 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Animal Safari",
    difficulty: Difficulty.MEDIUM,
    category: "Animals",
    grid: {
      rows: 6,
      cols: 7
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6
     * 0 [C→][T ][I ][G ][E ][R ][C↓]
     * 1 [C→][E ][A ][G ][L ][E ][B ]
     * 2 [C→][S ][H ][A ][R ][K ][E ]
     * 3 [C→][L ][I ][O ][N ][ ][A ]
     * 4 [C→][B ][E ][A ][R ][ ][R ]
     * 5 [C→][F ][O ][X ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Striped big cat', answer: 'TIGER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Large furry animal', answer: 'BEAR', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Bird with sharp eyes', answer: 'EAGLE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Ocean predator', answer: 'SHARK', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Mane having cat', answer: 'LION', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Honey lover', answer: 'BEAR', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Cunning forest animal', answer: 'FOX', startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Hip Hop Legends",
    difficulty: Difficulty.HARD,
    category: "Music",
    grid: {
      rows: 7,
      cols: 8
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6   7
     * 0 [C→][E ][M ][I ][N ][E ][M ][C↓]
     * 1 [C→][D ][R ][A ][K ][E ][ ][D ]
     * 2 [C→][K ][A ][N ][Y ][E ][ ][R ]
     * 3 [C→][B ][E ][A ][T ][S ][ ][E ]
     * 4 [C→][R ][A ][P ][ ][ ][ ][ ]
     * 5 [C→][J ][A ][Y ][Z ][ ][ ][ ]
     * 6 [C→][N ][A ][S ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Lose Yourself rapper', answer: 'EMINEM', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Headphones brand by rapper', answer: 'DRE', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Hotline Bling artist', answer: 'DRAKE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Yeezy creator', answer: 'KANYE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Instrumental backing track', answer: 'BEATS', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Hip hop music style', answer: 'RAP', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: '99 Problems artist', answer: 'JAYZ', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Illmatic rapper', answer: 'NAS', startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Movie Magic",
    difficulty: Difficulty.MEDIUM,
    category: "Movies",
    grid: {
      rows: 6,
      cols: 7
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6
     * 0 [C→][J ][A ][W ][S ][ ][C↓]
     * 1 [C→][A ][L ][I ][E ][N ][F ]
     * 2 [C→][N ][E ][M ][O ][ ][I ]
     * 3 [C→][S ][T ][A ][R ][ ][L ]
     * 4 [C→][H ][E ][R ][O ][ ][M ]
     * 5 [C→][I ][C ][E ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Spielberg shark movie', answer: 'JAWS', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Cinema industry', answer: 'FILM', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Ridley Scott space horror', answer: 'ALIEN', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Lost clownfish', answer: 'NEMO', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Wars in space', answer: 'STAR', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Saves the day', answer: 'HERO', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Frozen water', answer: 'ICE', startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Science Lab",
    difficulty: Difficulty.HARD,
    category: "Science",
    grid: {
      rows: 7,
      cols: 8
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6   7
     * 0 [C→][A ][T ][O ][M ][ ][ ][C↓]
     * 1 [C→][L ][A ][S ][E ][R ][ ][D ]
     * 2 [C→][C ][E ][L ][L ][ ][ ][N ]
     * 3 [C→][I ][O ][N ][ ][ ][ ][A ]
     * 4 [C→][G ][E ][N ][E ][ ][ ][ ]
     * 5 [C→][L ][A ][B ][ ][ ][ ][ ]
     * 6 [C→][O ][H ][M ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Smallest particle', answer: 'ATOM', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Genetic code', answer: 'DNA', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Focused light beam', answer: 'LASER', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Building block of life', answer: 'CELL', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Charged particle', answer: 'ION', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Heredity unit', answer: 'GENE', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Science room', answer: 'LAB', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Resistance unit', answer: 'OHM', startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Sports Arena",
    difficulty: Difficulty.MEDIUM,
    category: "Sports",
    grid: {
      rows: 6,
      cols: 7
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6
     * 0 [C→][G ][O ][A ][L ][ ][C↓]
     * 1 [C→][T ][E ][A ][M ][ ][N ]
     * 2 [C→][B ][A ][L ][L ][ ][B ]
     * 3 [C→][R ][U ][N ][ ][ ][A ]
     * 4 [C→][W ][I ][N ][ ][ ][ ]
     * 5 [C→][N ][E ][T ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Soccer objective', answer: 'GOAL', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Basketball league', answer: 'NBA', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Group of players', answer: 'TEAM', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Round sports object', answer: 'BALL', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Baseball score', answer: 'RUN', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Victory', answer: 'WIN', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Tennis divider', answer: 'NET', startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Binge Watch",
    difficulty: Difficulty.HARD,
    category: "TV Shows",
    grid: {
      rows: 7,
      cols: 8
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6   7
     * 0 [C→][L ][O ][S ][T ][ ][ ][C↓]
     * 1 [C→][F ][R ][I ][E ][N ][D ][S ]
     * 2 [C→][H ][O ][U ][S ][E ][ ][H ]
     * 3 [C→][G ][L ][E ][E ][ ][ ][O ]
     * 4 [C→][E ][R ][ ][ ][ ][ ][W ]
     * 5 [C→][C ][S ][I ][ ][ ][ ][ ]
     * 6 [C→][M ][A ][D ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Island mystery series', answer: 'LOST', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'TV series', answer: 'SHOW', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Central Perk sitcom', answer: 'FRIENDS', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Medical drama with Dr. ___', answer: 'HOUSE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Musical high school show', answer: 'GLEE', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Greys Anatomy network', answer: 'ER', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Crime scene investigation', answer: 'CSI', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Men advertising drama', answer: 'MAD', startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Food Feast",
    difficulty: Difficulty.EASY,
    category: "Food",
    grid: {
      rows: 5,
      cols: 6
    },
    /**
     * Grid:
     *   0   1   2   3   4   5
     * 0 [C→][R ][I ][C ][E ][C↓]
     * 1 [C→][M ][E ][A ][T ][S ]
     * 2 [C→][F ][I ][S ][H ][O ]
     * 3 [C→][E ][G ][G ][ ][U ]
     * 4 [C→][P ][I ][E ][ ][P ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Asian staple grain', answer: 'RICE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Liquid food', answer: 'SOUP', startRow: 0, startCol: 5 },
      { number: 3, direction: 'across', clue: 'Protein from animals', answer: 'MEAT', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Swims in water', answer: 'FISH', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Comes from chicken', answer: 'EGG', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Sweet baked dessert', answer: 'PIE', startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Tech World",
    difficulty: Difficulty.HARD,
    category: "Technology",
    grid: {
      rows: 7,
      cols: 8
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6   7
     * 0 [C→][C ][O ][D ][E ][ ][ ][C↓]
     * 1 [C→][J ][A ][V ][A ][ ][ ][A ]
     * 2 [C→][D ][A ][T ][A ][ ][ ][P ]
     * 3 [C→][W ][E ][B ][ ][ ][ ][P ]
     * 4 [C→][A ][P ][I ][ ][ ][ ][ ]
     * 5 [C→][C ][P ][U ][ ][ ][ ][ ]
     * 6 [C→][R ][A ][M ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Programmers write it', answer: 'CODE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Mobile program', answer: 'APP', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Popular programming language', answer: 'JAVA', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Information', answer: 'DATA', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Internet', answer: 'WEB', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Software interface', answer: 'API', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Computer brain', answer: 'CPU', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Memory type', answer: 'RAM', startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "World Geography",
    difficulty: Difficulty.MEDIUM,
    category: "Geography",
    grid: {
      rows: 6,
      cols: 7
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6
     * 0 [C→][N ][I ][L ][E ][ ][C↓]
     * 1 [C→][A ][S ][I ][A ][ ][U ]
     * 2 [C→][P ][E ][R ][U ][ ][S ]
     * 3 [C→][M ][A ][P ][ ][ ][A ]
     * 4 [C→][R ][I ][O ][ ][ ][ ]
     * 5 [C→][U ][K ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Longest African river', answer: 'NILE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Largest country', answer: 'USA', startRow: 0, startCol: 6 },
      { number: 3, direction: 'across', clue: 'Largest continent', answer: 'ASIA', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Machu Picchu country', answer: 'PERU', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Shows countries', answer: 'MAP', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Brazilian city', answer: 'RIO', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'United Kingdom abbr', answer: 'UK', startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "History Quest",
    difficulty: Difficulty.EXPERT,
    category: "History",
    grid: {
      rows: 7,
      cols: 8
    },
    /**
     * Grid:
     *   0   1   2   3   4   5   6   7
     * 0 [C→][R ][O ][M ][E ][ ][ ][C↓]
     * 1 [C→][K ][I ][N ][G ][ ][ ][W ]
     * 2 [C→][W ][A ][R ][ ][ ][ ][A ]
     * 3 [C→][A ][R ][M ][Y ][ ][ ][R ]
     * 4 [C→][N ][A ][V ][Y ][ ][ ][ ]
     * 5 [C→][E ][R ][A ][ ][ ][ ][ ]
     * 6 [C→][C ][Z ][A ][R ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Ancient empire capital', answer: 'ROME', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Armed conflict', answer: 'WAR', startRow: 0, startCol: 7 },
      { number: 3, direction: 'across', clue: 'Royal ruler', answer: 'KING', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Military conflict', answer: 'WAR', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Ground military force', answer: 'ARMY', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Sea military force', answer: 'NAVY', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Historical period', answer: 'ERA', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Russian emperor', answer: 'CZAR', startRow: 6, startCol: 0 },
    ],
    estimatedTime: 420,
    coinReward: 45
  },
  {
    title: "Brain Teaser",
    difficulty: Difficulty.EXPERT,
    category: "General",
    grid: {
      rows: 8,
      cols: 9
    },
    /**
     * Grid with crossing words:
     *   0   1   2   3   4   5   6   7   8
     * 0 [C→][Q ][U ][I ][Z ][ ][ ][ ][C↓]
     * 1 [C→][P ][U ][Z ][Z ][L ][E ][ ][T ]
     * 2 [C→][B ][R ][A ][I ][N ][ ][ ][H ]
     * 3 [C→][L ][O ][G ][I ][C ][ ][ ][I ]
     * 4 [C→][C ][L ][U ][E ][ ][ ][ ][N ]
     * 5 [C→][M ][I ][N ][D ][ ][ ][ ][K ]
     * 6 [C→][S ][O ][L ][V ][E ][ ][ ][ ]
     * 7 [C→][I ][D ][E ][A ][ ][ ][ ][ ]
     */
    clues: [
      { number: 1, direction: 'across', clue: 'Trivia test', answer: 'QUIZ', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Use your brain', answer: 'THINK', startRow: 0, startCol: 8 },
      { number: 3, direction: 'across', clue: 'You are solving one', answer: 'PUZZLE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Thinking organ', answer: 'BRAIN', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Reasoning skill', answer: 'LOGIC', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Hint to answer', answer: 'CLUE', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Your thoughts', answer: 'MIND', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Find the answer', answer: 'SOLVE', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Creative thought', answer: 'IDEA', startRow: 7, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 50
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
