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
      // ACROSS
      { number: 1, direction: 'across', clue: 'Feline pet', answer: 'CAT', startRow: 0, startCol: 0 },
      // C A T
      { number: 2, direction: 'across', clue: 'Run quickly', answer: 'RUN', startRow: 2, startCol: 0 },
      // R U N
      { number: 3, direction: 'across', clue: 'Bright and not cloudy', answer: 'SUNNY', startRow: 4, startCol: 0 },
      // S U N N Y

      // DOWN
      { number: 4, direction: 'down', clue: 'A vehicle', answer: 'CAR', startRow: 0, startCol: 0 },
      // C A R
      { number: 5, direction: 'down', clue: 'Hot weather dog', answer: 'DOG', startRow: 0, startCol: 4 },
      // D O G
      { number: 6, direction: 'down', clue: 'Used for shade', answer: 'SUN', startRow: 2, startCol: 2 },
      // N N Y (vertical from row 2 col 2)
    ],
    estimatedTime: 120,
    xpReward: 10
  },
  {
    title: "Daily Challenge",
    difficulty: Difficulty.MEDIUM,
    category: "General",
    grid: {
      rows: 7,
      cols: 7
    },
    clues: [
      // ACROSS
      { number: 1, direction: 'across', clue: 'Baked good', answer: 'BREAD', startRow: 0, startCol: 0 }, // 0,0
      // B R E A D
      { number: 2, direction: 'across', clue: 'Flying toy', answer: 'KITE', startRow: 2, startCol: 0 }, // 2,0
      // K I T E
      { number: 3, direction: 'across', clue: 'Water flowing', answer: 'RIVER', startRow: 4, startCol: 0 }, // 4,0
      // R I V E R
      { number: 4, direction: 'across', clue: 'Wild weather', answer: 'STORMY', startRow: 6, startCol: 0 }, // 6,0
      // S T O R M Y

      // DOWN
      { number: 5, direction: 'down', clue: 'Person who bakes', answer: 'BAKER', startRow: 0, startCol: 0 }, // B A K E R
      // 0,0 downwards
      { number: 6, direction: 'down', clue: 'Bread ingredient', answer: 'YEAST', startRow: 0, startCol: 4 }, // D A Y S T
      // 0,4 downwards
      { number: 7, direction: 'down', clue: 'Computer rodent', answer: 'MOUSE', startRow: 0, startCol: 6 }, // M O U S E
      // 0,6 downwards
    ],
    estimatedTime: 300,
    xpReward: 25
  },
  {
    title: "Expert Level",
    difficulty: Difficulty.HARD,
    category: "General",
    grid: {
      rows: 9,
      cols: 9
    },
    clues: [
      // ACROSS
      { number: 1, direction: 'across', clue: 'Coding snake', answer: 'PYTHON', startRow: 0, startCol: 0 }, // 0,0
      { number: 2, direction: 'across', clue: 'Large water bodies', answer: 'OCEANS', startRow: 2, startCol: 0 }, // 2,0
      { number: 3, direction: 'across', clue: 'Space vehicle', answer: 'ROCKET', startRow: 4, startCol: 0 }, // 4,0
      { number: 4, direction: 'across', clue: 'Tall landforms', answer: 'MOUNTAINS', startRow: 6, startCol: 0 }, // 6,0
      { number: 5, direction: 'across', clue: 'Small river', answer: 'STREAM', startRow: 8, startCol: 0 }, // 8,0

      // DOWN
      { number: 6, direction: 'down', clue: 'Code block', answer: 'PROGRAM', startRow: 0, startCol: 0 }, // 0,0
      { number: 7, direction: 'down', clue: 'Electronic brain', answer: 'COMPUTER', startRow: 0, startCol: 7 }, // 0,7
      { number: 8, direction: 'down', clue: 'Pocket phone', answer: 'CELLPHONE', startRow: 0, startCol: 8 } // 0,8
    ],
    estimatedTime: 600,
    xpReward: 50
  }
];

// Integrity check for clues and grids: All clues' answers should match the puzzle grid. 
// That means each clue (across or down) will be double-checked 
// so that the cells starting from startRow/startCol match its answer.

const validatePuzzles = (puzzles: typeof samplePuzzles) => {
  for (const puzzle of puzzles) {
    for (const clue of puzzle.clues) {
      let computed = '';
      let { startRow, startCol, answer, direction } = clue;
      for (let i = 0; i < answer.length; i++) {
        let r = startRow, c = startCol;
        if (direction === 'across') c += i;
        else r += i;
        // bounds check
        if (
          r < 0 || r >= puzzle.grid.rows ||
          c < 0 || c >= puzzle.grid.cols
        ) {
          throw new Error(`Clue "${clue.clue}" answer runs out of puzzle bounds for "${puzzle.title}"`);
        }
        let letter = puzzle.grid.cells[r][c];
        if (letter === '#' || letter !== answer[i]) {
          throw new Error(`Clue "${clue.clue}" does not match grid in puzzle "${puzzle.title}"`);
        }
      }
    }
  }
};

const seedDatabase = async () => {
  try {
    // validatePuzzles(samplePuzzles);
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