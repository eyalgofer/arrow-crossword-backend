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
  // ==================== EASY PUZZLES ====================
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
    title: "Yeali's Puzzle",
    difficulty: Difficulty.EASY,
    category: "Animals",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Car manufacturer', answer: 'VOLVO', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'State (physics)', answer: 'SOLID', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 3, direction: 'across', clue: 'Dog breed', answer: 'PUG', enumeration: [3], startRow: 3, startCol: 1 },
      { number: 4, direction: 'right-down', clue: 'Hops around', answer: 'BUNNY', enumeration: [5], startRow: 1, startCol: 4 },
      { number: 5, direction: 'down', clue: 'have', answer: 'GOT', enumeration: [3], startRow: 3, startCol: 4 },
      { number: 5, direction: 'down', clue: 'have', answer: 'GOT', enumeration: [3], startRow: 3, startCol: 4 },
      { number: 5, direction: 'down', clue: 'have', answer: 'GOT', enumeration: [3], startRow: 3, startCol: 4 },
      { number: 5, direction: 'down', clue: 'have', answer: 'GOT', enumeration: [3], startRow: 3, startCol: 4 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Snack Attack",
    difficulty: Difficulty.EASY,
    category: "Food",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Movie theater must-have', answer: 'POPCORN', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Dip partner', answer: 'CHIP', enumeration: [4], startRow: 0, startCol: 5 },
      { number: 3, direction: 'down-across', clue: 'Midnight fridge raid', answer: 'PIZZA', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Ice cream holder', answer: 'CONE', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Chocolate bar cousin', answer: 'CANDY', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Sandwich bread', answer: 'BUN', enumeration: [3], startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Lazy Sunday",
    difficulty: Difficulty.EASY,
    category: "Lifestyle",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Couch potato activity', answer: 'NAP', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Netflix partner', answer: 'CHILL', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Binge watching device', answer: 'TV', enumeration: [2], startRow: 1, startCol: 0 },
      { number: 4, direction: 'down-across', clue: 'Pajama zone', answer: 'BED', enumeration: [3], startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Brunch beverage', answer: 'MIMOSA', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 6, direction: 'up-across', clue: 'Zero plans', answer: 'RELAX', enumeration: [5], startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Emoji Speak",
    difficulty: Difficulty.EASY,
    category: "Internet",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Happy yellow face', answer: 'SMILE', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Crying with joy', answer: 'LOL', enumeration: [3], startRow: 0, startCol: 5 },
      { number: 3, direction: 'down-across', clue: 'Red beating shape', answer: 'HEART', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Thumbs gesture', answer: 'UP', enumeration: [2], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Fire indicator', answer: 'HOT', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Clapping hands', answer: 'BRAVO', enumeration: [5], startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },

  // ==================== MEDIUM PUZZLES ====================
  {
    title: "Office Survival",
    difficulty: Difficulty.MEDIUM,
    category: "Work",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Could be an email', answer: 'MEETING', enumeration: [7], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Inbox nightmare', answer: 'SPAM', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Spreadsheet prison', answer: 'EXCEL', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Boss approaching sound', answer: 'PANIC', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Free food alert', answer: 'LUNCH', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Deadline feeling', answer: 'STRESS', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Friday mood', answer: 'FREE', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'down', clue: 'Caffeine station', answer: 'BREAK', enumeration: [5], startRow: 0, startCol: 1 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Gym Rats",
    difficulty: Difficulty.MEDIUM,
    category: "Fitness",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Skip leg day excuse', answer: 'TIRED', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Mirror selfie spot', answer: 'GYM', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Protein shake ingredient', answer: 'WHEY', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Cardio torture device', answer: 'TREADMILL', enumeration: [9], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Gains evidence', answer: 'MUSCLE', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Post-workout pain', answer: 'SORE', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Heavy lifting item', answer: 'WEIGHT', enumeration: [6], startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Dating Disasters",
    difficulty: Difficulty.MEDIUM,
    category: "Romance",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Swipe right app', answer: 'TINDER', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Awkward silence killer', answer: 'JOKE', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'First date jitters', answer: 'NERVES', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Who pays debate', answer: 'BILL', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Goodnight maybe', answer: 'KISS', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Ghosting opposite', answer: 'TEXT', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Relationship status', answer: 'SINGLE', enumeration: [6], startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Social Media Brain",
    difficulty: Difficulty.MEDIUM,
    category: "Internet",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Double tap action', answer: 'LIKE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Viral dance platform', answer: 'TIKTOK', enumeration: [6], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Story disappears in 24h', answer: 'SNAP', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Blue bird platform', answer: 'TWITTER', enumeration: [7], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Influencer currency', answer: 'FOLLOWERS', enumeration: [9], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Pound sign trend', answer: 'HASHTAG', enumeration: [7], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Share again', answer: 'REPOST', enumeration: [6], startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Video Game Life",
    difficulty: Difficulty.MEDIUM,
    category: "Gaming",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Try again screen', answer: 'GAMEOVER', enumeration: [8], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Rage quit trigger', answer: 'LAG', enumeration: [3], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'One more game lie', answer: 'LAST', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Victory royale game', answer: 'FORTNITE', enumeration: [8], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Save point', answer: 'CHECKPOINT', enumeration: [10], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Extra life pickup', answer: 'POWERUP', enumeration: [7], startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Final enemy', answer: 'BOSS', enumeration: [4], startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },
  {
    title: "Cooking Chaos",
    difficulty: Difficulty.MEDIUM,
    category: "Food",
    grid: { rows: 6, cols: 7 },
    clues: [
      { number: 1, direction: 'across', clue: 'Smoke alarm timer', answer: 'BURNT', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Recipe ignored', answer: 'WING', enumeration: [4], startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Just add water food', answer: 'RAMEN', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Delivery app backup', answer: 'UBER', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Chopping tears', answer: 'ONION', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Recipe says medium', answer: 'HEAT', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Baking disaster', answer: 'FLAT', enumeration: [4], startRow: 5, startCol: 0 },
    ],
    estimatedTime: 180,
    coinReward: 20
  },

  // ==================== HARD PUZZLES ====================
  {
    title: "Millennial Struggles",
    difficulty: Difficulty.HARD,
    category: "Life",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'Avocado purchase regret', answer: 'TOAST', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Student debt feeling', answer: 'BROKE', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Adulting failure', answer: 'TAXES', enumeration: [5], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Housing market mood', answer: 'DESPAIR', enumeration: [7], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Side hustle platform', answer: 'ETSY', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Therapy topic', answer: 'ANXIETY', enumeration: [7], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Plant parent status', answer: 'DEAD', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'WiFi password ask', answer: 'FIRST', enumeration: [5], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Netflix Binge",
    difficulty: Difficulty.HARD,
    category: "TV Shows",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'Upside down world', answer: 'STRANGER', enumeration: [8], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Korean survival game', answer: 'SQUID', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Chess prodigy show', answer: 'QUEENS', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Tiger guy documentary', answer: 'KING', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Witcher grunt', answer: 'HMM', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Heist crew city', answer: 'MONEY', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Royal drama family', answer: 'CROWN', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Still watching question', answer: 'YES', enumeration: [3], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Meme Lord",
    difficulty: Difficulty.HARD,
    category: "Internet",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'Distracted boyfriend', answer: 'MEME', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Doge currency', answer: 'COIN', enumeration: [4], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'This is fine dog', answer: 'FIRE', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Woman yelling at', answer: 'CAT', enumeration: [3], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Rickroll singer', answer: 'ASTLEY', enumeration: [6], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Trade offer format', answer: 'DEAL', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Surprised Pikachu', answer: 'FACE', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'OK boomer target', answer: 'OLD', enumeration: [3], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Startup Bingo",
    difficulty: Difficulty.HARD,
    category: "Business",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'We are family here', answer: 'TOXIC', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Buzzword salad', answer: 'SYNERGY', enumeration: [7], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Ping pong table workspace', answer: 'OFFICE', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Move fast break things', answer: 'MOTTO', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Unlimited PTO catch', answer: 'GUILT', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Equity instead of salary', answer: 'STOCK', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Hustle culture drink', answer: 'REDBULL', enumeration: [7], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Disrupt everything', answer: 'UBER', enumeration: [4], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Dad Jokes",
    difficulty: Difficulty.HARD,
    category: "Humor",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'Hi Hungry Im', answer: 'DAD', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Thermostat guardian', answer: 'FATHER', enumeration: [6], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Grill master title', answer: 'KING', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'New balance wearer', answer: 'SHOE', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Lawn obsession', answer: 'GRASS', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Pun reaction', answer: 'GROAN', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Cargo shorts feature', answer: 'POCKET', enumeration: [6], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Nap location', answer: 'COUCH', enumeration: [5], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },
  {
    title: "Zoom Fatigue",
    difficulty: Difficulty.HARD,
    category: "Remote Work",
    grid: { rows: 7, cols: 8 },
    clues: [
      { number: 1, direction: 'across', clue: 'You are on mute', answer: 'UNMUTE', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Virtual background', answer: 'BEACH', enumeration: [5], startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Camera off excuse', answer: 'WIFI', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Pants optional zone', answer: 'HOME', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Can you see my screen', answer: 'SHARE', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Lets circle back', answer: 'LATER', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Cat cameo star', answer: 'PET', enumeration: [3], startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Meeting that could be email', answer: 'ALL', enumeration: [3], startRow: 6, startCol: 0 },
    ],
    estimatedTime: 300,
    coinReward: 35
  },

  // ==================== EXPERT PUZZLES ====================
  {
    title: "Crypto Bros",
    difficulty: Difficulty.EXPERT,
    category: "Finance",
    grid: { rows: 8, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'Diamond hands opposite', answer: 'PAPER', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'To the celestial body', answer: 'MOON', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Ape together strong', answer: 'APE', enumeration: [3], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'HODL misspelling', answer: 'HOLD', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Fear uncertainty doubt', answer: 'FUD', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Satoshi creation', answer: 'BITCOIN', enumeration: [7], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'When lambo question', answer: 'SOON', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Buy the dip action', answer: 'BUY', enumeration: [3], startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Not financial advice', answer: 'DYOR', enumeration: [4], startRow: 7, startCol: 0 },
    ],
    estimatedTime: 420,
    coinReward: 45
  },
  {
    title: "Relationship Status",
    difficulty: Difficulty.EXPERT,
    category: "Romance",
    grid: { rows: 8, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'Netflix and chill result', answer: 'DATE', enumeration: [4], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'We need to talk', answer: 'DUMP', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Seen at 3am status', answer: 'READ', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Its complicated', answer: 'STATUS', enumeration: [6], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Red flag collection', answer: 'FLAGS', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Cuffing season goal', answer: 'PARTNER', enumeration: [7], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Situationship limbo', answer: 'GREY', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'left-down', clue: 'U up text', answer: 'LATE', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Toxic trait admission', answer: 'GUILTY', enumeration: [6], startRow: 7, startCol: 0 },
    ],
    estimatedTime: 420,
    coinReward: 45
  },
  {
    title: "Climate Anxiety",
    difficulty: Difficulty.EXPERT,
    category: "Environment",
    grid: { rows: 8, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'Paper vs plastic debate', answer: 'STRAW', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Ice caps doing this', answer: 'MELT', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Flight shame feeling', answer: 'GUILTY', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Electric car guy', answer: 'ELON', enumeration: [4], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Reusable bag forgot', answer: 'AGAIN', enumeration: [5], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Carbon foot size', answer: 'PRINT', enumeration: [5], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Meat alternative', answer: 'PLANT', enumeration: [5], startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Ozone layer hole', answer: 'GAP', enumeration: [3], startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Doomscroll topic', answer: 'NEWS', enumeration: [4], startRow: 7, startCol: 0 },
    ],
    estimatedTime: 420,
    coinReward: 45
  },
  {
    title: "AI Overlords",
    difficulty: Difficulty.EXPERT,
    category: "Technology",
    grid: { rows: 8, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'ChatGPT maker', answer: 'OPENAI', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Robot uprising fear', answer: 'SKYNET', enumeration: [6], startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'AI art controversy', answer: 'STOLEN', enumeration: [6], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Neural network brain', answer: 'MODEL', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Prompt engineering job', answer: 'NEW', enumeration: [3], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Training data debate', answer: 'ETHICS', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Deepfake concern', answer: 'FAKE', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'left-down', clue: 'Singularity timeline', answer: 'SOON', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Sentient AI claim', answer: 'ALIVE', enumeration: [5], startRow: 7, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 50
  },
  {
    title: "Adulting 101",
    difficulty: Difficulty.EXPERT,
    category: "Life Skills",
    grid: { rows: 8, cols: 9 },
    clues: [
      { number: 1, direction: 'across', clue: 'Health coverage maze', answer: 'INSURANCE', enumeration: [9], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'April deadline', answer: 'TAXES', enumeration: [5], startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Credit score obsession', answer: 'FICO', enumeration: [4], startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Retirement acronym', answer: 'FOURK', enumeration: [5], startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Budgeting app', answer: 'MINT', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Mortgage nightmare', answer: 'RATE', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Laundry mystery', answer: 'SOCK', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Grocery list forgotten', answer: 'MILK', enumeration: [4], startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Meal prep Sunday', answer: 'PREP', enumeration: [4], startRow: 7, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 50
  }
];

// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

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