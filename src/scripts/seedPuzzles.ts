import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { Difficulty } from '../types';

dotenv.config();

const samplePuzzles = [
  {
    title: "Simple Beginnings",
    difficulty: Difficulty.EASY,
    category: "General",
    grid: {
      rows: 5,
      cols: 5,
      cells: [
        ['C', 'A', 'T', '#', 'D'],
        ['A', '#', 'O', '#', 'O'],
        ['R', 'U', 'N', '#', 'G'],
        ['#', '#', '#', '#', '#'],
        ['S', 'U', 'N', 'N', 'Y']
      ]
    },
    clues:  [
        { number: 1, direction: 'across' as const, clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
        { number: 3, direction: 'across' as const, clue: 'Sprint', answer: 'RUN', startRow: 2, startCol: 0 },
        { number: 4, direction: 'across' as const, clue: 'Bright weather', answer: 'SUNNY', startRow: 4, startCol: 0 },
        { number: 1, direction: 'down' as const, clue: 'Automobile', answer: 'CAR', startRow: 0, startCol: 0 },
        { number: 2, direction: 'down' as const, clue: 'Also', answer: 'TOO', startRow: 0, startCol: 2 },
        { number: 5, direction: 'down' as const, clue: 'Canine', answer: 'DOG', startRow: 0, startCol: 4 }
      ]
    ,
    estimatedTime: 120,
    xpReward: 10
  },
  {
    title: "Daily Challenge",
    difficulty: Difficulty.MEDIUM,
    category: "General",
    grid: {
      rows: 7,
      cols: 7,
      cells: [
        ['B', 'R', 'E', 'A', 'D', '#', 'M'],
        ['A', '#', '#', '#', 'A', '#', 'O'],
        ['K', 'I', 'T', 'E', 'Y', '#', 'U'],
        ['E', '#', '#', '#', '#', '#', 'S'],
        ['R', 'I', 'V', 'E', 'R', '#', 'E'],
        ['#', '#', '#', '#', 'S', '#', '#'],
        ['S', 'T', 'O', 'R', 'M', 'Y', '#']
      ]
    },
    clues:  [
        { number: 1, direction: 'across' as const, clue: 'Baked food', answer: 'BREAD', startRow: 0, startCol: 0 },
        { number: 2, direction: 'across' as const, clue: 'Small cat', answer: 'KITEY', startRow: 2, startCol: 0 },
        { number: 3, direction: 'across' as const, clue: 'Water body', answer: 'RIVER', startRow: 4, startCol: 0 },
        { number: 4, direction: 'across' as const, clue: 'Weather with rain', answer: 'STORMY', startRow: 6, startCol: 0 },
        { number: 1, direction: 'down' as const, clue: 'Person who bakes', answer: 'BAKER', startRow: 0, startCol: 0 },
        { number: 5, direction: 'down' as const, clue: 'Computer input device', answer: 'MOUSE', startRow: 0, startCol: 6 },
        { number: 6, direction: 'down' as const, clue: 'Not night', answer: 'DAYES', startRow: 0, startCol: 4 }
      ]
    ,
    estimatedTime: 300,
    xpReward: 25
  },
  {
    title: "Expert Level",
    difficulty: Difficulty.HARD,
    category: "General",
    grid: {
      rows: 9,
      cols: 9,
      cells: [
        ['P', 'Y', 'T', 'H', 'O', 'N', '#', 'C', 'A'],
        ['R', '#', '#', '#', '#', 'O', '#', 'O', 'P'],
        ['O', 'C', 'E', 'A', 'N', 'S', '#', 'D', 'P'],
        ['G', '#', '#', '#', '#', '#', '#', 'E', 'L'],
        ['R', 'O', 'C', 'K', 'E', 'T', '#', '#', 'E'],
        ['A', '#', '#', '#', '#', 'O', '#', 'J', '#'],
        ['M', 'O', 'U', 'N', 'T', 'A', 'I', 'N', 'S'],
        ['#', '#', '#', '#', '#', '#', '#', 'G', '#'],
        ['S', 'T', 'R', 'E', 'A', 'M', '#', '#', '#']
      ]
    },
    clues:  [
        { number: 1, direction: 'across' as const, clue: 'Programming language', answer: 'PYTHON', startRow: 0, startCol: 0 },
        { number: 2, direction: 'across' as const, clue: 'Large bodies of water', answer: 'OCEANS', startRow: 2, startCol: 0 },
        { number: 3, direction: 'across' as const, clue: 'Space vehicle', answer: 'ROCKET', startRow: 4, startCol: 0 },
        { number: 4, direction: 'across' as const, clue: 'High elevations', answer: 'MOUNTAINS', startRow: 6, startCol: 0 },
        { number: 5, direction: 'across' as const, clue: 'Small river', answer: 'STREAM', startRow: 8, startCol: 0 },
        { number: 1, direction: 'down' as const, clue: 'Computer software', answer: 'PROGRAM', startRow: 0, startCol: 0 },
        { number: 6, direction: 'down' as const, clue: 'Laptop or desktop', answer: 'COMPUTER', startRow: 0, startCol: 7 },
        { number: 7, direction: 'down' as const, clue: 'Mobile phone', answer: 'CELLPHONE', startRow: 0, startCol: 8 }
      ]
    ,
    estimatedTime: 600,
    xpReward: 50
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