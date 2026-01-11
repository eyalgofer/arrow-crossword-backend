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
  // working examples
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
    title: "Logical Flow",
    difficulty: Difficulty.MEDIUM,
    category: "General Knowledge",
    grid: { "rows": 8, "cols": 8 },
    clues: [
      { "number": 1, "direction": "right-down", "clue": "Adjust to fit", "answer": "ADAPT", "enumeration": [5], "startRow": 0, "startCol": 0 },
      { "number": 2, "direction": "down", "clue": "Region", "answer": "AREA", "enumeration": [4], "startRow": 0, "startCol": 2 },
      { "number": 3, "direction": "left-down", "clue": "Solidify", "answer": "SET", "enumeration": [3], "startRow": 0, "startCol": 4 },
      { "number": 4, "direction": "across", "clue": "Deep hole", "answer": "ABYSS", "enumeration": [5], "startRow": 1, "startCol": 2 },
      { "number": 5, "direction": "down-across", "clue": "Small insect", "answer": "ANT", "enumeration": [3], "startRow": 2, "startCol": 0 },
      { "number": 6, "direction": "down", "clue": "Trial", "answer": "TEST", "enumeration": [4], "startRow": 2, "startCol": 4 },
      { "number": 7, "direction": "up-across", "clue": "Every one", "answer": "ALL", "enumeration": [3], "startRow": 4, "startCol": 1 },
      { "number": 8, "direction": "across", "clue": "Finish", "answer": "END", "enumeration": [3], "startRow": 5, "startCol": 3 },
      { "number": 9, "direction": "down-across", "clue": "Automobile", "answer": "CAR", "enumeration": [3], "startRow": 6, "startCol": 0 },
      { "number": 10, "direction": "across", "clue": "Quick sleep", "answer": "NAP", "enumeration": [3], "startRow": 7, "startCol": 4 }
    ],
    "estimatedTime": 100,
    "coinReward": 15
  },
  {
    title: "TODO: FIX TO CLUES IN ONE CELL",
    difficulty: Difficulty.EASY,
    category: "Nature",
    grid: { rows: 10, cols: 9 },
    clues: [
      // right-down: (0, 0+1) -> (0,1), (1,1), (2,1)
      { number: 1, direction: 'right-down', clue: 'Flower part', answer: 'BUD', enumeration: [3], startRow: 0, startCol: 0 },
      // down: (0+1, 2) -> (1,2), (2,2), (3,2), (4,2)
      { number: 2, direction: 'down', clue: 'Plant stem', answer: 'REED', enumeration: [4], startRow: 0, startCol: 2 },
      // left-down: (0, 4-1) -> (0,3), (1,3), (2,3), (3,3)
      { number: 3, direction: 'left-down', clue: 'Garden tool', answer: 'HOES', enumeration: [4], startRow: 0, startCol: 4 },
      // across: (1, 0+1) -> (1,1), (1,2), (1,3), (1,4), (1,5)
      // Crosses: (1,1) is 'U' from BUD? No, BUD is (0,1),(1,1),(2,1). Index 1 of BUD is 'U'.
      // Word 4 (across) must have 'U' at index 0. 
      { number: 4, direction: 'across', clue: 'Not below', answer: 'UPPER', enumeration: [5], startRow: 1, startCol: 0 },
      // Intersection Check: 
      // Word 1 (BUD) at (1,1) = 'U'
      // Word 2 (REED) at (1,2) = 'P' <- Adjusted Word 2 to 'OPEN' to match 'P'
      { number: 2, direction: 'down', clue: 'Not closed', answer: 'OPEN', enumeration: [4], startRow: 0, startCol: 2 },
      // Word 3 (HOES) at (1,3) = 'P' <- Adjusted Word 3 to 'SPUD'
      { number: 3, direction: 'left-down', clue: 'Potato', answer: 'SPUD', enumeration: [4], startRow: 0, startCol: 4 },
      
      // down: (2+1, 4) -> (3,4), (4,4), (5,4)
      { number: 5, direction: 'down', clue: 'Consumed', answer: 'ATE', enumeration: [3], startRow: 2, startCol: 4 },
      // up-across: (5-1, 1) -> (4,1), (4,2), (4,3), (4,4)
      // (4,4) must match 'E' from ATE
      { number: 6, direction: 'up-across', clue: 'Blue expanse', answer: 'SKIE', enumeration: [4], startRow: 5, startCol: 1 },
      
      // across: (6, 2+1) -> (6,3), (6,4), (6,5)
      { number: 7, direction: 'across', clue: 'Finish', answer: 'END', enumeration: [3], startRow: 6, startCol: 2 },
      // down-across: (8+1, 0) -> (9,0), (9,1), (9,2), (9,3)
      { number: 8, direction: 'down-across', clue: 'Growth location', answer: 'SOIL', enumeration: [4], startRow: 8, startCol: 0 }
    ],
    estimatedTime: 90,
    coinReward: 10
  },
    {
      title: "Celestial Horizons",
      difficulty: Difficulty.MEDIUM,
      category: "Space",
      grid: { rows: 12, cols: 11 },
    clues: [
        { number: 1, direction: 'right-down', clue: 'Planet with rings', answer: 'SATURN', enumeration: [6], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Sun-centric', answer: 'SOLAR', enumeration: [5], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Space path', answer: 'ORBIT', enumeration: [5], startRow: 0, startCol: 4 },
        { number: 4, direction: 'left-down', clue: 'Brightest star', answer: 'SUN', enumeration: [3], startRow: 0, startCol: 6 },
        { number: 5, direction: 'across', clue: 'Star group', answer: 'ASTRONOMY', enumeration: [9], startRow: 1, startCol: 0 },
        { number: 6, direction: 'down', clue: 'Red planet', answer: 'MARS', enumeration: [4], startRow: 2, startCol: 5 },
        { number: 7, direction: 'up-across', clue: 'Lunar phase', answer: 'NEW', enumeration: [3], startRow: 4, startCol: 1 },
        { number: 8, direction: 'across', clue: 'Everything', answer: 'UNIVERSE', enumeration: [8], startRow: 5, startCol: 2 },
        { number: 9, direction: 'down-across', clue: 'Shooting star', answer: 'METEOR', enumeration: [6], startRow: 6, startCol: 0 },
        { number: 10, direction: 'down', clue: 'Darkness', answer: 'NIGHT', enumeration: [5], startRow: 6, startCol: 1 },
        { number: 11, direction: 'across', clue: 'Galaxy name', answer: 'MILKYWAY', enumeration: [8], startRow: 8, startCol: 2 },
        { number: 12, direction: 'down', clue: 'Zero pressure', answer: 'VACUUM', enumeration: [6], startRow: 3, startCol: 8 },
        { number: 13, direction: 'across', clue: 'Space rock', answer: 'ASTEROID', enumeration: [8], startRow: 10, startCol: 1 },
        { number: 14, direction: 'left-down', clue: 'Space craft', answer: 'ROCKET', enumeration: [6], startRow: 4, startCol: 10 }
      ],
      estimatedTime: 180,
      coinReward: 25
    },
    {
      title: "Maritime Voyages",
      difficulty: Difficulty.MEDIUM,
      category: "Ocean",
      grid: { rows: 12, cols: 12 },
    clues: [
        { number: 1, direction: 'down', clue: 'Deepest sea', answer: 'PACIFIC', enumeration: [7], startRow: 0, startCol: 1 },
        { number: 2, direction: 'right-down', clue: 'Sailor', answer: 'MARINER', enumeration: [7], startRow: 0, startCol: 3 },
        { number: 3, direction: 'left-down', clue: 'Harbor', answer: 'PORT', enumeration: [4], startRow: 0, startCol: 6 },
        { number: 4, direction: 'across', clue: 'Large ship', answer: 'VESSEL', enumeration: [6], startRow: 1, startCol: 4 },
        { number: 5, direction: 'down-across', clue: 'Captain’s map', answer: 'CHART', enumeration: [5], startRow: 2, startCol: 0 },
        { number: 6, direction: 'down', clue: 'Under water', answer: 'SUBMARINE', enumeration: [9], startRow: 2, startCol: 2 },
        { number: 7, direction: 'up-across', clue: 'Bird of the sea', answer: 'GULL', enumeration: [4], startRow: 4, startCol: 4 },
        { number: 8, direction: 'down', clue: 'Stop the ship', answer: 'ANCHOR', enumeration: [6], startRow: 4, startCol: 7 },
        { number: 9, direction: 'across', clue: 'Coral structure', answer: 'REEF', enumeration: [4], startRow: 6, startCol: 3 },
        { number: 10, direction: 'right-down', clue: 'Sea floor', answer: 'ABYSS', enumeration: [5], startRow: 5, startCol: 9 },
        { number: 11, direction: 'across', clue: 'Island ring', answer: 'ATOLL', enumeration: [5], startRow: 8, startCol: 1 },
        { number: 12, direction: 'down-across', clue: 'Back of boat', answer: 'STERN', enumeration: [5], startRow: 10, startCol: 4 },
        { number: 13, direction: 'across', clue: 'Water motion', answer: 'TIDE', enumeration: [4], startRow: 11, startCol: 7 }
      ],
      estimatedTime: 200,
      coinReward: 30
    },
    {
      title: "Botanical Garden",
      difficulty: Difficulty.EASY,
      category: "Plants",
      grid: { rows: 11, cols: 11 },
    clues: [
        { number: 1, direction: 'right-down', clue: 'Oak seed', answer: 'ACORN', enumeration: [5], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Green life', answer: 'PLANTS', enumeration: [6], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Bushy plant', answer: 'SHRUB', enumeration: [5], startRow: 0, startCol: 4 },
        { number: 4, direction: 'across', clue: 'Flower scent', answer: 'ORCHID', enumeration: [6], startRow: 1, startCol: 5 },
        { number: 5, direction: 'up-across', clue: 'Sun lover', answer: 'DAISY', enumeration: [5], startRow: 3, startCol: 0 },
        { number: 6, direction: 'down-across', clue: 'Watering hole', answer: 'POND', enumeration: [4], startRow: 4, startCol: 2 },
        { number: 7, direction: 'down', clue: 'Yellow flower', answer: 'TULIP', enumeration: [5], startRow: 3, startCol: 7 },
        { number: 8, direction: 'across', clue: 'Garden soil', answer: 'MULCH', enumeration: [5], startRow: 6, startCol: 0 },
        { number: 9, direction: 'right-down', clue: 'Sharp part', answer: 'THORN', enumeration: [5], startRow: 5, startCol: 5 },
        { number: 10, direction: 'across', clue: 'Work in garden', answer: 'PRUNE', enumeration: [5], startRow: 8, startCol: 3 },
        { number: 11, direction: 'down', clue: 'Climbing vine', answer: 'IVY', enumeration: [3], startRow: 7, startCol: 9 },
        { number: 12, direction: 'across', clue: 'Summer fruit', answer: 'BERRY', enumeration: [5], startRow: 10, startCol: 1 }
      ],
      estimatedTime: 150,
      coinReward: 20
    },
  {
    title: "Culinary Arts",
    difficulty: Difficulty.HARD,
    category: "Food",
      grid: { rows: 13, cols: 11 },
    clues: [
        { number: 1, direction: 'down', clue: 'Breakfast grain', answer: 'OATMEAL', enumeration: [7], startRow: 0, startCol: 1 },
        { number: 2, direction: 'right-down', clue: 'Cooking professional', answer: 'CHEF', enumeration: [4], startRow: 0, startCol: 3 },
        { number: 3, direction: 'left-down', clue: 'Oven setting', answer: 'BAKE', enumeration: [4], startRow: 0, startCol: 6 },
        { number: 4, direction: 'across', clue: 'Kitchen tool', answer: 'SPATULA', enumeration: [7], startRow: 1, startCol: 4 },
        { number: 5, direction: 'down-across', clue: 'Herb for sauce', answer: 'BASIL', enumeration: [5], startRow: 3, startCol: 0 },
        { number: 6, direction: 'down', clue: 'Slow cook', answer: 'ROAST', enumeration: [5], startRow: 3, startCol: 2 },
        { number: 7, direction: 'up-across', clue: 'Milk product', answer: 'CHEESE', enumeration: [6], startRow: 5, startCol: 3 },
        { number: 8, direction: 'down', clue: 'Knife edge', answer: 'SHARP', enumeration: [5], startRow: 5, startCol: 8 },
        { number: 9, direction: 'across', clue: 'Morning drink', answer: 'COFFEE', enumeration: [6], startRow: 7, startCol: 1 },
        { number: 10, direction: 'right-down', clue: 'Spicy root', answer: 'GINGER', enumeration: [6], startRow: 6, startCol: 5 },
        { number: 11, direction: 'down-across', clue: 'Sweet course', answer: 'DESSERT', enumeration: [7], startRow: 9, startCol: 0 },
        { number: 12, direction: 'across', clue: 'Boiling vapor', answer: 'STEAM', enumeration: [5], startRow: 11, startCol: 4 },
        { number: 13, direction: 'left-down', clue: 'Soup dish', answer: 'BOWL', enumeration: [4], startRow: 8, startCol: 10 }
      ],
      estimatedTime: 240,
      coinReward: 40
    },
    {
      title: "Ancient History",
    difficulty: Difficulty.MEDIUM,
      category: "History",
      grid: { rows: 12, cols: 12 },
    clues: [
        { number: 1, direction: 'right-down', clue: 'Egyptian tomb', answer: 'PYRAMID', enumeration: [7], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Greek city', answer: 'SPARTA', enumeration: [6], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Empire of Italy', answer: 'ROMAN', enumeration: [5], startRow: 0, startCol: 5 },
        { number: 4, direction: 'across', clue: 'Ancient scroll', answer: 'PAPYRUS', enumeration: [7], startRow: 1, startCol: 4 },
        { number: 5, direction: 'down-across', clue: 'Metal age', answer: 'BRONZE', enumeration: [6], startRow: 3, startCol: 0 },
        { number: 6, direction: 'up-across', clue: 'King of Egypt', answer: 'PHARAOH', enumeration: [7], startRow: 5, startCol: 1 },
        { number: 7, direction: 'down', clue: 'Ruined temple', answer: 'COLUMN', enumeration: [6], startRow: 4, startCol: 8 },
        { number: 8, direction: 'across', clue: 'Dead sea artifact', answer: 'SCROLL', enumeration: [6], startRow: 7, startCol: 2 },
        { number: 9, direction: 'right-down', clue: 'Old city site', answer: 'RUINS', enumeration: [5], startRow: 6, startCol: 10 },
        { number: 10, direction: 'down-across', clue: 'Greek marketplace', answer: 'AGORA', enumeration: [5], startRow: 9, startCol: 0 },
        { number: 11, direction: 'across', clue: 'War horse', answer: 'STEED', enumeration: [5], startRow: 10, startCol: 5 },
        { number: 12, direction: 'across', clue: 'Past years', answer: 'ERA', enumeration: [3], startRow: 11, startCol: 1 }
      ],
      estimatedTime: 210,
      coinReward: 35
    },
      {
        title: "Hollywood Stars",
        difficulty: Difficulty.MEDIUM,
        category: "Movies",
        grid: { rows: 12, cols: 12 },
    clues: [
          { number: 1, direction: 'right-down', clue: 'Top Gun actor', answer: 'TOMCRUISE', enumeration: [3, 6], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Jurassic Park director', answer: 'SPIELBERG', enumeration: [9], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Titanic star', answer: 'LEODICAPRIO', enumeration: [3, 8], startRow: 0, startCol: 4 },
          { number: 4, direction: 'across', clue: 'Movie prize', answer: 'OSCAR', enumeration: [5], startRow: 1, startCol: 5 },
          { number: 5, direction: 'up-across', clue: 'Iron Man', answer: 'STARK', enumeration: [5], startRow: 3, startCol: 0 },
          { number: 6, direction: 'down-across', clue: 'Rocky actor', answer: 'SLY', enumeration: [3], startRow: 4, startCol: 6 },
          { number: 7, direction: 'down', clue: 'Action star Chan', answer: 'JACKIE', enumeration: [6], startRow: 3, startCol: 9 },
          { number: 8, direction: 'across', clue: 'Film set', answer: 'STUDIO', enumeration: [6], startRow: 5, startCol: 3 },
          { number: 9, direction: 'down', clue: 'Director Nolan', answer: 'CHRIS', enumeration: [5], startRow: 5, startCol: 11 },
          { number: 10, direction: 'left-down', clue: 'Pulp Fiction star', answer: 'SAMUEL', enumeration: [6], startRow: 4, startCol: 5 },
          { number: 11, direction: 'across', clue: 'Main actor', answer: 'LEAD', enumeration: [4], startRow: 7, startCol: 0 },
          { number: 12, direction: 'down-across', clue: 'Funny film', answer: 'COMEDY', enumeration: [6], startRow: 9, startCol: 1 },
          { number: 13, direction: 'across', clue: 'Wolverine', answer: 'LOGAN', enumeration: [5], startRow: 11, startCol: 5 }
        ],
        estimatedTime: 220,
        coinReward: 40
      },
      {
        title: "Musical Legends",
    difficulty: Difficulty.HARD,
        category: "Music",
        grid: { rows: 13, cols: 11 },
    clues: [
          { number: 1, direction: 'down', clue: 'King of Pop', answer: 'JACKSON', enumeration: [7], startRow: 0, startCol: 1 },
          { number: 2, direction: 'right-down', clue: 'Imagine singer', answer: 'LENNON', enumeration: [6], startRow: 0, startCol: 3 },
          { number: 3, direction: 'left-down', clue: 'Queen lead', answer: 'MERCURY', enumeration: [7], startRow: 0, startCol: 5 },
          { number: 4, direction: 'across', clue: 'Piano Man', answer: 'BILLYJOEL', enumeration: [5, 4], startRow: 1, startCol: 6 },
          { number: 5, direction: 'down-across', clue: 'Electric guitar', answer: 'STRAT', enumeration: [5], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Like a Virgin', answer: 'MADONNA', enumeration: [7], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'Material Girl', answer: 'DANCE', enumeration: [5], startRow: 4, startCol: 9 },
          { number: 8, direction: 'across', clue: 'Purple Rain', answer: 'PRINCE', enumeration: [6], startRow: 7, startCol: 3 },
          { number: 9, direction: 'right-down', clue: 'Jazz legend', answer: 'MILES', enumeration: [5], startRow: 6, startCol: 0 },
          { number: 10, direction: 'down', clue: 'Opera star', answer: 'PAVAROTTI', enumeration: [9], startRow: 3, startCol: 7 },
          { number: 11, direction: 'across', clue: 'Fab Four', answer: 'BEATLES', enumeration: [7], startRow: 9, startCol: 2 },
          { number: 12, direction: 'down-across', clue: 'Rap god', answer: 'EMINEM', enumeration: [6], startRow: 11, startCol: 0 },
          { number: 13, direction: 'across', clue: 'Diva', answer: 'ADELE', enumeration: [5], startRow: 12, startCol: 5 }
        ],
        estimatedTime: 250,
        coinReward: 45
      },
      {
        title: "Global Flavors",
        difficulty: Difficulty.MEDIUM,
        category: "Cuisine",
        grid: { rows: 12, cols: 12 },
    clues: [
          { number: 1, direction: 'right-down', clue: 'Frozen dessert', answer: 'ICECREAM', enumeration: [4, 4], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Italian pie', answer: 'PIZZA', enumeration: [5], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Raw fish dish', answer: 'SUSHI', enumeration: [5], startRow: 0, startCol: 4 },
          { number: 4, direction: 'across', clue: 'Morning meal', answer: 'BREAKFAST', enumeration: [9], startRow: 1, startCol: 5 },
          { number: 5, direction: 'down-across', clue: 'Middle east dip', answer: 'HUMMUS', enumeration: [6], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'French bread', answer: 'BAGUETTE', enumeration: [8], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'Mexican wrap', answer: 'TACO', enumeration: [4], startRow: 4, startCol: 8 },
          { number: 8, direction: 'across', clue: 'Rice dish', answer: 'RISOTTO', enumeration: [7], startRow: 7, startCol: 3 },
          { number: 9, direction: 'right-down', clue: 'Spicy sauce', answer: 'SALSA', enumeration: [5], startRow: 6, startCol: 10 },
          { number: 10, direction: 'down', clue: 'Curry spice', answer: 'TURMERIC', enumeration: [8], startRow: 2, startCol: 6 },
          { number: 11, direction: 'across', clue: 'Dough ring', answer: 'DONUT', enumeration: [5], startRow: 9, startCol: 1 },
          { number: 12, direction: 'down-across', clue: 'Pasta sheet', answer: 'LASAGNA', enumeration: [7], startRow: 11, startCol: 2 }
        ],
        estimatedTime: 190,
        coinReward: 30
      },
      {
        title: "Tech Giants",
    difficulty: Difficulty.HARD,
        category: "Technology",
        grid: { rows: 11, cols: 11 },
    clues: [
          { number: 1, direction: 'down', clue: 'Apple founder', answer: 'STEVEJOBS', enumeration: [5, 4], startRow: 0, startCol: 1 },
          { number: 2, direction: 'right-down', clue: 'Tesla CEO', answer: 'ELONMUSK', enumeration: [4, 4], startRow: 0, startCol: 3 },
          { number: 3, direction: 'left-down', clue: 'Microsoft founder', answer: 'BILLGATES', enumeration: [4, 5], startRow: 0, startCol: 5 },
          { number: 4, direction: 'across', clue: 'Web explorer', answer: 'CHROME', enumeration: [6], startRow: 1, startCol: 6 },
          { number: 5, direction: 'down-across', clue: 'Social site', answer: 'REDDIT', enumeration: [6], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Search engine', answer: 'GOOGLE', enumeration: [6], startRow: 5, startCol: 2 },
          { number: 7, direction: 'down', clue: 'Video site', answer: 'YOUTUBE', enumeration: [7], startRow: 2, startCol: 8 },
          { number: 8, direction: 'across', clue: 'Data storage', answer: 'CLOUD', enumeration: [5], startRow: 7, startCol: 4 },
          { number: 9, direction: 'down-across', clue: 'Phone giant', answer: 'SAMSUNG', enumeration: [7], startRow: 9, startCol: 1 },
          { number: 10, direction: 'across', clue: 'Code site', answer: 'GITHUB', enumeration: [6], startRow: 10, startCol: 5 }
        ],
        estimatedTime: 200,
        coinReward: 35
      },
      {
        title: "Literary Giants",
        difficulty: Difficulty.MEDIUM,
        category: "Books",
        grid: { rows: 12, cols: 11 },
    clues: [
          { number: 1, direction: 'right-down', clue: 'The Bard', answer: 'SHAKESPEARE', enumeration: [11], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Hitchcock author', answer: 'POE', enumeration: [3], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Great Gatsby', answer: 'FITZGERALD', enumeration: [10], startRow: 0, startCol: 4 },
          { number: 4, direction: 'across', clue: 'Wizard boy', answer: 'HARRYPOTTER', enumeration: [5, 6], startRow: 1, startCol: 5 },
          { number: 5, direction: 'down-across', clue: 'Novel part', answer: 'CHAPTER', enumeration: [7], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Poem maker', answer: 'WRITER', enumeration: [6], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'Horror King', answer: 'STEPHEN', enumeration: [7], startRow: 4, startCol: 8 },
          { number: 8, direction: 'across', clue: 'Library item', answer: 'BOOK', enumeration: [4], startRow: 7, startCol: 3 },
          { number: 9, direction: 'right-down', clue: 'Short story', answer: 'FABLE', enumeration: [5], startRow: 6, startCol: 10 },
          { number: 10, direction: 'down-across', clue: 'Classic Homer', answer: 'ILIAD', enumeration: [5], startRow: 9, startCol: 2 },
          { number: 11, direction: 'across', clue: 'Old tale', answer: 'MYTH', enumeration: [4], startRow: 11, startCol: 5 }
        ],
        estimatedTime: 230,
        coinReward: 40
      },
      {
        title: "Olympic Spirit",
        difficulty: Difficulty.MEDIUM,
        category: "Sports",
        grid: { rows: 13, cols: 11 },
    clues: [
          { number: 1, direction: 'down', clue: 'Fastest runner', answer: 'USAINBOLT', enumeration: [5, 4], startRow: 0, startCol: 1 },
          { number: 2, direction: 'right-down', clue: 'Tennis legend', answer: 'FEDERER', enumeration: [7], startRow: 0, startCol: 3 },
          { number: 3, direction: 'left-down', clue: 'Swimmer Michael', answer: 'PHELPS', enumeration: [6], startRow: 0, startCol: 5 },
          { number: 4, direction: 'across', clue: 'Gymnast Simone', answer: 'BILES', enumeration: [5], startRow: 1, startCol: 6 },
          { number: 5, direction: 'down-across', clue: 'Pool length', answer: 'LAP', enumeration: [3], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Marathon distance', answer: 'MILES', enumeration: [5], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'Prize metal', answer: 'GOLDMEDAL', enumeration: [4, 5], startRow: 4, startCol: 9 },
          { number: 8, direction: 'across', clue: 'Soccer star', answer: 'MESSI', enumeration: [5], startRow: 7, startCol: 3 },
          { number: 9, direction: 'right-down', clue: 'Winter sport', answer: 'SKIING', enumeration: [6], startRow: 6, startCol: 0 },
          { number: 10, direction: 'across', clue: 'Team leader', answer: 'COACH', enumeration: [5], startRow: 9, startCol: 2 },
          { number: 11, direction: 'down-across', clue: 'Boxing king', answer: 'ALI', enumeration: [3], startRow: 11, startCol: 5 },
          { number: 12, direction: 'across', clue: 'Victory', answer: 'WIN', enumeration: [3], startRow: 12, startCol: 1 }
        ],
        estimatedTime: 210,
        coinReward: 35
      },
      {
        title: "Nature Reserves",
        difficulty: Difficulty.EASY,
        category: "Environment",
        grid: { rows: 12, cols: 12 },
    clues: [
          { number: 1, direction: 'right-down', clue: 'Tallest animal', answer: 'GIRAFFE', enumeration: [7], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'King of jungle', answer: 'LION', enumeration: [4], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Big desert', answer: 'SAHARA', enumeration: [6], startRow: 0, startCol: 4 },
          { number: 4, direction: 'across', clue: 'Large ice', answer: 'GLACIER', enumeration: [7], startRow: 1, startCol: 5 },
          { number: 5, direction: 'down-across', clue: 'River in Egypt', answer: 'NILE', enumeration: [4], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Rainforest', answer: 'AMAZON', enumeration: [6], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'Highest peak', answer: 'EVEREST', enumeration: [7], startRow: 4, startCol: 8 },
          { number: 8, direction: 'across', clue: 'Deep canyon', answer: 'GRAND', enumeration: [5], startRow: 7, startCol: 2 },
          { number: 9, direction: 'right-down', clue: 'North pole', answer: 'ARCTIC', enumeration: [6], startRow: 6, startCol: 10 },
          { number: 10, direction: 'down-across', clue: 'Ocean life', answer: 'WHALE', enumeration: [5], startRow: 9, startCol: 3 },
          { number: 11, direction: 'across', clue: 'Earth part', answer: 'CORE', enumeration: [4], startRow: 11, startCol: 6 }
    ],
    estimatedTime: 170,
        coinReward: 25
      },
      {
        title: "Video Game Icons",
        difficulty: Difficulty.MEDIUM,
        category: "Gaming",
        grid: { rows: 11, cols: 11 },
    clues: [
          { number: 1, direction: 'down', clue: 'Nintendo plumber', answer: 'SUPERMARIO', enumeration: [5, 5], startRow: 0, startCol: 1 },
          { number: 2, direction: 'right-down', clue: 'Hylian hero', answer: 'LINK', enumeration: [4], startRow: 0, startCol: 3 },
          { number: 3, direction: 'left-down', clue: 'Blue blur', answer: 'SONIC', enumeration: [5], startRow: 0, startCol: 5 },
          { number: 4, direction: 'across', clue: 'Block game', answer: 'MINECRAFT', enumeration: [9], startRow: 1, startCol: 6 },
          { number: 5, direction: 'down-across', clue: 'Classic ghost game', answer: 'PACMAN', enumeration: [6], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Space marine', answer: 'MASTERCHIEF', enumeration: [6, 5], startRow: 5, startCol: 2 },
          { number: 7, direction: 'down', clue: 'Fighting game', answer: 'TEKKEN', enumeration: [6], startRow: 4, startCol: 9 },
          { number: 8, direction: 'across', clue: 'Pocket monsters', answer: 'POKEMON', enumeration: [7], startRow: 7, startCol: 4 },
          { number: 9, direction: 'down-across', clue: 'Steal cars game', answer: 'GTA', enumeration: [3], startRow: 9, startCol: 0 },
          { number: 10, direction: 'across', clue: 'Final fantasy', answer: 'CLOUDSTRIFE', enumeration: [5, 6], startRow: 10, startCol: 5 }
        ],
        estimatedTime: 230,
        coinReward: 40
      },
      {
        title: "Scientific Minds",
        difficulty: Difficulty.HARD,
        category: "Science",
        grid: { rows: 13, cols: 12 },
    clues: [
          { number: 1, direction: 'right-down', clue: 'Theory of relativity', answer: 'EINSTEIN', enumeration: [8], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Gravity apple', answer: 'NEWTON', enumeration: [6], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Radioactivity pioneer', answer: 'MARIECURIE', enumeration: [5, 5], startRow: 0, startCol: 4 },
          { number: 4, direction: 'across', clue: 'Evolution man', answer: 'CHARLESDAW', enumeration: [7, 3], startRow: 1, startCol: 5 },
          { number: 5, direction: 'down-across', clue: 'Tesla’s rival', answer: 'EDISON', enumeration: [6], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Black hole expert', answer: 'HAWKING', enumeration: [7], startRow: 5, startCol: 1 },
          { number: 7, direction: 'down', clue: 'DNA modeler', answer: 'WATSON', enumeration: [6], startRow: 4, startCol: 9 },
          { number: 8, direction: 'across', clue: 'Star gazer', answer: 'GALILEO', enumeration: [7], startRow: 7, startCol: 3 },
          { number: 9, direction: 'right-down', clue: 'Space telescope', answer: 'HUBBLE', enumeration: [6], startRow: 6, startCol: 11 },
          { number: 10, direction: 'down-across', clue: 'Pasteurization', answer: 'PASTEUR', enumeration: [7], startRow: 9, startCol: 2 },
          { number: 11, direction: 'across', clue: 'Atom center', answer: 'NUCLEUS', enumeration: [7], startRow: 11, startCol: 4 },
          { number: 12, direction: 'across', clue: 'Lab tool', answer: 'LENS', enumeration: [4], startRow: 12, startCol: 0 }
        ],
        estimatedTime: 260,
        coinReward: 50
      },
      {
        title: "City Landmarks",
        difficulty: Difficulty.MEDIUM,
        category: "Geography",
        grid: { rows: 12, cols: 11 },
    clues: [
          { number: 1, direction: 'down', clue: 'Big Ben city', answer: 'LONDON', enumeration: [6], startRow: 0, startCol: 1 },
          { number: 2, direction: 'right-down', clue: 'Eiffel Tower', answer: 'PARIS', enumeration: [5], startRow: 0, startCol: 3 },
          { number: 3, direction: 'left-down', clue: 'Colosseum home', answer: 'ROME', enumeration: [4], startRow: 0, startCol: 5 },
          { number: 4, direction: 'across', clue: 'Statue of Liberty', answer: 'NEWYORKCITY', enumeration: [3, 4, 4], startRow: 1, startCol: 6 },
          { number: 5, direction: 'down-across', clue: 'Pyramids of', answer: 'GIZA', enumeration: [4], startRow: 3, startCol: 0 },
          { number: 6, direction: 'up-across', clue: 'Japanese capital', answer: 'TOKYO', enumeration: [5], startRow: 5, startCol: 2 },
          { number: 7, direction: 'down', clue: 'Opera house city', answer: 'SYDNEY', enumeration: [6], startRow: 2, startCol: 8 },
          { number: 8, direction: 'across', clue: 'The Kremlin', answer: 'MOSCOW', enumeration: [6], startRow: 7, startCol: 4 },
          { number: 9, direction: 'down-across', clue: 'German capital', answer: 'BERLIN', enumeration: [6], startRow: 9, startCol: 1 },
          { number: 10, direction: 'across', clue: 'Canal city', answer: 'VENICE', enumeration: [6], startRow: 10, startCol: 5 }
        ],
        estimatedTime: 200,
        coinReward: 35
      },
      {
        title: "Cultural Giants",
        difficulty: Difficulty.HARD,
        category: "Entertainment",
        grid: { rows: 15, cols: 15 },
    clues: [
          // --- ROW 0 ORIGINS ---
          { number: 1, direction: 'right-down', clue: 'Mission Impossible star', answer: 'TOMCRUISE', enumeration: [3, 6], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Sun-dried brick', answer: 'ADOBE', enumeration: [5], startRow: 0, startCol: 2 },
          { number: 3, direction: 'down', clue: 'Microsoft founder', answer: 'BILLGATES', enumeration: [4, 5], startRow: 0, startCol: 4 },
          { number: 4, direction: 'left-down', clue: 'A single person', answer: 'INDIVIDUAL', enumeration: [10], startRow: 0, startCol: 6 },
          { number: 5, direction: 'left-down', clue: 'Space path', answer: 'ORBIT', enumeration: [5], startRow: 0, startCol: 8 },
          { number: 6, direction: 'left-down', clue: 'King of Pop', answer: 'MICHAELJACKSON', enumeration: [7, 7], startRow: 0, startCol: 10 },
          { number: 7, direction: 'left-down', clue: 'Red planet', answer: 'MARS', enumeration: [4], startRow: 0, startCol: 12 },
          { number: 8, direction: 'left-down', clue: 'Quick look', answer: 'PEEK', enumeration: [4], startRow: 0, startCol: 14 },
      
          // --- INTERSECTING ACROSS ---
          { number: 9, direction: 'across', clue: 'Film award', answer: 'OSCAR', enumeration: [5], startRow: 1, startCol: 1 },
          { number: 10, direction: 'across', clue: 'Vast ocean', answer: 'PACIFIC', enumeration: [7], startRow: 2, startCol: 3 },
          { number: 11, direction: 'across', clue: 'Morning meal', answer: 'BREAKFAST', enumeration: [9], startRow: 3, startCol: 5 },
          
          // --- MID-GRID CLUES ---
          { number: 12, direction: 'down-across', clue: 'Frozen dessert', answer: 'ICECREAM', enumeration: [4, 4], startRow: 5, startCol: 0 },
          { number: 13, direction: 'up-across', clue: 'Apple founder', answer: 'STEVEJOBS', enumeration: [5, 4], startRow: 7, startCol: 1 },
          { number: 14, direction: 'down', clue: 'Egyptian tomb', answer: 'PYRAMID', enumeration: [7], startRow: 5, startCol: 7 },
          { number: 15, direction: 'across', clue: 'Not old', answer: 'MODERN', enumeration: [6], startRow: 6, startCol: 8 },
          
          // --- LOWER GRID ---
          { number: 16, direction: 'right-down', clue: 'Tesla CEO', answer: 'ELONMUSK', enumeration: [4, 4], startRow: 8, startCol: 0 },
          { number: 17, direction: 'across', clue: 'Harry Potter author', answer: 'JKROWLING', enumeration: [2, 7], startRow: 9, startCol: 4 },
          { number: 18, direction: 'down-across', clue: 'Deep hole', answer: 'ABYSS', enumeration: [5], startRow: 11, startCol: 0 },
          { number: 19, direction: 'up-across', clue: 'Search engine', answer: 'GOOGLE', enumeration: [6], startRow: 13, startCol: 2 },
          { number: 20, direction: 'across', clue: 'Finish', answer: 'THEEND', enumeration: [3, 3], startRow: 14, startCol: 8 }
        ],
        estimatedTime: 300,
        coinReward: 100
      },
      {
        title: "Legends & Legacies",
        difficulty: Difficulty.HARD,
        category: "General Knowledge",
        grid: { rows: 12, cols: 12 },
    clues: [
          // --- TOP SECTION (High Density Vertical Starts) ---
          { number: 1, direction: 'right-down', clue: 'Action star (2 words)', answer: 'TOMCRUISE', enumeration: [3, 6], startRow: 0, startCol: 0 },
          { number: 2, direction: 'down', clue: 'Morning moisture', answer: 'DEW', enumeration: [3], startRow: 0, startCol: 2 },
          { number: 3, direction: 'left-down', clue: 'Microsoft founder (2 words)', answer: 'BILLGATES', enumeration: [4, 5], startRow: 0, startCol: 4 },
          { number: 4, direction: 'down', clue: 'Frozen water', answer: 'ICE', enumeration: [3], startRow: 0, startCol: 5 },
          { number: 5, direction: 'left-down', clue: 'Queen lead (2 words)', answer: 'FREDDIEMERCURY', enumeration: [7, 7], startRow: 0, startCol: 8 },
          { number: 6, direction: 'down', clue: 'Snake-like fish', answer: 'EEL', enumeration: [3], startRow: 0, startCol: 9 },
          { number: 7, direction: 'left-down', clue: 'Star Wars villain (2 words)', answer: 'DARTHVADER', enumeration: [5, 5], startRow: 0, startCol: 11 },
      
          // --- HORIZONTAL INTERSECTIONS (Passing through the verticals above) ---
          // Row 1: Intersects TOMCRUISE(O), DEW(E), BILLGATES(I), FREDDIE(R), DARTH(A)
          { number: 8, direction: 'across', clue: 'Musical speed', answer: 'TEMPO', enumeration: [5], startRow: 1, startCol: 0 }, 
          // Row 3: Intersects TOM(R), BILL(L), FREDDIE(D), DARTH(T)
          { number: 9, direction: 'across', clue: 'Broad street', answer: 'AVENUE', enumeration: [6], startRow: 3, startCol: 1 },
          // Row 5: Intersects TOM(I), BILL(A), FREDDIE(E), DARTH(V)
          { number: 10, direction: 'across', clue: 'Scientific study', answer: 'BIOLOGY', enumeration: [7], startRow: 5, startCol: 0 },
      
          // --- MID SECTION (Bridging the gap) ---
          { number: 11, direction: 'down-across', clue: 'Harry Potter author (2 words)', answer: 'JKROWLING', enumeration: [2, 7], startRow: 6, startCol: 1 },
          { number: 12, direction: 'up-across', clue: 'Tech giant (2 words)', answer: 'STEVEJOBS', enumeration: [5, 4], startRow: 8, startCol: 2 },
          { number: 13, direction: 'down', clue: 'Egyptian river', answer: 'NILE', enumeration: [4], startRow: 4, startCol: 3 },
          { number: 14, direction: 'down', clue: 'Olympic gold (2 words)', answer: 'USAINBOLT', enumeration: [5, 4], startRow: 2, startCol: 6 },
          { number: 15, direction: 'right-down', clue: 'Paintings site', answer: 'LOUVRE', enumeration: [6], startRow: 5, startCol: 10 },
      
          // --- BOTTOM SECTION (Densely packed) ---
          { number: 16, direction: 'across', clue: 'Frozen dessert (2 words)', answer: 'ICECREAM', enumeration: [4, 4], startRow: 9, startCol: 3 },
          { number: 17, direction: 'down-across', clue: 'Tennis legend (2 words)', answer: 'ROGERFEDERER', enumeration: [5, 7], startRow: 10, startCol: 0 },
          { number: 18, direction: 'across', clue: 'Lunar phase', answer: 'NEWMOON', enumeration: [3, 4], startRow: 11, startCol: 4 },
          { number: 19, direction: 'up-across', clue: 'Great lake', answer: 'ERIE', enumeration: [4], startRow: 11, startCol: 0 }
        ],
        estimatedTime: 360,
        coinReward: 150
      },

  {
    title: "Pop Culture Mix",
    difficulty: Difficulty.EASY,
    category: "Pop Culture",
    grid: { rows: 11, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'Video streaming giant', answer: 'NETFLIX', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Famous space saga', answer: 'STARWARS', enumeration: [4, 4], startRow: 0, startCol: 2 },
      { number: 3, direction: 'down', clue: 'Famous wizard boy', answer: 'HARRY', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 4, direction: 'right-down', clue: 'Web-slinging hero', answer: 'SPIDERMAN', enumeration: [6, 3], startRow: 0, startCol: 6 },
      { number: 5, direction: 'left-down', clue: 'Apple smartphone line', answer: 'IPHONE', enumeration: [6], startRow: 0, startCol: 8 },
  
      { number: 6, direction: 'across', clue: 'Marvel thunder god', answer: 'THOR', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Batmans city', answer: 'GOTHAM', enumeration: [6], startRow: 1, startCol: 3 },
      { number: 8, direction: 'down', clue: 'Taylor’s last name', answer: 'SWIFT', enumeration: [5], startRow: 1, startCol: 5 },
      { number: 9, direction: 'across', clue: 'Famous animated ogre', answer: 'SHREK', enumeration: [5], startRow: 1, startCol: 4 },
  
      { number: 10, direction: 'down', clue: 'Superhero in a metal suit', answer: 'IRONMAN', enumeration: [4, 3], startRow: 2, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Marios brother', answer: 'LUIGI', enumeration: [5], startRow: 2, startCol: 2 },
      { number: 12, direction: 'down', clue: 'Toy Story cowboy', answer: 'WOODY', enumeration: [5], startRow: 2, startCol: 7 },
  
      { number: 13, direction: 'across', clue: 'Big concert crowd reaction', answer: 'CHEERS', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 14, direction: 'down-across', clue: 'Fantasy hit with dragons', answer: 'GAMEOFTHRONES', enumeration: [4, 2, 7], startRow: 3, startCol: 4 },
  
      { number: 15, direction: 'across', clue: 'Short video app', answer: 'TIKTOK', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 16, direction: 'down', clue: 'Video game console brand', answer: 'PLAYSTATION', enumeration: [4, 7], startRow: 4, startCol: 6 },
      { number: 17, direction: 'across', clue: 'Famous band from Liverpool', answer: 'THEBEATLES', enumeration: [3, 7], startRow: 4, startCol: 1 },
  
      { number: 18, direction: 'down', clue: 'Disney ice princess movie', answer: 'FROZEN', enumeration: [6], startRow: 5, startCol: 2 },
      { number: 19, direction: 'across', clue: 'Smash hit pop genre', answer: 'POP', enumeration: [3], startRow: 6, startCol: 0 },
      { number: 20, direction: 'across', clue: 'Social media like icon', answer: 'HEART', enumeration: [5], startRow: 6, startCol: 4 },
  
      { number: 21, direction: 'down', clue: 'Popular music star', answer: 'TAYLORSWIFT', enumeration: [6, 5], startRow: 7, startCol: 0 },
      { number: 22, direction: 'across', clue: 'Classic handheld game company', answer: 'NINTENDO', enumeration: [8], startRow: 8, startCol: 1 },
      { number: 23, direction: 'down-across', clue: 'Superhero team name', answer: 'AVENGERS', enumeration: [8], startRow: 8, startCol: 6 },
  
      { number: 24, direction: 'across', clue: 'Animated snowman from Frozen', answer: 'OLAF', enumeration: [4], startRow: 9, startCol: 0 },
      { number: 25, direction: 'across', clue: 'Famous sci fi robot', answer: 'ROBOT', enumeration: [5], startRow: 10, startCol: 4 }
    ],
    estimatedTime: 90,
    coinReward: 10
  }
];

// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

/**
 * Validation function to check:
 * 1. All clues fit within grid boundaries
 * 2. Answer cells don't overlap with clue cells
 * 3. Answer cells that overlap have matching letters (valid crossings)
 * 4. After the end of an answer, there must not be additional answer cells extending the word—e.g., if the answer is "SEE", the cell immediately after must be empty or a clue. Otherwise, it could create unintended or invalid words and break the integrity of the crossword solution.
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
  
  // Remove spaces from answer for cell placement (spaces are not placed in grid)
  const answerWithoutSpaces = answer.replace(/\s+/g, '');
  
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
  
  // Place only non-space characters in grid cells
  for (let i = 0; i < answerWithoutSpaces.length; i++) {
    if (goesDown) {
      cells.push({ row: answerStartRow + i, col: answerStartCol, letter: answerWithoutSpaces[i] });
    } else {
      cells.push({ row: answerStartRow, col: answerStartCol + i, letter: answerWithoutSpaces[i] });
    }
  }
  
  return cells;
}

function validatePuzzle(puzzle: typeof samplePuzzles[0]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { rows, cols } = puzzle.grid;
  
  // Build grid to track cell usage
  const clueCells = new Map<string, { clueNumber: number; clueText: string }>();
  const answerCells = new Map<string, Array<{ clueNumber: number; letter: string }>>();
  
  // First pass: mark all clue cells
  for (const clue of puzzle.clues) {
    const key = `${clue.startRow},${clue.startCol}`;
    clueCells.set(key, { clueNumber: clue.number, clueText: clue.clue });
  }
  
  // Second pass: validate each clue's answer placement
  for (const clue of puzzle.clues) {
    const answerWithoutSpaces = clue.answer.replace(/\s+/g, '');
    const answerLength = answerWithoutSpaces.length;
    const { startRow, startCol, direction, answer, number: clueNum, enumeration } = clue;

    // Validate enumeration matches answer length
    if (enumeration && enumeration.length > 0) {
      const enumerationSum = enumeration.reduce((sum, num) => sum + num, 0);
      const answerWithoutSpaces = answer.replace(/\s+/g, '');
      const answerLengthNoSpaces = answerWithoutSpaces.length;
      
      if (enumerationSum !== answerLengthNoSpaces) {
        const multiWordInfo = enumeration.length > 1 
          ? ` (multi-word: ${enumeration.join(' + ')} = ${enumerationSum} letters)`
          : '';
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clueNum,
          clue: clue.clue,
          answer,
          direction,
          error: `ENUMERATION MISMATCH: enumeration [${enumeration.join(', ')}] sums to ${enumerationSum} but answer "${answer}" has ${answerLengthNoSpaces} letters${multiWordInfo}`
        });
      }
      
      // For multi-word answers, verify the answer can be split according to enumeration
      if (enumeration.length > 1 && enumerationSum === answerLengthNoSpaces) {
        let currentIndex = 0;
        const words: string[] = [];
        let hasError = false;
        
        for (let i = 0; i < enumeration.length; i++) {
          const wordLength = enumeration[i];
          if (currentIndex + wordLength > answerLengthNoSpaces) {
            errors.push({
              puzzleTitle: puzzle.title,
              clueNumber: clueNum,
              clue: clue.clue,
              answer,
              direction,
              error: `ENUMERATION ERROR: Cannot split "${answerWithoutSpaces}" into ${enumeration.length} words of lengths [${enumeration.join(', ')}] - exceeds answer length at word ${i + 1} (${words.join(' ')}...)`
            });
            hasError = true;
            break;
          }
          words.push(answerWithoutSpaces.substring(currentIndex, currentIndex + wordLength));
          currentIndex += wordLength;
        }
        
        // If valid multi-word answer, we can optionally log it for debugging
        // Format: "TOMCRUISE" with [3, 6] = "TOM CRUISE"
        if (!hasError && words.length > 0) {
          // Validation passed - multi-word answer is correctly formatted
          // Example: answer="TOMCRUISE", enumeration=[3,6] → words=["TOM", "CRUISE"]
        }
      }
    }

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
      continue;
    }
    
    // Overlap + crossing tracking
    const answerCellPositions = getAnswerCells(clue);
    for (const cell of answerCellPositions) {
      const key = `${cell.row},${cell.col}`;
      
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
      
      if (!answerCells.has(key)) {
        answerCells.set(key, []);
      }
      answerCells.get(key)!.push({ clueNumber: clueNum, letter: cell.letter });
    }
  }
  
  // Third pass: crossing letter mismatches
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

  // ─────────────────────────────────────────────
  // Fourth pass (REWRITTEN): validate each clue path
  // ─────────────────────────────────────────────

  const grid: (string | 'CLUE' | null)[][] =
    Array(rows).fill(null).map(() => Array(cols).fill(null));

  for (const clue of puzzle.clues) {
    grid[clue.startRow][clue.startCol] = 'CLUE';
  }

  for (const clue of puzzle.clues) {
    for (const cell of getAnswerCells(clue)) {
      // Bounds check before setting grid cell
      if (cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols) {
        grid[cell.row][cell.col] = cell.letter;
      } else {
        // This should have been caught in boundary validation, but add safety check
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: clue.answer,
          direction: clue.direction,
          error: `OUT OF BOUNDS: Cell (${cell.row},${cell.col}) is outside grid (${rows}x${cols})`
        });
      }
    }
  }

  for (const clue of puzzle.clues) {
    const expected = clue.answer.replace(/\s+/g, ''); // Remove spaces for comparison
    const cells = getAnswerCells(clue);

    let reconstructed = '';

    for (const cell of cells) {
      // Bounds check
      if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: clue.answer,
          direction: clue.direction,
          error: `OUT OF BOUNDS: Cell (${cell.row},${cell.col}) is outside grid (${rows}x${cols})`
        });
        reconstructed = '';
        break;
      }
      
      const value = grid[cell.row][cell.col];

      if (!value || value === 'CLUE') {
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: expected,
          direction: clue.direction,
          error: `MISSING LETTER at (${cell.row},${cell.col})`
        });
        reconstructed = '';
        break;
      }

      reconstructed += value;
    }

    if (reconstructed && reconstructed !== expected) {
      errors.push({
        puzzleTitle: puzzle.title,
        clueNumber: clue.number,
        clue: clue.clue,
        answer: expected,
        direction: clue.direction,
        error: `ANSWER MISMATCH: expected "${expected}" but found "${reconstructed}"`
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

const seedDatabase = async () => {
  try {
    // Run validation before seeding
    validateAllPuzzles();
    let mongoUri = 'mongodb://localhost:27017/arrow-crossword';

    console.log('\n🔍 Connection Details:');
    console.log(`   MONGODB_URI from env: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
    
    // Ensure the database name is 'arrow-crossword' in the connection string
    // MongoDB connection strings: mongodb+srv://user:pass@host/database?options
    if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb://')) {
      // Check if database name is specified
      const uriParts = mongoUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];
      
      // If the last part contains '?' (options), extract database name
      if (lastPart.includes('?')) {
        const [dbName, options] = lastPart.split('?');
        if (dbName && dbName !== 'arrow-crossword' && dbName !== 'test') {
          console.log(`   ⚠️  Database in URI is "${dbName}", changing to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = `arrow-crossword?${options}`;
          mongoUri = uriParts.join('/');
        } else if (!dbName || dbName === 'test') {
          console.log(`   ⚠️  No database specified or using "test", setting to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = `arrow-crossword${options ? '?' + options : ''}`;
          mongoUri = uriParts.join('/');
        }
      } else {
        // No options, check if database name exists
        if (lastPart && lastPart !== 'arrow-crossword' && lastPart !== 'test') {
          console.log(`   ⚠️  Database in URI is "${lastPart}", changing to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = 'arrow-crossword';
          mongoUri = uriParts.join('/');
        } else if (!lastPart || lastPart === 'test') {
          console.log(`   ⚠️  No database specified or using "test", appending "arrow-crossword"`);
          mongoUri = mongoUri.endsWith('/') ? `${mongoUri}arrow-crossword` : `${mongoUri}/arrow-crossword`;
        }
      }
    }
    
    console.log(`   Using URI: ${mongoUri.substring(0, 50)}...`);
    
    await mongoose.connect(mongoUri);
    
    // Get actual connection details
    const dbName = mongoose.connection.db?.databaseName;
    const host = mongoose.connection.host;
    const collectionName = Puzzle.collection.name;
    
    console.log(`✅ Connected to MongoDB`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Collection: ${collectionName}`);
    console.log('');

    // Check current puzzle count before deletion
    const countBefore = await Puzzle.countDocuments({});
    console.log(`📊 Current puzzles in database: ${countBefore}`);

    await Puzzle.deleteMany({});
    console.log('🗑️  Cleared existing puzzles');

    // Verify deletion
    const countAfter = await Puzzle.countDocuments({});
    console.log(`📊 Puzzles remaining after deletion: ${countAfter}`);
    
    if (countAfter > 0) {
      console.warn(`⚠️  WARNING: ${countAfter} puzzle(s) still exist!`);
    }

    // Filter to only valid puzzles (no validation errors)
    const validPuzzles = samplePuzzles.filter(puzzle => {
      const errors = validatePuzzle(puzzle);
      return errors.length === 0;
    });
    
    console.log(`\n📊 Puzzle Validation Summary:`);
    console.log(`   Total puzzles: ${samplePuzzles.length}`);
    console.log(`   Valid puzzles: ${validPuzzles.length}`);
    console.log(`   Invalid puzzles: ${samplePuzzles.length - validPuzzles.length}`);
    
    if (validPuzzles.length === 0) {
      console.error('\n❌ No valid puzzles to seed! Please fix validation errors.');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    await Puzzle.insertMany(validPuzzles);
    console.log(`\n📥 Inserted ${validPuzzles.length} valid puzzles`);

    // Verify final count
    const finalCount = await Puzzle.countDocuments({});
    console.log(`📊 Final puzzle count: ${finalCount}`);
    console.log('');
    console.log('✅ Database seeded successfully');
    console.log(`   Make sure you're viewing: ${host}/${dbName}/${collectionName} in Compass`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();