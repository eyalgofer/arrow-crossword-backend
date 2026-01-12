import { Difficulty } from '../../types';

export const samplePuzzles = [
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
    title: "The Great Architect",
    difficulty: Difficulty.HARD,
    category: "Architecture",
    grid: { rows: 12, cols: 12 },
    clues: [
      // ROW 0 Clue Cells
      { number: 1, direction: 'right-down', clue: 'Support pillar', answer: 'COLUMN', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Top of a room', answer: 'CEILING', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Building site', answer: 'PLOT', enumeration: [4], startRow: 0, startCol: 4 },
      { number: 4, direction: 'down', clue: 'Window glass', answer: 'PANE', enumeration: [4], startRow: 0, startCol: 6 },
      
      // ROW 1 Clue Cells - Intersecting with previous
      { number: 5, direction: 'across', clue: 'Grand entrance', answer: 'PORTICO', enumeration: [7], startRow: 1, startCol: 0 },
      // (1,1)='O' from COLUMN, (1,2)='R', (1,3)='T' from PLOT, (1,4)='I', (1,5)='C', (1,6)='O'
      
      { number: 6, direction: 'across', clue: 'Curved roof', answer: 'DOME', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Stone carver', answer: 'MASON', enumeration: [5], startRow: 2, startCol: 5 },
      
      { number: 8, direction: 'up-across', clue: 'Clay block', answer: 'BRICK', enumeration: [5], startRow: 5, startCol: 1 },
      { number: 9, direction: 'across', clue: 'Metal used in beams', answer: 'STEEL', enumeration: [5], startRow: 6, startCol: 4 },
      
      { number: 10, direction: 'right-down', clue: 'Statue base', answer: 'PLINTH', enumeration: [6], startRow: 4, startCol: 8 },
      { number: 11, direction: 'left-down', clue: 'Walkway', answer: 'AISLE', enumeration: [5], startRow: 6, startCol: 11 },
      
      { number: 12, direction: 'down-across', clue: 'House front', answer: 'FACADE', enumeration: [6], startRow: 8, startCol: 0 },
      { number: 13, direction: 'across', clue: 'Spiral stairs part', answer: 'STEP', enumeration: [4], startRow: 10, startCol: 4 },
      { number: 14, direction: 'across', clue: 'Draftsman tool', answer: 'INK', enumeration: [3], startRow: 11, startCol: 8 }
    ],
    estimatedTime: 240,
    coinReward: 50
  },
  {
    title: "Deep Sea Mysteries",
    difficulty: Difficulty.MEDIUM,
    category: "Biology",
    grid: { rows: 13, cols: 13 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Largest mammal', answer: 'BLUEWHALE', enumeration: [9], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Stinging jellies', answer: 'MEDUSA', enumeration: [6], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Eight-armed', answer: 'OCTOPUS', enumeration: [7], startRow: 0, startCol: 4 },
      
      { number: 4, direction: 'across', clue: 'Light producer', answer: 'LANTERNFISH', enumeration: [11], startRow: 2, startCol: 0 },
      // Intersects at (2,1)=L from BLUEWHALE, (2,2)=A, (2,3)=N...
      
      { number: 5, direction: 'down', clue: 'Undersea hill', answer: 'RIDGE', enumeration: [5], startRow: 1, startCol: 8 },
      { number: 6, direction: 'up-across', clue: 'Ocean salt', answer: 'BRINE', enumeration: [5], startRow: 5, startCol: 1 },
      
      { number: 7, direction: 'right-down', clue: 'Shell maker', answer: 'CLAM', enumeration: [4], startRow: 4, startCol: 10 },
      { number: 8, direction: 'across', clue: 'Warm current', answer: 'GULFSTREAM', enumeration: [10], startRow: 7, startCol: 2 },
      
      { number: 9, direction: 'down-across', clue: 'Breathing organ', answer: 'GILL', enumeration: [4], startRow: 9, startCol: 0 },
      { number: 10, direction: 'down', clue: 'Deep trench', answer: 'MARIANA', enumeration: [7], startRow: 6, startCol: 5 },
      
      { number: 11, direction: 'left-down', clue: 'Bony fish', answer: 'EEL', enumeration: [3], startRow: 8, startCol: 12 },
      { number: 12, direction: 'across', clue: 'Floating plants', answer: 'ALGAE', enumeration: [5], startRow: 11, startCol: 4 }
    ],
    estimatedTime: 220,
    coinReward: 40
  },
  {
    title: "Astronomy 101",
    difficulty: Difficulty.MEDIUM,
    category: "Space",
    grid: { rows: 11, cols: 11 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Star death', answer: 'SUPERNOVA', enumeration: [9], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Our galaxy', answer: 'MILKYWAY', enumeration: [8], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Smallest planet', answer: 'MERCURY', enumeration: [7], startRow: 0, startCol: 4 },
      { number: 4, direction: 'across', clue: 'Space rock', answer: 'ASTEROID', enumeration: [8], startRow: 2, startCol: 3 },
      { number: 5, direction: 'down-across', clue: 'Saturn ring part', answer: 'DUST', enumeration: [4], startRow: 4, startCol: 0 },
      { number: 6, direction: 'up-across', clue: 'Red star', answer: 'DWARF', enumeration: [5], startRow: 6, startCol: 1 },
      { number: 7, direction: 'down', clue: 'Path around sun', answer: 'ORBIT', enumeration: [5], startRow: 5, startCol: 8 },
      { number: 8, direction: 'across', clue: 'Moon crater', answer: 'TYCHO', enumeration: [5], startRow: 8, startCol: 2 },
      { number: 9, direction: 'across', clue: 'Space depth', answer: 'VOID', enumeration: [4], startRow: 10, startCol: 6 }
    ],
    estimatedTime: 180,
    coinReward: 30
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
      { "number": 4, "direction": "across", "clue": "Deep hole", "answer": "ABYSS", "enumeration": [5], "startRow": 1, "startCol": 0 },
      { "number": 5, "direction": "down-across", "clue": "Small insect", "answer": "ANT", "enumeration": [3], "startRow": 2, "startCol": 0 },
      { "number": 6, "direction": "down", "clue": "Trial", "answer": "TEST", "enumeration": [4], "startRow": 2, "startCol": 4 },
      { "number": 7, "direction": "up-across", "clue": "Every one", "answer": "ALL", "enumeration": [3], "startRow": 4, "startCol": 1 },
      { "number": 8, "direction": "across", "clue": "Finish", "answer": "END", "enumeration": [3], "startRow": 5, "startCol": 0 },
      { "number": 9, "direction": "down-across", "clue": "Automobile", "answer": "CAR", "enumeration": [3], "startRow": 6, "startCol": 0 },
      { "number": 10, "direction": "across", "clue": "Quick sleep", "answer": "NAP", "enumeration": [3], "startRow": 7, "startCol": 1 }
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
  },
    {
      title: "Global Icons & Tech",
      difficulty: Difficulty.HARD,
      category: "Personalities",
      grid: { rows: 14, cols: 13 },
      clues: [
        { number: 1, direction: 'right-down', clue: 'Tesla and SpaceX CEO', answer: 'ELONMUSK', enumeration: [8], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Microsoft founder', answer: 'BILLGATES', enumeration: [9], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Apple visionary', answer: 'STEVEJOBS', enumeration: [9], startRow: 0, startCol: 4 },
        { number: 4, direction: 'down', clue: 'Amazon founder', answer: 'JEFFBEZOS', enumeration: [9], startRow: 0, startCol: 6 },
        { number: 5, direction: 'left-down', clue: 'Facebook creator', answer: 'ZUCKERBERG', enumeration: [10], startRow: 0, startCol: 9 },
        { number: 6, direction: 'left-down', clue: 'The Bard', answer: 'SHAKESPEARE', enumeration: [11], startRow: 0, startCol: 12 },
        { number: 7, direction: 'across', clue: 'Top Gun actor', answer: 'TOMCRUISE', enumeration: [9], startRow: 1, startCol: 0 },
        { number: 8, direction: 'across', clue: 'Frozen dessert', answer: 'ICECREAM', enumeration: [8], startRow: 3, startCol: 1 },
        { number: 9, direction: 'up-across', clue: 'Movie prize', answer: 'OSCAR', enumeration: [5], startRow: 6, startCol: 0 },
        { number: 10, direction: 'across', clue: 'Fastest man', answer: 'USAINBOLT', enumeration: [9], startRow: 5, startCol: 3 },
        { number: 11, direction: 'down-across', clue: 'Action star Chan', answer: 'JACKIE', enumeration: [6], startRow: 7, startCol: 0 },
        { number: 12, direction: 'across', clue: 'Wizarding author', answer: 'JKROWLING', enumeration: [9], startRow: 8, startCol: 2 },
        { number: 13, direction: 'up-across', clue: 'Red planet', answer: 'MARS', enumeration: [4], startRow: 11, startCol: 1 },
        { number: 14, direction: 'across', clue: 'Search engine giant', answer: 'GOOGLE', enumeration: [6], startRow: 10, startCol: 5 },
        { number: 15, direction: 'down-across', clue: 'King of Pop', answer: 'JACKSON', enumeration: [7], startRow: 12, startCol: 0 },
        { number: 16, direction: 'across', clue: 'Final part', answer: 'THEEND', enumeration: [6], startRow: 13, startCol: 6 }
      ],
      estimatedTime: 300,
      coinReward: 50
    },
    {
      title: "The Great Expedition",
      difficulty: Difficulty.HARD,
      category: "Geography & Nature",
      grid: { rows: 15, cols: 15 },
      clues: [
        { number: 1, direction: 'right-down', clue: 'Vast frozen continent', answer: 'ANTARCTICA', enumeration: [10], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Deepest ocean', answer: 'PACIFIC', enumeration: [7], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Mountain range in Europe', answer: 'THEALPS', enumeration: [7], startRow: 0, startCol: 4 },
        { number: 4, direction: 'down', clue: 'Longest river', answer: 'AMAZON', enumeration: [6], startRow: 0, startCol: 6 },
        { number: 5, direction: 'left-down', clue: 'Highest peak', answer: 'MOUNTEVEREST', enumeration: [12], startRow: 0, startCol: 8 },
        { number: 6, direction: 'down', clue: 'Egyptian river', answer: 'NILE', enumeration: [4], startRow: 0, startCol: 10 },
        { number: 7, direction: 'left-down', clue: 'The Big Apple (2 words)', answer: 'NEWYORKCITY', enumeration: [11], startRow: 0, startCol: 13 },
        { number: 8, direction: 'across', clue: 'Hot desert', answer: 'SAHARA', enumeration: [6], startRow: 1, startCol: 1 },
        { number: 9, direction: 'across', clue: 'City of Love', answer: 'PARIS', enumeration: [5], startRow: 3, startCol: 3 },
        { number: 10, direction: 'across', clue: 'Island nation', answer: 'ICELAND', enumeration: [7], startRow: 5, startCol: 0 },
        { number: 11, direction: 'up-across', clue: 'Grand Chasm', answer: 'CANYON', enumeration: [6], startRow: 8, startCol: 1 },
        { number: 12, direction: 'down-across', clue: 'Tropical forest', answer: 'JUNGLE', enumeration: [6], startRow: 9, startCol: 5 },
        { number: 13, direction: 'across', clue: 'Northern lights', answer: 'AURORA', enumeration: [6], startRow: 11, startCol: 2 },
        { number: 14, direction: 'up-across', clue: 'Great reef', answer: 'CORAL', enumeration: [5], startRow: 14, startCol: 4 },
        { number: 15, direction: 'across', clue: 'Morning moisture', answer: 'DEW', enumeration: [3], startRow: 13, startCol: 0 }
      ],
      estimatedTime: 350,
      coinReward: 60
    },
    {
      title: "Master Chefs & Flavors",
      difficulty: Difficulty.MEDIUM,
      category: "Food",
      grid: { rows: 12, cols: 12 },
      clues: [
        { number: 1, direction: 'right-down', clue: 'Angry TV chef', answer: 'RAMSAY', enumeration: [6], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Italian pie', answer: 'PIZZA', enumeration: [5], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'French fry dip', answer: 'KETCHUP', enumeration: [7], startRow: 0, startCol: 4 },
        { number: 4, direction: 'down', clue: 'Breakfast grain', answer: 'OATMEAL', enumeration: [7], startRow: 0, startCol: 6 },
        { number: 5, direction: 'left-down', clue: 'Raw fish dish', answer: 'SUSHI', enumeration: [5], startRow: 0, startCol: 8 },
        { number: 6, direction: 'left-down', clue: 'Pasta sheets', answer: 'LASAGNA', enumeration: [7], startRow: 0, startCol: 10 },
        { number: 7, direction: 'across', clue: 'Cooking professional', answer: 'CHEF', enumeration: [4], startRow: 1, startCol: 5 },
        { number: 8, direction: 'up-across', clue: 'Morning drink', answer: 'COFFEE', enumeration: [6], startRow: 4, startCol: 1 },
        { number: 9, direction: 'down-across', clue: 'Barbecue meat', answer: 'STEAK', enumeration: [5], startRow: 5, startCol: 0 },
        { number: 10, direction: 'across', clue: 'Milk product', answer: 'CHEESE', enumeration: [6], startRow: 7, startCol: 3 },
        { number: 11, direction: 'up-across', clue: 'Boiling vapor', answer: 'STEAM', enumeration: [5], startRow: 10, startCol: 2 },
        { number: 12, direction: 'across', clue: 'Pungent bulb', answer: 'GARLIC', enumeration: [6], startRow: 11, startCol: 5 }
      ],
      estimatedTime: 200,
      coinReward: 30
    },
    {
      title: "Musical Masterminds",
      difficulty: Difficulty.HARD,
      category: "Music",
      grid: { rows: 13, cols: 13 },
      clues: [
        { number: 1, direction: 'right-down', clue: 'Queen frontman', answer: 'MERCURY', enumeration: [7], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Like a Virgin singer', answer: 'MADONNA', enumeration: [7], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'The Piano Man', answer: 'BILLYJOEL', enumeration: [9], startRow: 0, startCol: 5 },
        { number: 4, direction: 'down', clue: 'Purple Rain artist', answer: 'PRINCE', enumeration: [6], startRow: 0, startCol: 7 },
        { number: 5, direction: 'left-down', clue: 'Thriller album creator', answer: 'JACKSON', enumeration: [7], startRow: 0, startCol: 10 },
        { number: 6, direction: 'left-down', clue: 'Rolling Stones lead', answer: 'JAGGER', enumeration: [6], startRow: 0, startCol: 12 },
        { number: 7, direction: 'across', clue: 'Fab Four band', answer: 'BEATLES', enumeration: [7], startRow: 2, startCol: 3 },
        { number: 8, direction: 'up-across', clue: 'Electric instrument', answer: 'GUITAR', enumeration: [6], startRow: 5, startCol: 0 },
        { number: 9, direction: 'down-across', clue: 'Group of eight', answer: 'OCTET', enumeration: [5], startRow: 6, startCol: 1 },
        { number: 10, direction: 'across', clue: 'Reggae legend Marley', answer: 'BOB', enumeration: [3], startRow: 4, startCol: 8 },
        { number: 11, direction: 'down-across', clue: 'Classical genius', answer: 'MOZART', enumeration: [6], startRow: 8, startCol: 3 },
        { number: 12, direction: 'up-across', clue: 'Soul diva Franklin', answer: 'ARETHA', enumeration: [6], startRow: 11, startCol: 4 },
        { number: 13, direction: 'across', clue: 'High singing voice', answer: 'SOPRANO', enumeration: [7], startRow: 12, startCol: 0 }
      ],
      estimatedTime: 280,
      coinReward: 45
    },
    {
      title: "Olympic Legends",
      difficulty: Difficulty.MEDIUM,
      category: "Sports",
      grid: { rows: 12, cols: 12 },
      clues: [
        { number: 1, direction: 'right-down', clue: 'Swimmer with most medals', answer: 'PHELPS', enumeration: [6], startRow: 0, startCol: 0 },
        { number: 2, direction: 'down', clue: 'Tennis pro Roger', answer: 'FEDERER', enumeration: [7], startRow: 0, startCol: 2 },
        { number: 3, direction: 'left-down', clue: 'Fastest runner Bolt', answer: 'USAIN', enumeration: [5], startRow: 0, startCol: 4 },
        { number: 4, direction: 'down', clue: 'Soccer star Messi', answer: 'LIONEL', enumeration: [6], startRow: 0, startCol: 6 },
        { number: 5, direction: 'left-down', clue: 'Gymnast Biles', answer: 'SIMONE', enumeration: [6], startRow: 0, startCol: 8 },
        { number: 6, direction: 'left-down', clue: 'Basketball GOAT', answer: 'JORDAN', enumeration: [6], startRow: 0, startCol: 11 },
        { number: 7, direction: 'across', clue: 'Victory award', answer: 'GOLDMEDAL', enumeration: [9], startRow: 3, startCol: 1 },
        { number: 8, direction: 'up-across', clue: 'Team leader', answer: 'COACH', enumeration: [5], startRow: 6, startCol: 0 },
        { number: 9, direction: 'down-across', clue: 'Boxing great', answer: 'ALI', enumeration: [3], startRow: 7, startCol: 2 },
        { number: 10, direction: 'across', clue: 'Pool length', answer: 'LAP', enumeration: [3], startRow: 5, startCol: 8 },
        { number: 11, direction: 'up-across', clue: 'Winter sliding sport', answer: 'LUGE', enumeration: [4], startRow: 10, startCol: 4 },
        { number: 12, direction: 'across', clue: 'Game result', answer: 'SCORE', enumeration: [5], startRow: 11, startCol: 0 }
      ],
      estimatedTime: 220,
      coinReward: 35
    },
    {
      title: "Modern Icons",
      difficulty: Difficulty.HARD,
      category: "General Knowledge",
      grid: { rows: 13, cols: 11 },
      clues: [
        // right-down: Clue(0,0), Answer starts (0,1), goes DOWN
        { number: 1, direction: 'right-down', clue: 'Tesla CEO', answer: 'ELONMUSK', enumeration: [4, 4], startRow: 0, startCol: 0 },
        // down: Clue(0,2), Answer starts (1,2), goes DOWN
        { number: 2, direction: 'down', clue: 'Amazon founder', answer: 'JEFFBEZOS', enumeration: [4, 5], startRow: 0, startCol: 2 },
        // left-down: Clue(0,4), Answer starts (0,3), goes DOWN
        { number: 3, direction: 'left-down', clue: 'Microsoft founder', answer: 'BILLGATES', enumeration: [4, 5], startRow: 0, startCol: 4 },
        // left-down: Clue(0,6), Answer starts (0,5), goes DOWN
        { number: 4, direction: 'left-down', clue: 'Action star Chan', answer: 'JACKIECHAN', enumeration: [6, 4], startRow: 0, startCol: 6 },
        // across: Clue(1,3), Answer starts (1,4), goes RIGHT (Intersects JEFFBEZOS 'E' at 1,2? No, JEFF starts at 1,2)
        // Let's place an across that intersects the verticals:
        // Row 2 Across: Intersects ELON(L at 2,1), JEFF(F at 2,2), BILL(L at 2,3), JACKIE(C at 2,5)
        { number: 5, direction: 'across', clue: 'Inflexible', answer: 'RIGID', enumeration: [5], startRow: 2, startCol: 6 },
        
        // up-across: Clue(5,0), Answer starts (4,0), goes RIGHT
        { number: 6, direction: 'up-across', clue: 'Apple visionary', answer: 'STEVEJOBS', enumeration: [5, 4], startRow: 5, startCol: 0 },
        
        // across: Clue(6,1), Answer starts (6,2), goes RIGHT
        { number: 7, direction: 'across', clue: 'Wizarding author', answer: 'JKROWLING', enumeration: [2, 7], startRow: 6, startCol: 1 },
        
        // down-across: Clue(7,0), Answer starts (8,0), goes RIGHT
        { number: 8, direction: 'down-across', clue: 'Frozen dessert', answer: 'ICECREAM', enumeration: [3, 5], startRow: 7, startCol: 0 },
        
        // down: Clue(5,4), Answer starts (6,4), goes DOWN
        { number: 9, direction: 'down', clue: 'Egyptian tomb', answer: 'PYRAMID', enumeration: [7], startRow: 5, startCol: 4 },
        
        // across: Clue(9,2), Answer starts (9,3), goes RIGHT
        { number: 10, direction: 'across', clue: 'Morning meal', answer: 'BREAKFAST', enumeration: [9], startRow: 9, startCol: 2 },
        
        // up-across: Clue(12,1), Answer starts (11,1), goes RIGHT
        { number: 11, direction: 'up-across', clue: 'Top Gun star', answer: 'TOMCRUISE', enumeration: [3, 6], startRow: 12, startCol: 1 },
        
        // across: Clue(12,4), Answer starts (12,5), goes RIGHT
        { number: 12, direction: 'across', clue: 'End of story', answer: 'THEEND', enumeration: [3, 3], startRow: 12, startCol: 4 }
      ],
      estimatedTime: 240,
      coinReward: 50
    }
];