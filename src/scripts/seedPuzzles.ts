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
      cols: 5
    },
    clues: [
      // { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'up-across', clue: 'Edo is', answer: 'BE', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down-across', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'left-down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 7, direction: 'right-down', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
    ],
    estimatedTime: 120,
    coinReward: 10
  },
  {
    title: "Daily Challenge",
    difficulty: Difficulty.MEDIUM,
    category: "General",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 300,
    coinReward: 25
  },
  {
    title: "Hip Hop Caviar",
    difficulty: Difficulty.EXPERT,
    category: "Music",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'BE', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "History challenge",
    difficulty: Difficulty.HARD,
    category: "History",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "Physics challenge",
    difficulty: Difficulty.EXPERT,
    category: "Physics",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "Nutrition challenge",
    difficulty: Difficulty.EXPERT,
    category: "Nutrition",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "Tv shows challenge",
    difficulty: Difficulty.HARD,
    category: "Tv shows",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "Movies challenge",
    difficulty: Difficulty.MEDIUM,
    category: "Movies",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 },
    ],
    estimatedTime: 600,
    coinReward: 50
  }
  ,
  {
    title: "Sports challenge",
    difficulty: Difficulty.EXPERT,
    category: "Sports",
    grid: {
      rows: 5,
      cols: 5
    },
    clues: [
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Edo is', answer: 'SLIM', startRow: 4, startCol: 0 },
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      { number: 5, direction: 'down', clue: 'Wonder', answer: 'ROAM', startRow: 0, startCol: 4 },
      { number: 6, direction: 'across', clue: 'not this and not that', answer: 'NOR', startRow: 1, startCol: 1 },
      { number: 7, direction: 'across', clue: 'scary sound', answer: 'BOO', startRow: 2, startCol: 1 },
      { number: 8, direction: 'across', clue: 'homeowners association', answer: 'HOA', startRow: 3, startCol: 1 }
    ],
    estimatedTime: 600,
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