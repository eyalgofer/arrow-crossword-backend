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
    title: "Coffee Addict",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Morning fuel for zombies', answer: 'COFFEE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Sugar rush delivery', answer: 'DONUT', startRow: 0, startCol: 5 },
      { number: 3, direction: 'down-across', clue: 'Alarm clock victim', answer: 'SLEEP', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Office prison', answer: 'DESK', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Monday feeling', answer: 'TIRED', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Clock watching goal', answer: 'FIVE', startRow: 4, startCol: 0 },
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Pet Chaos",
    difficulty: Difficulty.EASY,
    category: "Animals",
    grid: { rows: 5, cols: 6 },
    clues: [
      { number: 1, direction: 'across', clue: 'Barks at mailman', answer: 'DOG', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Ignores you royally', answer: 'CAT', startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Tank swimmer', answer: 'FISH', startRow: 1, startCol: 0 },
      { number: 4, direction: 'down-across', clue: 'Wheel runner', answer: 'HAMSTER', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Talks but never listens', answer: 'PARROT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'up-across', clue: 'Hops around', answer: 'BUNNY', startRow: 4, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Movie theater must-have', answer: 'POPCORN', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Dip partner', answer: 'CHIP', startRow: 0, startCol: 5 },
      { number: 3, direction: 'down-across', clue: 'Midnight fridge raid', answer: 'PIZZA', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Ice cream holder', answer: 'CONE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Chocolate bar cousin', answer: 'CANDY', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Sandwich bread', answer: 'BUN', startRow: 4, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Couch potato activity', answer: 'NAP', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Netflix partner', answer: 'CHILL', startRow: 0, startCol: 4 },
      { number: 3, direction: 'across', clue: 'Binge watching device', answer: 'TV', startRow: 1, startCol: 0 },
      { number: 4, direction: 'down-across', clue: 'Pajama zone', answer: 'BED', startRow: 2, startCol: 0 },
      { number: 5, direction: 'across', clue: 'Brunch beverage', answer: 'MIMOSA', startRow: 3, startCol: 0 },
      { number: 6, direction: 'up-across', clue: 'Zero plans', answer: 'RELAX', startRow: 4, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Happy yellow face', answer: 'SMILE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Crying with joy', answer: 'LOL', startRow: 0, startCol: 5 },
      { number: 3, direction: 'down-across', clue: 'Red beating shape', answer: 'HEART', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Thumbs gesture', answer: 'UP', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Fire indicator', answer: 'HOT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Clapping hands', answer: 'BRAVO', startRow: 4, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Could be an email', answer: 'MEETING', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Inbox nightmare', answer: 'SPAM', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Spreadsheet prison', answer: 'EXCEL', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Boss approaching sound', answer: 'PANIC', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Free food alert', answer: 'LUNCH', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Deadline feeling', answer: 'STRESS', startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Friday mood', answer: 'FREE', startRow: 5, startCol: 0 },
      { number: 8, direction: 'down', clue: 'Caffeine station', answer: 'BREAK', startRow: 0, startCol: 1 },
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
      { number: 1, direction: 'across', clue: 'Skip leg day excuse', answer: 'TIRED', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Mirror selfie spot', answer: 'GYM', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Protein shake ingredient', answer: 'WHEY', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Cardio torture device', answer: 'TREADMILL', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Gains evidence', answer: 'MUSCLE', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Post-workout pain', answer: 'SORE', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Heavy lifting item', answer: 'WEIGHT', startRow: 5, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Swipe right app', answer: 'TINDER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Awkward silence killer', answer: 'JOKE', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'First date jitters', answer: 'NERVES', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Who pays debate', answer: 'BILL', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Goodnight maybe', answer: 'KISS', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Ghosting opposite', answer: 'TEXT', startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Relationship status', answer: 'SINGLE', startRow: 5, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Double tap action', answer: 'LIKE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Viral dance platform', answer: 'TIKTOK', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Story disappears in 24h', answer: 'SNAP', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Blue bird platform', answer: 'TWITTER', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Influencer currency', answer: 'FOLLOWERS', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Pound sign trend', answer: 'HASHTAG', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Share again', answer: 'REPOST', startRow: 5, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Try again screen', answer: 'GAMEOVER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Rage quit trigger', answer: 'LAG', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'One more game lie', answer: 'LAST', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Victory royale game', answer: 'FORTNITE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Save point', answer: 'CHECKPOINT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Extra life pickup', answer: 'POWERUP', startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Final enemy', answer: 'BOSS', startRow: 5, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Smoke alarm timer', answer: 'BURNT', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Recipe ignored', answer: 'WING', startRow: 0, startCol: 6 },
      { number: 3, direction: 'down-across', clue: 'Just add water food', answer: 'RAMEN', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Delivery app backup', answer: 'UBER', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Chopping tears', answer: 'ONION', startRow: 3, startCol: 0 },
      { number: 6, direction: 'across', clue: 'Recipe says medium', answer: 'HEAT', startRow: 4, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Baking disaster', answer: 'FLAT', startRow: 5, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Avocado purchase regret', answer: 'TOAST', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Student debt feeling', answer: 'BROKE', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Adulting failure', answer: 'TAXES', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Housing market mood', answer: 'DESPAIR', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Side hustle platform', answer: 'ETSY', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Therapy topic', answer: 'ANXIETY', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Plant parent status', answer: 'DEAD', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'WiFi password ask', answer: 'FIRST', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Upside down world', answer: 'STRANGER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Korean survival game', answer: 'SQUID', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Chess prodigy show', answer: 'QUEENS', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Tiger guy documentary', answer: 'KING', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Witcher grunt', answer: 'HMM', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Heist crew city', answer: 'MONEY', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Royal drama family', answer: 'CROWN', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Still watching question', answer: 'YES', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Distracted boyfriend', answer: 'MEME', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Doge currency', answer: 'COIN', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'This is fine dog', answer: 'FIRE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Woman yelling at', answer: 'CAT', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Rickroll singer', answer: 'ASTLEY', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Trade offer format', answer: 'DEAL', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Surprised Pikachu', answer: 'FACE', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'OK boomer target', answer: 'OLD', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'We are family here', answer: 'TOXIC', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Buzzword salad', answer: 'SYNERGY', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Ping pong table workspace', answer: 'OFFICE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Move fast break things', answer: 'MOTTO', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Unlimited PTO catch', answer: 'GUILT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Equity instead of salary', answer: 'STOCK', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Hustle culture drink', answer: 'REDBULL', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Disrupt everything', answer: 'UBER', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Hi Hungry Im', answer: 'DAD', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Thermostat guardian', answer: 'FATHER', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Grill master title', answer: 'KING', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'New balance wearer', answer: 'SHOE', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Lawn obsession', answer: 'GRASS', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Pun reaction', answer: 'GROAN', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Cargo shorts feature', answer: 'POCKET', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Nap location', answer: 'COUCH', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'You are on mute', answer: 'UNMUTE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Virtual background', answer: 'BEACH', startRow: 0, startCol: 7 },
      { number: 3, direction: 'down-across', clue: 'Camera off excuse', answer: 'WIFI', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Pants optional zone', answer: 'HOME', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Can you see my screen', answer: 'SHARE', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Lets circle back', answer: 'LATER', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Cat cameo star', answer: 'PET', startRow: 5, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Meeting that could be email', answer: 'ALL', startRow: 6, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Diamond hands opposite', answer: 'PAPER', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'To the celestial body', answer: 'MOON', startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Ape together strong', answer: 'APE', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'HODL misspelling', answer: 'HOLD', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Fear uncertainty doubt', answer: 'FUD', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Satoshi creation', answer: 'BITCOIN', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'When lambo question', answer: 'SOON', startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Buy the dip action', answer: 'BUY', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Not financial advice', answer: 'DYOR', startRow: 7, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Netflix and chill result', answer: 'DATE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'We need to talk', answer: 'DUMP', startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Seen at 3am status', answer: 'READ', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Its complicated', answer: 'STATUS', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Red flag collection', answer: 'FLAGS', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Cuffing season goal', answer: 'PARTNER', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Situationship limbo', answer: 'GREY', startRow: 5, startCol: 0 },
      { number: 8, direction: 'left-down', clue: 'U up text', answer: 'LATE', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Toxic trait admission', answer: 'GUILTY', startRow: 7, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Paper vs plastic debate', answer: 'STRAW', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Ice caps doing this', answer: 'MELT', startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Flight shame feeling', answer: 'GUILTY', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Electric car guy', answer: 'ELON', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Reusable bag forgot', answer: 'AGAIN', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Carbon foot size', answer: 'PRINT', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Meat alternative', answer: 'PLANT', startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Ozone layer hole', answer: 'GAP', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Doomscroll topic', answer: 'NEWS', startRow: 7, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'ChatGPT maker', answer: 'OPENAI', startRow: 0, startCol: 0 },
      { number: 2, direction: 'right-down', clue: 'Robot uprising fear', answer: 'SKYNET', startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'AI art controversy', answer: 'STOLEN', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Neural network brain', answer: 'MODEL', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Prompt engineering job', answer: 'NEW', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Training data debate', answer: 'ETHICS', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Deepfake concern', answer: 'FAKE', startRow: 5, startCol: 0 },
      { number: 8, direction: 'left-down', clue: 'Singularity timeline', answer: 'SOON', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Sentient AI claim', answer: 'ALIVE', startRow: 7, startCol: 0 },
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
      { number: 1, direction: 'across', clue: 'Health coverage maze', answer: 'INSURANCE', startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'April deadline', answer: 'TAXES', startRow: 0, startCol: 8 },
      { number: 3, direction: 'down-across', clue: 'Credit score obsession', answer: 'FICO', startRow: 1, startCol: 0 },
      { number: 4, direction: 'across', clue: 'Retirement acronym', answer: 'FOURK', startRow: 2, startCol: 0 },
      { number: 5, direction: 'up-across', clue: 'Budgeting app', answer: 'MINT', startRow: 3, startCol: 0 },
      { number: 6, direction: 'down-across', clue: 'Mortgage nightmare', answer: 'RATE', startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Laundry mystery', answer: 'SOCK', startRow: 5, startCol: 0 },
      { number: 8, direction: 'right-down', clue: 'Grocery list forgotten', answer: 'MILK', startRow: 6, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Meal prep Sunday', answer: 'PREP', startRow: 7, startCol: 0 },
    ],
    estimatedTime: 480,
    coinReward: 50
  }
];

const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI_CLUSTER1);
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