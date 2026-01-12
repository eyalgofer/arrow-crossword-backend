/**
 * Swedish Arrow Crossword Puzzle Generator
 * Main entry point for generating puzzles at scale
 */

import { Difficulty } from '../../types';
import {
  Puzzle,
  Clue,
  Direction,
  GridTemplate,
} from '../core/types';

import {
  createTemplateFromPuzzle,
  solveGrid,
  buildCrossingIndex,
  CrossingIndex,
  GridState,
  generatePuzzleFromGrid,
  ClueDatabase,
} from './grid-generator';

// ============================================================================
// SIMPLE CLUE DATABASE
// ============================================================================

const CLUES: Record<string, string[]> = {
  // Common 3-letter words
  'SEE': ['Ensure', 'View', 'Observe', 'Witness'],
  'THE': ['Definite article', 'Common article'],
  'AND': ['Plus', 'Together with', 'As well as'],
  'FOR': ['In favor of', 'Because of'],
  'CAT': ['Feline', 'Pet that purrs', 'Meowing animal'],
  'DOG': ['Canine', 'Man\'s best friend'],
  'SUN': ['Star', 'Daylight source'],
  'SEA': ['Ocean', 'Large body of water'],
  'AIR': ['Atmosphere', 'Breathable gas'],
  'DAY': ['24 hours', 'Opposite of night'],
  'OLD': ['Aged', 'Not new', 'Elderly'],
  'NEW': ['Fresh', 'Recently made'],
  'BIG': ['Large', 'Huge', 'Sizable'],
  'RUN': ['Sprint', 'Jog', 'Operate'],
  'EAT': ['Consume food', 'Dine'],
  'OUR': ['Belonging to us', 'Possessive pronoun'],
  'POT': ['Container', 'Kitchen container'],
  'CUP': ['Drinking vessel', 'Mug'],
  'ELF': ['Fairy', 'Mythical creature'],
  'NAG': ['Pester', 'Complain repeatedly'],
  'GUM': ['Chewing candy', 'Adhesive'],
  
  // Common 4-letter words
  'TANK': ['Large basin', 'Container', 'Military vehicle'],
  'MINI': ['Small', 'Short skirt', 'Compact'],
  'IDLE': ['Lazy', 'Inactive', 'Unemployed'],
  'LEND': ['Loan', 'Give temporarily'],
  'RAGE': ['Fury', 'Anger', 'Wrath'],
  'FEEL': ['Touch', 'Sense', 'Experience'],
  'USER': ['Operator', 'Consumer'],
  'POET': ['Bard', 'Verse writer'],
  'TREE': ['Woody plant', 'Forest member'],
  'ITEM': ['Unit', 'Object', 'Article'],
  'FILE': ['Document', 'Stores', 'Tool'],
  'BETA': ['Second Greek letter', 'Test version'],
  'DATA': ['Information', 'Facts'],
  'CODE': ['Program', 'Cipher'],
  'MENU': ['Food list', 'Options'],
  'LINK': ['Connection', 'URL'],
  'ICON': ['Symbol', 'Image'],
  'AREA': ['Region', 'Space', 'Zone'],
  'FORM': ['Shape', 'Document'],
  'PLAN': ['Scheme', 'Strategy'],
  'GOAL': ['Aim', 'Objective'],
  'EDGE': ['Border', 'Brink'],
  'LINE': ['Row', 'Queue'],
  'MODE': ['Style', 'Method'],
  'PATH': ['Way', 'Route'],
  'ROLE': ['Part', 'Function'],
  'SITE': ['Location', 'Website'],
  'SIZE': ['Dimension', 'Scale'],
  'STEP': ['Stride', 'Stage'],
  'TEST': ['Exam', 'Trial'],
  'TIME': ['Duration', 'Moment'],
  'TYPE': ['Kind', 'Sort'],
  'VIEW': ['Opinion', 'Sight'],
  'ZONE': ['Area', 'Region'],
  
  // Common 5-letter words  
  'ABOUT': ['Approximately', 'Concerning'],
  'AFTER': ['Following', 'Later than'],
  'AGAIN': ['Once more', 'Anew'],
  'FIRST': ['Initial', 'Primary'],
  'FOUND': ['Discovered', 'Located'],
  'GREAT': ['Excellent', 'Large'],
  'HOUSE': ['Dwelling', 'Home'],
  'LARGE': ['Big', 'Huge'],
  'LEARN': ['Study', 'Discover'],
  'NEVER': ['At no time', 'Not ever'],
  'OTHER': ['Different', 'Alternative'],
  'PLACE': ['Location', 'Area'],
  'PLANT': ['Flora', 'Vegetation'],
  'POINT': ['Tip', 'Score'],
  'RIGHT': ['Correct', 'Direction'],
  'SMALL': ['Little', 'Tiny'],
  'SOUND': ['Noise', 'Audio'],
  'SPELL': ['Magic', 'Write letters'],
  'STILL': ['Motionless', 'Yet'],
  'STUDY': ['Learn', 'Research'],
  'THEIR': ['Belonging to them'],
  'THERE': ['That place', 'In that spot'],
  'THESE': ['These ones', 'Current'],
  'THING': ['Object', 'Item'],
  'THINK': ['Consider', 'Believe'],
  'THREE': ['Number after two', 'Trio'],
  'UNDER': ['Below', 'Beneath'],
  'WATER': ['H2O', 'Liquid'],
  'WHERE': ['What place', 'Location query'],
  'WHICH': ['What one', 'Selection'],
  'WHILE': ['During', 'Time period'],
  'WORLD': ['Earth', 'Globe'],
  'WOULD': ['Past of will', 'Conditional'],
  'WRITE': ['Compose', 'Author'],
  'YOUNG': ['Not old', 'Youthful'],
  'ITEMS': ['Units', 'Objects', 'Articles'],
  'INFER': ['Deduce', 'Conclude', 'Derive'],
  
  // Common 6-letter words
  'ASSUME': ['Take for granted', 'Presume', 'Suppose'],
  'ALLEGE': ['Assert', 'Claim', 'Declare'],
  'ENOUGH': ['Sufficient', 'Adequate', 'Plenty'],
  'ACROSS': ['Over', 'Horizontally'],
  'ACTION': ['Activity', 'Movement'],
  'ADVICE': ['Guidance', 'Counsel'],
  'AFRAID': ['Scared', 'Fearful'],
  'ALMOST': ['Nearly', 'About'],
  'ALWAYS': ['Forever', 'Constantly'],
  'AMOUNT': ['Quantity', 'Sum'],
  'ANIMAL': ['Creature', 'Beast'],
  'ANSWER': ['Reply', 'Response'],
  'ANYONE': ['Anybody', 'Someone'],
  'APPEAR': ['Show', 'Seem'],
  'AROUND': ['About', 'Nearby'],
  'ARTIST': ['Painter', 'Creator'],
  'ATTACK': ['Assault', 'Strike'],
  'AUTHOR': ['Writer', 'Creator'],
  'BATTLE': ['Fight', 'Combat'],
  'BEAUTY': ['Loveliness', 'Grace'],
  'BECOME': ['Turn into', 'Transform'],
  'BEFORE': ['Prior to', 'Earlier'],
  'BEHIND': ['After', 'In back of'],
  'BELONG': ['Fit', 'Be part of'],
  'BETTER': ['Superior', 'Improved'],
  'BEYOND': ['Past', 'Further'],
  'BOTTLE': ['Container', 'Flask'],
  'BOTTOM': ['Base', 'Lowest point'],
  'BRANCH': ['Limb', 'Division'],
  'BRIDGE': ['Span', 'Connection'],
  'BRIGHT': ['Brilliant', 'Shiny'],
  'BROKEN': ['Damaged', 'Not working'],
  'BUDGET': ['Plan', 'Allowance'],
  'BUTTON': ['Fastener', 'Switch'],
  'CAMERA': ['Device', 'Photo tool'],
  'CANCEL': ['Call off', 'Annul'],
  'CAREER': ['Profession', 'Job'],
  'CASTLE': ['Fortress', 'Palace'],
  'CENTER': ['Middle', 'Core'],
  'CHANCE': ['Opportunity', 'Luck'],
  'CHANGE': ['Alter', 'Modify'],
  'CHOICE': ['Option', 'Selection'],
  'CHOOSE': ['Select', 'Pick'],
  'CHURCH': ['Chapel', 'Temple'],
  'CIRCLE': ['Round shape', 'Ring'],
  'CLIENT': ['Customer', 'Patron'],
  'CLOSED': ['Shut', 'Sealed'],
  'COFFEE': ['Beverage', 'Joe'],
  'COLUMN': ['Pillar', 'Article'],
  'COMING': ['Approaching', 'Arriving'],
  'COMMON': ['Usual', 'Ordinary'],
  'CORNER': ['Angle', 'Nook'],
  'COTTON': ['Fabric', 'Plant fiber'],
  'COUNTY': ['Region', 'District'],
  'COUPLE': ['Pair', 'Two'],
  'COURSE': ['Path', 'Class'],
  'CREATE': ['Make', 'Produce'],
  'CREDIT': ['Recognition', 'Loan'],
  'DANGER': ['Risk', 'Hazard'],
  'DECIDE': ['Choose', 'Determine'],
  'DEMAND': ['Request', 'Require'],
  'DESIGN': ['Plan', 'Pattern'],
  'DETAIL': ['Particular', 'Feature'],
  'DEVICE': ['Tool', 'Gadget'],
  'DINNER': ['Meal', 'Supper'],
  'DIRECT': ['Straight', 'Guide'],
  'DOCTOR': ['Physician', 'MD'],
  'DOLLAR': ['Buck', 'Currency'],
  'DOUBLE': ['Twice', 'Dual'],
  'DRAGON': ['Mythical beast', 'Fire-breather'],
  'DURING': ['While', 'Throughout'],
  'EASILY': ['Simply', 'Readily'],
  'EDITOR': ['Publisher', 'Reviser'],
  'EFFECT': ['Result', 'Impact'],
  'EFFORT': ['Attempt', 'Work'],
  'EITHER': ['One or other', 'Both'],
  'ENABLE': ['Allow', 'Permit'],
  'ENDING': ['Conclusion', 'Finish'],
  'ENERGY': ['Power', 'Vigor'],
  'ENGINE': ['Motor', 'Machine'],
  'ENSURE': ['Guarantee', 'Make sure'],
  'ENTIRE': ['Whole', 'Complete'],
  'ESCAPE': ['Flee', 'Get away'],
  'EXPECT': ['Anticipate', 'Await'],
  'EXPERT': ['Specialist', 'Master'],
  'EXTEND': ['Stretch', 'Lengthen'],
  'FABRIC': ['Cloth', 'Material'],
  'FAMILY': ['Relatives', 'Household'],
  'FAMOUS': ['Well-known', 'Celebrated'],
  'FATHER': ['Dad', 'Parent'],
  'FIGURE': ['Number', 'Shape'],
  'FILTER': ['Screen', 'Strain'],
  'FINGER': ['Digit', 'Point'],
  'FINISH': ['End', 'Complete'],
  'FLIGHT': ['Journey', 'Aviation'],
  'FLOWER': ['Bloom', 'Blossom'],
  'FOLDER': ['File', 'Directory'],
  'FOLLOW': ['Chase', 'Pursue'],
  'FOREST': ['Woods', 'Jungle'],
  'FORGET': ['Fail to remember', 'Overlook'],
  'FORMAT': ['Layout', 'Structure'],
  'FORMER': ['Previous', 'Past'],
  'FRIEND': ['Pal', 'Buddy'],
  'FROZEN': ['Iced', 'Cold'],
  'FUTURE': ['Tomorrow', 'Ahead'],
  'GARDEN': ['Yard', 'Plot'],
  'GATHER': ['Collect', 'Assemble'],
  'GENTLE': ['Soft', 'Mild'],
  'GLOBAL': ['Worldwide', 'International'],
  'GOLDEN': ['Gold-colored', 'Precious'],
  'GROWTH': ['Development', 'Increase'],
  'GUITAR': ['Instrument', 'Musical'],
  'HANDLE': ['Grip', 'Manage'],
  'HAPPEN': ['Occur', 'Take place'],
  'HARDLY': ['Barely', 'Scarcely'],
  'HEALTH': ['Wellness', 'Fitness'],
  'HEIGHT': ['Altitude', 'Stature'],
  'HIDDEN': ['Concealed', 'Secret'],
  'HONEST': ['Truthful', 'Sincere'],
  'HUNGRY': ['Starving', 'Famished'],
  'IGNORE': ['Disregard', 'Overlook'],
  'IMPACT': ['Effect', 'Influence'],
  'INCOME': ['Earnings', 'Revenue'],
  'INDEED': ['Really', 'Truly'],
  'INJURY': ['Wound', 'Harm'],
  'INSECT': ['Bug', 'Six-legged'],
  'INSIDE': ['Within', 'Interior'],
  'INTEND': ['Plan', 'Mean to'],
  'INVEST': ['Put money', 'Finance'],
  'ISLAND': ['Isle', 'Land mass'],
  'ITSELF': ['The thing', 'Self'],
  'JACKET': ['Coat', 'Blazer'],
  'KNIGHT': ['Sir', 'Chess piece'],
  'LADDER': ['Steps', 'Rungs'],
  'LAPTOP': ['Computer', 'Notebook'],
  'LATELY': ['Recently', 'Of late'],
  'LAUNCH': ['Start', 'Release'],
  'LAWYER': ['Attorney', 'Counsel'],
  'LEADER': ['Chief', 'Head'],
  'LEAGUE': ['Association', 'Group'],
  'LENGTH': ['Distance', 'Duration'],
  'LESSON': ['Class', 'Teaching'],
  'LETTER': ['Mail', 'Character'],
  'LIKELY': ['Probable', 'Expected'],
  'LIQUID': ['Fluid', 'Watery'],
  'LISTEN': ['Hear', 'Pay attention'],
  'LITTLE': ['Small', 'Tiny'],
  'LIVELY': ['Energetic', 'Animated'],
  'LIVING': ['Alive', 'Existing'],
  'LOCATE': ['Find', 'Position'],
  'LONELY': ['Alone', 'Solitary'],
  'LONGER': ['Extended', 'More time'],
  'LOVELY': ['Beautiful', 'Charming'],
  'MAINLY': ['Primarily', 'Mostly'],
  'MAKING': ['Creating', 'Building'],
  'MANAGE': ['Handle', 'Control'],
  'MANNER': ['Way', 'Style'],
  'MARKET': ['Bazaar', 'Trade'],
  'MASTER': ['Expert', 'Control'],
  'MATTER': ['Issue', 'Concern'],
  'MEDIUM': ['Middle', 'Average'],
  'MEMBER': ['Part', 'Associate'],
  'MEMORY': ['Recall', 'RAM'],
  'MENTAL': ['Mind', 'Psychological'],
  'METHOD': ['Way', 'System'],
  'MIDDLE': ['Center', 'Midpoint'],
  'MINUTE': ['60 seconds', 'Tiny'],
  'MIRROR': ['Reflection', 'Glass'],
  'MOBILE': ['Moving', 'Phone'],
  'MODERN': ['Current', 'New'],
  'MOMENT': ['Instant', 'Second'],
  'MONKEY': ['Primate', 'Ape'],
  'MOSTLY': ['Mainly', 'Generally'],
  'MOTHER': ['Mom', 'Parent'],
  'MOTION': ['Movement', 'Action'],
  'MOVING': ['Relocating', 'Touching'],
  'MURDER': ['Kill', 'Homicide'],
  'MUSCLE': ['Tissue', 'Strength'],
  'MUSEUM': ['Gallery', 'Exhibition'],
  'MYSELF': ['Me', 'Self'],
  'NARROW': ['Thin', 'Slim'],
  'NATION': ['Country', 'State'],
  'NATIVE': ['Local', 'Indigenous'],
  'NATURE': ['Environment', 'Outdoors'],
  'NEARBY': ['Close', 'Adjacent'],
  'NEARLY': ['Almost', 'Virtually'],
  'NEEDLE': ['Sewing tool', 'Sharp'],
  'NOBODY': ['No one', 'None'],
  'NORMAL': ['Usual', 'Standard'],
  'NOTICE': ['See', 'Announcement'],
  'NUMBER': ['Figure', 'Amount'],
  'OBTAIN': ['Get', 'Acquire'],
  'OFFICE': ['Workplace', 'Bureau'],
  'ONLINE': ['Internet', 'Connected'],
  'OPTION': ['Choice', 'Alternative'],
  'ORANGE': ['Color', 'Citrus'],
  'ORIGIN': ['Source', 'Beginning'],
  'OUTPUT': ['Production', 'Result'],
  'OXYGEN': ['O2', 'Air'],
  'PALACE': ['Royal home', 'Castle'],
  'PARENT': ['Guardian', 'Source'],
  'PARTLY': ['Partially', 'In part'],
  'PEOPLE': ['Persons', 'Humans'],
  'PERIOD': ['Time', 'Era'],
  'PERMIT': ['Allow', 'License'],
  'PERSON': ['Individual', 'Human'],
  'PHRASE': ['Expression', 'Saying'],
  'PLANET': ['World', 'Earth'],
  'PLAYER': ['Participant', 'Athlete'],
  'PLEASE': ['Satisfy', 'Kindly'],
  'PLENTY': ['Enough', 'Abundance'],
  'POCKET': ['Pouch', 'Bag'],
  'POETRY': ['Verse', 'Poems'],
  'POLICE': ['Cops', 'Officers'],
  'POLICY': ['Rule', 'Guidelines'],
  'POSTER': ['Sign', 'Display'],
  'POTATO': ['Spud', 'Tuber'],
  'POWDER': ['Dust', 'Fine particles'],
  'PRAYER': ['Worship', 'Request'],
  'PREFER': ['Favor', 'Like better'],
  'PRETTY': ['Beautiful', 'Fairly'],
  'PRINCE': ['Royal son', 'Heir'],
  'PRISON': ['Jail', 'Cell'],
  'PROFIT': ['Gain', 'Earnings'],
  'PROPER': ['Correct', 'Appropriate'],
  'PUBLIC': ['Open', 'Common'],
  'PUZZLE': ['Riddle', 'Game'],
  'RABBIT': ['Bunny', 'Hare'],
  'RANDOM': ['Arbitrary', 'Chance'],
  'RARELY': ['Seldom', 'Infrequently'],
  'RATHER': ['Somewhat', 'Instead'],
  'READER': ['Bookworm', 'Viewer'],
  'REALLY': ['Truly', 'Actually'],
  'REASON': ['Cause', 'Logic'],
  'RECALL': ['Remember', 'Recollect'],
  'RECENT': ['New', 'Latest'],
  'RECORD': ['Log', 'Album'],
  'REDUCE': ['Lessen', 'Decrease'],
  'REFUSE': ['Decline', 'Reject'],
  'REGION': ['Area', 'Zone'],
  'REJECT': ['Refuse', 'Deny'],
  'RELATE': ['Connect', 'Tell'],
  'RELIEF': ['Comfort', 'Aid'],
  'REMAIN': ['Stay', 'Continue'],
  'REMIND': ['Prompt', 'Jog memory'],
  'REMOTE': ['Distant', 'Far'],
  'REMOVE': ['Take away', 'Delete'],
  'REPAIR': ['Fix', 'Mend'],
  'REPEAT': ['Redo', 'Say again'],
  'REPORT': ['Account', 'News'],
  'RESCUE': ['Save', 'Free'],
  'RESIST': ['Oppose', 'Fight'],
  'RESORT': ['Hotel', 'Retreat'],
  'RESULT': ['Outcome', 'Effect'],
  'RETURN': ['Come back', 'Give back'],
  'REVEAL': ['Show', 'Disclose'],
  'REVIEW': ['Examine', 'Critique'],
  'REWARD': ['Prize', 'Recognition'],
  'RIDING': ['Traveling', 'Cycling'],
  'RISING': ['Ascending', 'Growing'],
  'ROCKET': ['Missile', 'Spacecraft'],
  'RUNNER': ['Jogger', 'Racer'],
  'SAFETY': ['Security', 'Protection'],
  'SALARY': ['Pay', 'Wages'],
  'SAMPLE': ['Example', 'Specimen'],
  'SAVING': ['Keeping', 'Economizing'],
  'SAYING': ['Expression', 'Quote'],
  'SCHOOL': ['Education', 'Academy'],
  'SCREEN': ['Display', 'Monitor'],
  'SCRIPT': ['Text', 'Screenplay'],
  'SEARCH': ['Look for', 'Seek'],
  'SEASON': ['Time of year', 'Period'],
  'SECOND': ['2nd', 'Moment'],
  'SECRET': ['Hidden', 'Private'],
  'SECURE': ['Safe', 'Protected'],
  'SELECT': ['Choose', 'Pick'],
  'SELLER': ['Vendor', 'Merchant'],
  'SENIOR': ['Elder', 'Higher rank'],
  'SERIES': ['Sequence', 'Set'],
  'SERVER': ['Waiter', 'Computer'],
  'SETTLE': ['Resolve', 'Establish'],
  'SEVERE': ['Harsh', 'Serious'],
  'SHADOW': ['Shade', 'Darkness'],
  'SHOULD': ['Ought to', 'Must'],
  'SIGNAL': ['Sign', 'Indicator'],
  'SILENT': ['Quiet', 'Mute'],
  'SILVER': ['Metal', 'Gray'],
  'SIMPLE': ['Easy', 'Basic'],
  'SIMPLY': ['Just', 'Merely'],
  'SINGER': ['Vocalist', 'Artist'],
  'SINGLE': ['One', 'Alone'],
  'SISTER': ['Sibling', 'Nun'],
  'SLIGHT': ['Small', 'Minor'],
  'SMOOTH': ['Even', 'Sleek'],
  'SOCIAL': ['Public', 'Community'],
  'SOLELY': ['Only', 'Exclusively'],
  'SOLVED': ['Fixed', 'Resolved'],
  'SOURCE': ['Origin', 'Supply'],
  'SPEECH': ['Talk', 'Address'],
  'SPIDER': ['Arachnid', 'Web maker'],
  'SPIRIT': ['Soul', 'Ghost'],
  'SPOKEN': ['Said', 'Verbal'],
  'SPREAD': ['Expand', 'Scatter'],
  'SPRING': ['Season', 'Jump'],
  'SQUARE': ['Shape', 'Plaza'],
  'STABLE': ['Steady', 'Barn'],
  'STATUS': ['State', 'Position'],
  'STEADY': ['Stable', 'Constant'],
  'STOLEN': ['Taken', 'Robbed'],
  'STORED': ['Kept', 'Saved'],
  'STRAIN': ['Stress', 'Filter'],
  'STREAM': ['Flow', 'River'],
  'STREET': ['Road', 'Avenue'],
  'STRESS': ['Pressure', 'Emphasis'],
  'STRICT': ['Stern', 'Rigid'],
  'STRIKE': ['Hit', 'Walkout'],
  'STRING': ['Cord', 'Sequence'],
  'STRONG': ['Powerful', 'Sturdy'],
  'STUDIO': ['Workshop', 'Room'],
  'SUBMIT': ['Send', 'Yield'],
  'SUBURB': ['Outskirt', 'Area'],
  'SUDDEN': ['Abrupt', 'Quick'],
  'SUFFER': ['Endure', 'Hurt'],
  'SUMMER': ['Season', 'Warm'],
  'SUNDAY': ['Day', 'Weekend'],
  'SUPPLY': ['Provide', 'Stock'],
  'SURELY': ['Certainly', 'Definitely'],
  'SURVEY': ['Poll', 'Examine'],
  'SWITCH': ['Change', 'Toggle'],
  'SYMBOL': ['Sign', 'Mark'],
  'SYSTEM': ['Method', 'Network'],
  'TAKING': ['Getting', 'Accepting'],
  'TALENT': ['Skill', 'Gift'],
  'TARGET': ['Goal', 'Aim'],
  'TEMPLE': ['Shrine', 'Church'],
  'TENANT': ['Renter', 'Occupant'],
  'THEORY': ['Idea', 'Hypothesis'],
  'THREAD': ['String', 'Topic'],
  'THREAT': ['Danger', 'Menace'],
  'THRONE': ['Seat', 'Power'],
  'TICKET': ['Pass', 'Fine'],
  'TIMBER': ['Wood', 'Lumber'],
  'TISSUE': ['Paper', 'Cell'],
  'TOILET': ['Bathroom', 'WC'],
  'TONGUE': ['Muscle', 'Language'],
  'TOWARD': ['To', 'Near'],
  'TRAVEL': ['Journey', 'Trip'],
  'TREATY': ['Agreement', 'Pact'],
  'TRENDS': ['Patterns', 'Fashions'],
  'TRIBAL': ['Clan', 'Native'],
  'TROOPS': ['Soldiers', 'Forces'],
  'UNIQUE': ['One of a kind', 'Special'],
  'UNLIKE': ['Different', 'Dissimilar'],
  'UPDATE': ['Refresh', 'Revise'],
  'UPWARD': ['Up', 'Rising'],
  'URGENT': ['Pressing', 'Critical'],
  'USEFUL': ['Helpful', 'Practical'],
  'VALLEY': ['Dale', 'Basin'],
  'VERSUS': ['Against', 'Vs'],
  'VICTIM': ['Casualty', 'Target'],
  'VIRTUE': ['Goodness', 'Merit'],
  'VISION': ['Sight', 'Dream'],
  'VISUAL': ['Seen', 'Optical'],
  'VOLUME': ['Amount', 'Book'],
  'VOTING': ['Ballot', 'Election'],
  'WALKER': ['Hiker', 'Pedestrian'],
  'WALLET': ['Billfold', 'Purse'],
  'WANTED': ['Desired', 'Sought'],
  'WARMTH': ['Heat', 'Comfort'],
  'WEALTH': ['Riches', 'Fortune'],
  'WEAPON': ['Arm', 'Gun'],
  'WEEKLY': ['Every week', 'Regular'],
  'WEIGHT': ['Mass', 'Heavy'],
  'WINTER': ['Season', 'Cold'],
  'WITHIN': ['Inside', 'In'],
  'WONDER': ['Marvel', 'Ask'],
  'WOODEN': ['Wood', 'Timber'],
  'WORKER': ['Employee', 'Laborer'],
  'WORTHY': ['Deserving', 'Valuable'],
  'WRITER': ['Author', 'Scribe'],
  'YELLOW': ['Color', 'Cowardly'],
  
  // 7-letter words
  'REGULAR': ['Usual', 'Normal', 'Standard'],
  'EPISODE': ['Incident', 'Chapter', 'Event'],
  'EPISODES': ['Incidents', 'Chapters', 'Events'],
  'PERSONAL': ['Private', 'Individual', 'Own'],
  
};

/**
 * Get a clue for a word
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY): string {
  const clues = CLUES[word.toUpperCase()];
  if (clues && clues.length > 0) {
    // Pick a random clue from available options
    return clues[Math.floor(Math.random() * clues.length)];
  }
  // Fallback
  return `[${word}]`;
}

// ============================================================================
// WORD LIST FOR GENERATION
// ============================================================================

const WORD_LIST: string[] = [
  // 2-letter
  'AT', 'AN', 'AS', 'AM', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
  
  // 3-letter
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
  'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS',
  'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO',
  'CAT', 'DOG', 'SUN', 'SEA', 'AIR', 'ICE', 'OAK', 'CAR', 'BUS', 'CUP',
  'POT', 'PAN', 'JAR', 'MUG', 'LID', 'BED', 'RUG', 'MAT', 'HAT', 'CAP',
  'TIE', 'AGE', 'ERA', 'JOB', 'PAY', 'ART', 'ACT', 'WAR', 'LAW', 'MAP',
  'BAY', 'RUN', 'EAT', 'SAY', 'SET', 'PUT', 'TRY', 'ASK', 'USE', 'ADD',
  'CUT', 'SIT', 'WIN', 'FLY', 'BUY', 'HIT', 'LAY', 'MIX', 'ROW', 'TAP',
  'TIP', 'WAX', 'NAG', 'RED', 'BAD', 'SAD', 'MAD', 'WET', 'DRY', 'RAW',
  'ODD', 'FIT', 'SHY', 'ORE', 'OAR', 'OWE', 'OWN', 'APE', 'APT', 'ARC',
  'ARK', 'ARM', 'ATE', 'AWE', 'AXE', 'EAR', 'EEL', 'EGG', 'EGO', 'END',
  'EYE', 'GUM', 'GUN', 'GUT', 'GUY', 'GYM', 'INK', 'INN', 'JAM', 'JAW',
  'JOY', 'KEY', 'KID', 'KIT', 'LAB', 'LAP', 'LEG', 'LOG', 'LOT', 'LOW',
  'NUT', 'NET', 'PEA', 'PEN', 'PET', 'PIE', 'PIN', 'PIT', 'TAB', 'TAG',
  'TAN', 'TAR', 'TAX', 'TEA', 'TOE', 'TON', 'TOP', 'TOW', 'TOY', 'TUB',
  'TUG', 'URN', 'VAN', 'VAT', 'VET', 'VIA', 'VOW', 'WEB', 'WIG', 'WIT',
  'WOE', 'WOK', 'WON', 'YAM', 'YAK', 'YEN', 'YET', 'ZEN', 'ZIP', 'ZOO',
  'ELF', 'BIG',
  
  // 4-letter
  'THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'FROM', 'THEY', 'BEEN', 'MANY',
  'SOME', 'THEM', 'THAN', 'ONLY', 'COME', 'MADE', 'FIND', 'TAKE', 'KNOW',
  'MAKE', 'YEAR', 'LIFE', 'WORK', 'PART', 'SUCH', 'GIVE', 'MOST', 'EACH',
  'ALSO', 'SAME', 'USED', 'DOES', 'EVEN', 'WELL', 'BACK', 'GOOD', 'MUCH',
  'VERY', 'JUST', 'OVER', 'LONG', 'LOOK', 'HERE', 'WANT', 'TELL', 'HELP',
  'LAST', 'TURN', 'MOVE', 'KEEP', 'CALL', 'NEED', 'FEEL', 'HIGH', 'SEEM',
  'REAL', 'BEAR', 'BIRD', 'BULL', 'CRAB', 'CROW', 'DEER', 'DUCK', 'FAWN',
  'FISH', 'FROG', 'GOAT', 'HAWK', 'HARE', 'LAMB', 'LION', 'MOLE', 'MOTH',
  'SEAL', 'SLUG', 'SWAN', 'TOAD', 'WASP', 'WOLF', 'WORM', 'BEEF', 'BEAN',
  'BEER', 'CAKE', 'CHEF', 'CORN', 'LIME', 'MEAT', 'MILK', 'MINT', 'PEAR',
  'PLUM', 'PORK', 'RICE', 'SALT', 'SOUP', 'WINE', 'BONE', 'CHIN', 'FACE',
  'FOOT', 'HAIR', 'HAND', 'HEAD', 'HEEL', 'KNEE', 'LIMB', 'LUNG', 'NECK',
  'NOSE', 'PALM', 'SHIN', 'SKIN', 'TOES', 'VEIN', 'BUSH', 'CAVE', 'CLAY',
  'DUNE', 'FERN', 'GLEN', 'HILL', 'ISLE', 'LAKE', 'LEAF', 'MOSS', 'POND',
  'RAIN', 'ROCK', 'ROSE', 'SAND', 'SEED', 'SNOW', 'SOIL', 'STAR', 'STEM',
  'TREE', 'WAVE', 'WIND', 'WOOD', 'BATH', 'BELL', 'BOOK', 'BOWL', 'BULB',
  'CARD', 'CART', 'CASE', 'COIN', 'CORD', 'DESK', 'DISH', 'DOOR', 'DRUM',
  'FORK', 'GATE', 'GIFT', 'HOOK', 'KEYS', 'KNOB', 'LAMP', 'LOCK', 'MAIL',
  'NAIL', 'OVEN', 'PAGE', 'PIPE', 'PLUG', 'POLE', 'POOL', 'RING', 'ROOF',
  'ROPE', 'SAFE', 'SEAT', 'SIGN', 'SINK', 'SOFA', 'TANK', 'TAPE', 'TENT',
  'TILE', 'TOOL', 'TRAY', 'TUBE', 'VASE', 'WALL', 'WIRE', 'BELT', 'BOOT',
  'CAPE', 'COAT', 'GOWN', 'JEAN', 'ROBE', 'SHOE', 'SOCK', 'SUIT', 'VEST',
  'DAWN', 'DUSK', 'HOUR', 'MOON', 'NOON', 'WEEK', 'CALM', 'CARE', 'ENVY',
  'FEAR', 'GLAD', 'GLEE', 'GRIM', 'HATE', 'HOPE', 'LOVE', 'PAIN', 'RAGE',
  'REST', 'WARM', 'ZEAL', 'AQUA', 'BLUE', 'CYAN', 'GOLD', 'GRAY', 'GREY',
  'JADE', 'NAVY', 'PINK', 'RUBY', 'TEAL', 'AREA', 'BANK', 'BARN', 'CAFE',
  'CAMP', 'CITY', 'CLUB', 'DORM', 'FARM', 'FORT', 'HALL', 'HOME', 'JAIL',
  'MALL', 'MINE', 'PARK', 'PIER', 'PORT', 'ROAD', 'ROOM', 'SHOP', 'SITE',
  'TOWN', 'ZONE', 'AUNT', 'BABY', 'BOSS', 'CREW', 'DUKE', 'FOLK', 'GIRL',
  'HERO', 'HOST', 'IDOL', 'KING', 'LADY', 'LORD', 'MAID', 'PEER', 'POET',
  'TEEN', 'TWIN', 'USER', 'WIFE', 'ABLE', 'AGED', 'BARE', 'BOLD', 'BUSY',
  'COLD', 'COOL', 'CUTE', 'DAMP', 'DARK', 'DEAD', 'DEEP', 'DULL', 'EASY',
  'EVIL', 'FAIR', 'FAKE', 'FAST', 'FINE', 'FIRM', 'FLAT', 'FREE', 'FULL',
  'HARD', 'HUGE', 'IDLE', 'KEEN', 'KIND', 'LATE', 'LAZY', 'LEAN', 'LEFT',
  'LIVE', 'LONE', 'LOUD', 'MAIN', 'MALE', 'MEAN', 'MERE', 'MILD', 'NEAR',
  'NEAT', 'NEXT', 'NICE', 'OKAY', 'OPEN', 'PALE', 'PAST', 'POOR', 'PURE',
  'RARE', 'RICH', 'RIPE', 'RUDE', 'SICK', 'SLIM', 'SLOW', 'SOFT', 'SOLE',
  'SORE', 'SOUR', 'SURE', 'TALL', 'TIDY', 'TINY', 'TORN', 'TRUE', 'UGLY',
  'VAST', 'VILE', 'WEAK', 'WIDE', 'WILD', 'WISE', 'WORN', 'APPS', 'BLOG',
  'BYTE', 'CHAT', 'CHIP', 'CODE', 'DATA', 'DISK', 'FILE', 'ICON', 'LINK',
  'MENU', 'NODE', 'SPAM', 'TEXT', 'WIFI', 'ZOOM', 'AIDE', 'ALOE', 'ARCH',
  'ATOM', 'AXIS', 'BASE', 'BEAM', 'BETA', 'BIAS', 'BLOC', 'BOND', 'BOOM',
  'BOUT', 'BRIM', 'BULK', 'CAGE', 'CAST', 'CELL', 'CLAN', 'CLUE', 'COIL',
  'CONE', 'COPE', 'CORE', 'CULT', 'CURB', 'DAZE', 'DECK', 'DEMO', 'DIAL',
  'DICE', 'DOME', 'DOSE', 'DRAG', 'DUAL', 'DUET', 'EASE', 'ECHO', 'EDGE',
  'EPIC', 'EXAM', 'EXPO', 'FACT', 'FADE', 'FAME', 'FATE', 'FEAT', 'FLAW',
  'FLEX', 'FLIP', 'FLOW', 'FOAM', 'FOES', 'FOND', 'FONT', 'FORM', 'FOUL',
  'FUEL', 'FUND', 'FUSE', 'FUSS', 'GAIT', 'GAZE', 'GEAR', 'GERM', 'GIST',
  'GLUE', 'GOAL', 'GORE', 'GRAM', 'GRIT', 'GULF', 'GURU', 'HACK', 'HALO',
  'HARP', 'HAZE', 'HEAP', 'HINT', 'HIVE', 'HOAX', 'HOSE', 'HYPE', 'IDEA',
  'INCH', 'INFO', 'IONS', 'IRIS', 'IRON', 'ITEM', 'JAZZ', 'JEST', 'JOLT',
  'JUDO', 'JURY', 'KALE', 'KILN', 'KIWI', 'KNOT', 'LACE', 'LAIR', 'LANE',
  'LAVA', 'LAWN', 'LEAK', 'LENS', 'LINE', 'LIST', 'LOBE', 'LOFT', 'LOGO',
  'LOOP', 'LOOT', 'LORE', 'LOSS', 'LUCK', 'LUMP', 'LURE', 'MALT', 'MARE',
  'MARS', 'MASH', 'MASK', 'MASS', 'MATE', 'MATH', 'MAXI', 'MAZE', 'MEMO',
  'MESH', 'MESS', 'MILE', 'MIME', 'MIND', 'MINI', 'MIST', 'MODE', 'MOOD',
  'MOOR', 'MOVE', 'MULE', 'MUSE', 'MUTT', 'MYTH', 'NEON', 'NEST', 'NEWS',
  'NINE', 'NOPE', 'NORM', 'NOTE', 'NOUN', 'ODDS', 'OGRE', 'OMEN', 'OPUS',
  'ORAL', 'OVAL', 'PACE', 'PACT', 'PAIL', 'PAIR', 'PATH', 'PAWN', 'PEAK',
  'PEEL', 'PERK', 'PEST', 'PILE', 'PINE', 'PINT', 'PLAN', 'PLEA', 'PLOD',
  'PLOT', 'PLUS', 'POKE', 'POLL', 'POLO', 'PONY', 'POPE', 'PORE', 'POSE',
  'POST', 'PREP', 'PREY', 'PROD', 'PROF', 'PROM', 'PROP', 'PROS', 'PULP',
  'PUMP', 'PUNK', 'PUNS', 'PUSH', 'QUIZ', 'RAID', 'RAIL', 'RAKE', 'RAMP',
  'RANG', 'RANK', 'RANT', 'RATE', 'RAVE', 'RAYS', 'REEF', 'REEL', 'RELY',
  'REAP', 'REAR', 'REIN', 'RISK', 'RITE', 'ROAM', 'ROLE', 'ROMP', 'ROOT',
  'RUIN', 'RUNG', 'RUSE', 'RUST', 'SAGA', 'SAGE', 'SAKE', 'SALE', 'SANE',
  'SASH', 'SCAM', 'SCAN', 'SCAR', 'SECT', 'SELF', 'SEWN', 'SHED', 'SHIM',
  'SIGH', 'SILK', 'SILO', 'SINE', 'SIRE', 'SLAB', 'SLAG', 'SLAP', 'SLAT',
  'SLED', 'SLEW', 'SLID', 'SLIT', 'SLOB', 'SLOG', 'SLOP', 'SLOT', 'SLUM',
  'SLUR', 'SMOG', 'SNAP', 'SNOB', 'SOAK', 'SOAP', 'SOAR', 'SODA', 'SOLO',
  'SONG', 'SOON', 'SOOT', 'SORT', 'SOUL', 'SPAN', 'SPAR', 'SPEC', 'SPIN',
  'SPIT', 'SPOT', 'SPUD', 'SPUR', 'STAB', 'STAT', 'STAY', 'STEW', 'STIR',
  'STOP', 'STUB', 'STUD', 'STUN', 'SUDS', 'SULK', 'SURF', 'SWAP', 'SWIM',
  'TABS', 'TACT', 'TALE', 'TALK', 'TANG', 'TASK', 'TEST', 'THAW', 'TICK',
  'TIDE', 'TIER', 'TILT', 'TIME', 'TINT', 'TOLL', 'TOMB', 'TONE', 'TOSS',
  'TOUR', 'TRAP', 'TREK', 'TRIM', 'TRIO', 'TROT', 'TUCK', 'TURF', 'TYPE',
  'UNIT', 'UNTO', 'UPON', 'URGE', 'VARY', 'VENT', 'VERB', 'VERY', 'VETO',
  'VIEW', 'VOID', 'VOLT', 'VOTE', 'WADE', 'WAGE', 'WAIT', 'WAKE', 'WALK',
  'WANT', 'WARD', 'WARN', 'WARP', 'WARY', 'WASH', 'WEAR', 'WEED', 'WEEP',
  'WELD', 'WENT', 'WEST', 'WHAT', 'WHEN', 'WHIP', 'WHOM', 'WICK', 'WING',
  'WINK', 'WIPE', 'WISH', 'WORE', 'WRAP', 'YARD', 'YAWN', 'YELL', 'YOGA',
  'YOKE', 'LEND',
  
  // 5-letter  
  'ABOUT', 'AFTER', 'AGAIN', 'BEING', 'BELOW', 'COULD', 'EVERY', 'FIRST',
  'FOUND', 'GREAT', 'HOUSE', 'LARGE', 'LEARN', 'NEVER', 'OTHER', 'PLACE',
  'PLANT', 'POINT', 'RIGHT', 'SMALL', 'SOUND', 'SPELL', 'STILL', 'STUDY',
  'THEIR', 'THERE', 'THESE', 'THING', 'THINK', 'THREE', 'UNDER', 'WATER',
  'WHERE', 'WHICH', 'WHILE', 'WORLD', 'WOULD', 'WRITE', 'YOUNG', 'ITEMS',
  'INFER',
  
  // 6-letter
  'ASSUME', 'ALLEGE', 'ENOUGH', 'ACROSS', 'ACTION', 'ADVICE', 'AFRAID',
  'ALMOST', 'ALWAYS', 'AMOUNT', 'ANIMAL', 'ANSWER', 'ANYONE', 'APPEAR',
  'AROUND', 'ARTIST', 'ATTACK', 'AUTHOR', 'BATTLE', 'BEAUTY', 'BECOME',
  'BEFORE', 'BEHIND', 'BELONG', 'BETTER', 'BEYOND', 'BOTTLE', 'BOTTOM',
  'BRANCH', 'BRIDGE', 'BRIGHT', 'BROKEN', 'BUDGET', 'BUTTON', 'CAMERA',
  'CANCEL', 'CAREER', 'CASTLE', 'CENTER', 'CHANCE', 'CHANGE', 'CHOICE',
  'CHOOSE', 'CHURCH', 'CIRCLE', 'CLIENT', 'CLOSED', 'COFFEE', 'COLUMN',
  'COMING', 'COMMON', 'CORNER', 'COTTON', 'COUNTY', 'COUPLE', 'COURSE',
  'CREATE', 'CREDIT', 'DANGER', 'DECIDE', 'DEMAND', 'DESIGN', 'DETAIL',
  'DEVICE', 'DINNER', 'DIRECT', 'DOCTOR', 'DOLLAR', 'DOUBLE', 'DRAGON',
  'DURING', 'EASILY', 'EDITOR', 'EFFECT', 'EFFORT', 'EITHER', 'ENABLE',
  'ENDING', 'ENERGY', 'ENGINE', 'ENSURE', 'ENTIRE', 'ESCAPE', 'EXPECT',
  'EXPERT', 'EXTEND', 'FABRIC', 'FAMILY', 'FAMOUS', 'FATHER', 'FIGURE',
  'FILTER', 'FINGER', 'FINISH', 'FLIGHT', 'FLOWER', 'FOLDER', 'FOLLOW',
  'FOREST', 'FORGET', 'FORMAT', 'FORMER', 'FRIEND', 'FROZEN', 'FUTURE',
  'GARDEN', 'GATHER', 'GENTLE', 'GLOBAL', 'GOLDEN', 'GROWTH', 'GUITAR',
  'HANDLE', 'HAPPEN', 'HARDLY', 'HEALTH', 'HEIGHT', 'HIDDEN', 'HONEST',
  'HUNGRY', 'IGNORE', 'IMPACT', 'INCOME', 'INDEED', 'INJURY', 'INSECT',
  'INSIDE', 'INTEND', 'INVEST', 'ISLAND', 'ITSELF', 'JACKET', 'KNIGHT',
  'LADDER', 'LAPTOP', 'LATELY', 'LAUNCH', 'LAWYER', 'LEADER', 'LEAGUE',
  'LENGTH', 'LESSON', 'LETTER', 'LIKELY', 'LIQUID', 'LISTEN', 'LITTLE',
  'LIVELY', 'LIVING', 'LOCATE', 'LONELY', 'LONGER', 'LOVELY', 'MAINLY',
  'MAKING', 'MANAGE', 'MANNER', 'MARKET', 'MASTER', 'MATTER', 'MEDIUM',
  'MEMBER', 'MEMORY', 'MENTAL', 'METHOD', 'MIDDLE', 'MINUTE', 'MIRROR',
  'MOBILE', 'MODERN', 'MOMENT', 'MONKEY', 'MOSTLY', 'MOTHER', 'MOTION',
  'MOVING', 'MURDER', 'MUSCLE', 'MUSEUM', 'MYSELF', 'NARROW', 'NATION',
  'NATIVE', 'NATURE', 'NEARBY', 'NEARLY', 'NEEDLE', 'NOBODY', 'NORMAL',
  'NOTICE', 'NUMBER', 'OBTAIN', 'OFFICE', 'ONLINE', 'OPTION', 'ORANGE',
  'ORIGIN', 'OUTPUT', 'OXYGEN', 'PALACE', 'PARENT', 'PARTLY', 'PEOPLE',
  'PERIOD', 'PERMIT', 'PERSON', 'PHRASE', 'PLANET', 'PLAYER', 'PLEASE',
  'PLENTY', 'POCKET', 'POETRY', 'POLICE', 'POLICY', 'POSTER', 'POTATO',
  'POWDER', 'PRAYER', 'PREFER', 'PRETTY', 'PRINCE', 'PRISON', 'PROFIT',
  'PROPER', 'PUBLIC', 'PUZZLE', 'RABBIT', 'RANDOM', 'RARELY', 'RATHER',
  'READER', 'REALLY', 'REASON', 'RECALL', 'RECENT', 'RECORD', 'REDUCE',
  'REFUSE', 'REGION', 'REJECT', 'RELATE', 'RELIEF', 'REMAIN', 'REMIND',
  'REMOTE', 'REMOVE', 'REPAIR', 'REPEAT', 'REPORT', 'RESCUE', 'RESIST',
  'RESORT', 'RESULT', 'RETURN', 'REVEAL', 'REVIEW', 'REWARD', 'RIDING',
  'RISING', 'ROCKET', 'RUNNER', 'SAFETY', 'SALARY', 'SAMPLE', 'SAVING',
  'SAYING', 'SCHOOL', 'SCREEN', 'SCRIPT', 'SEARCH', 'SEASON', 'SECOND',
  'SECRET', 'SECURE', 'SELECT', 'SELLER', 'SENIOR', 'SERIES', 'SERVER',
  'SETTLE', 'SEVERE', 'SHADOW', 'SHOULD', 'SIGNAL', 'SILENT', 'SILVER',
  'SIMPLE', 'SIMPLY', 'SINGER', 'SINGLE', 'SISTER', 'SLIGHT', 'SMOOTH',
  'SOCIAL', 'SOLELY', 'SOLVED', 'SOURCE', 'SPEECH', 'SPIDER', 'SPIRIT',
  'SPOKEN', 'SPREAD', 'SPRING', 'SQUARE', 'STABLE', 'STATUS', 'STEADY',
  'STOLEN', 'STORED', 'STRAIN', 'STREAM', 'STREET', 'STRESS', 'STRICT',
  'STRIKE', 'STRING', 'STRONG', 'STUDIO', 'SUBMIT', 'SUBURB', 'SUDDEN',
  'SUFFER', 'SUMMER', 'SUNDAY', 'SUPPLY', 'SURELY', 'SURVEY', 'SWITCH',
  'SYMBOL', 'SYSTEM', 'TAKING', 'TALENT', 'TARGET', 'TEMPLE', 'TENANT',
  'THEORY', 'THREAD', 'THREAT', 'THRONE', 'TICKET', 'TIMBER', 'TISSUE',
  'TOILET', 'TONGUE', 'TOWARD', 'TRAVEL', 'TREATY', 'TRENDS', 'TRIBAL',
  'TROOPS', 'UNIQUE', 'UNLIKE', 'UPDATE', 'UPWARD', 'URGENT', 'USEFUL',
  'VALLEY', 'VERSUS', 'VICTIM', 'VIRTUE', 'VISION', 'VISUAL', 'VOLUME',
  'VOTING', 'WALKER', 'WALLET', 'WANTED', 'WARMTH', 'WEALTH', 'WEAPON',
  'WEEKLY', 'WEIGHT', 'WINTER', 'WITHIN', 'WONDER', 'WOODEN', 'WORKER',
  'WORTHY', 'WRITER', 'YELLOW',
  
  // 7-letter
  'REGULAR', 'EPISODE', 'ANOTHER', 'BECAUSE', 'BETWEEN', 'CHILDREN', 'COUNTRY', 'DIFFERENT',
  'EXAMPLE', 'FAMILY', 'GENERAL', 'HISTORY', 'IMPORTANT', 'JUSTICE', 'KNOWLEDGE', 'LANGUAGE',
  'MACHINE', 'NATURAL', 'OFFICER', 'PICTURE', 'PROBLEM', 'QUESTION', 'REALIZE', 'SERVICE',
  'SOCIETY', 'THOUGHT', 'THROUGH', 'VARIOUS', 'WEEKEND', 'WHETHER', 'ALREADY', 'ANIMALS',
  'BROTHER', 'CAPITAL', 'COMPANY', 'DANGEROUS', 'EDUCATION', 'FACTORY', 'GOVERNMENT', 'HAPPENED',
  'INCLUDING', 'JOURNEY', 'KITCHEN', 'LIBRARY', 'MAGAZINE', 'NATURALLY', 'OPINION', 'PACKAGE',
  'QUARTER', 'REALITY', 'SCIENCE', 'STATION', 'TRAINING', 'UNIVERSAL', 'VICTORY', 'WELCOME',
  'YESTERDAY', 'ABSOLUTE', 'BRILLIANT', 'COMPLETE', 'DIVISION', 'EVIDENCE', 'FREQUENT', 'GRADUATE',
  'HORRIBLE', 'INCREASE', 'JUDGMENT', 'KNOWING', 'LECTURE', 'MISTAKE', 'NEGATIVE', 'ORIGINAL',
  'PASSAGE', 'QUANTITY', 'RECEIVE', 'SILENCE', 'TREATMENT', 'UNUSUAL', 'VARIETY', 'WHISPER',
  'YELLING', 'ABANDON', 'BALANCE', 'COMFORT', 'DESTROY', 'EXPLAIN', 'FOREVER', 'GUARANTEE',
  'HAPPINESS', 'INNOCENT', 'JOURNEY', 'KINDNESS', 'LONELINESS', 'MOMENTUM', 'NEGOTIATE', 'OBSERVE',
  'PASSION', 'QUALITY', 'REQUIRE', 'STRENGTH', 'TREASURE', 'UNDERSTAND', 'VACATION', 'WONDERFUL',
  
  // 8-letter
  'PERSONAL', 'EPISODES', 'ABSOLUTE', 'ACCIDENT', 'ACTIVITY', 'ADVANTAGE', 'AGREEMENT', 'ANALYSIS',
  'ANYTHING', 'APPROACH', 'ATTITUDE', 'AUDIENCE', 'AUTHORITY', 'BEHAVIOR', 'BUILDING', 'BUSINESS',
  'CAMPAIGN', 'CAPACITY', 'CATEGORY', 'CHALLENGE', 'CHEMICAL', 'CIVILIZATION', 'COLLECTION', 'COMMUNITY',
  'COMPANY', 'COMPLETE', 'COMPUTER', 'CONCERNED', 'CONDITION', 'CONFIDENCE', 'CONFLICT', 'CONGRESS',
  'CONSIDER', 'CONSTANT', 'CONSUMER', 'CONTINUE', 'CONTRACT', 'CONTROL', 'CONVINCE', 'CREATIVE',
  'CRITICAL', 'CULTURAL', 'CUSTOMER', 'DANGEROUS', 'DATABASE', 'DECISION', 'DECLARED', 'DECREASE',
  'DEFINITE', 'DELIVERY', 'DEMOCRACY', 'DESIGNED', 'DETAILED', 'DEVELOPED', 'DIFFERENT', 'DIFFICULT',
  'DIRECTLY', 'DISCOVER', 'DISTANCE', 'DIVISION', 'DOCUMENT', 'DOMESTIC', 'DONATION', 'DRAMATIC',
  'ECONOMIC', 'EDUCATED', 'EFFECTIVE', 'EFFICIENT', 'ELECTION', 'ELECTRIC', 'ELEGANT', 'ELEVATOR',
  'EMERGENCY', 'EMPLOYEE', 'ENCOURAGE', 'ENGINEER', 'ENORMOUS', 'ENTERTAIN', 'ENTIRELY', 'EQUIPMENT',
  'ESCAPING', 'ESTABLISH', 'EVALUATE', 'EVERYDAY', 'EVIDENCE', 'EXACTLY', 'EXAMINED', 'EXCELLENT',
  'EXCHANGE', 'EXCITING', 'EXECUTIVE', 'EXERCISE', 'EXPANDED', 'EXPECTED', 'EXPENSIVE', 'EXPERIENCE',
  'EXPLAINED', 'EXPLORED', 'EXPOSURE', 'EXTENDED', 'EXTERNAL', 'EXTREMELY', 'FACILITY', 'FAMILIAR',
  'FANTASTIC', 'FASHION', 'FEATURED', 'FEDERAL', 'FEELING', 'FEMININE', 'FESTIVAL', 'FINANCIAL',
  'FIREFIGHT', 'FIREPLACE', 'FIREWORK', 'FIRSTLY', 'FISHING', 'FLOODING', 'FOLLOWED', 'FOOTBALL',
  'FORECAST', 'FOREHEAD', 'FOREIGN', 'FORESTRY', 'FOREVER', 'FORMALLY', 'FORMULA', 'FORTUNATE',
  'FOUNDATION', 'FOURTEEN', 'FRACTION', 'FRAGMENT', 'FRAMEWORK', 'FREQUENT', 'FRIENDLY', 'FRIGHTEN',
  'FRONTIER', 'FUNCTION', 'FURNITURE', 'GALLERY', 'GARDENER', 'GENERATE', 'GENEROUS', 'GENETICS',
  'GENTLEMAN', 'GEOMETRY', 'GLACIER', 'GLORIOUS', 'GOODNESS', 'GOVERNOR', 'GRADUATE', 'GRAPHICS',
  'GRATEFUL', 'GREATEST', 'GREENHOUSE', 'GROCERY', 'GUARANTEE', 'GUARDIAN', 'GUIDANCE', 'HABITAT',
  'HANDLING', 'HAPPENED', 'HAPPINESS', 'HARMFUL', 'HARVEST', 'HEADLINE', 'HEALTHY', 'HEARING',
  'HEARTBEAT', 'HELICOPTER', 'HELPFUL', 'HERITAGE', 'HESITATE', 'HISTORIC', 'HOLIDAY', 'HOMELESS',
  'HONESTLY', 'HOPEFUL', 'HORIZON', 'HOSPITAL', 'HOSTILE', 'HOUSING', 'HUMANITY', 'HUMOROUS',
  'HUNDRED', 'HUNGRY', 'HURRIED', 'HUSBAND', 'HYGIENE', 'IDEALIST', 'IDENTIFY', 'IDEOLOGY',
  'IGNORANT', 'ILLEGAL', 'ILLNESS', 'IMAGINE', 'IMMEDIATE', 'IMMIGRANT', 'IMMUNITY', 'IMPACTED',
  'IMPERIAL', 'IMPLICIT', 'IMPORTED', 'IMPOSING', 'IMPOSSIBLE', 'IMPRESS', 'IMPROVE', 'INCIDENT',
  'INCLUDE', 'INCOME', 'INCREASE', 'INDICATE', 'INDIVIDUAL', 'INDUSTRY', 'INFANT', 'INFECTED',
  'INFERIOR', 'INFINITE', 'INFLUENCE', 'INFORMAL', 'INFORMED', 'INGREDIENT', 'INHABIT', 'INHERIT',
  'INITIAL', 'INJECT', 'INJURY', 'INNOCENT', 'INNOVATE', 'INPUT', 'INQUIRE', 'INSECT',
  'INSERT', 'INSIDE', 'INSIGHT', 'INSIST', 'INSPECT', 'INSPIRE', 'INSTALL', 'INSTANCE',
  'INSTANT', 'INSTEAD', 'INSTINCT', 'INSTITUTE', 'INSTRUCT', 'INSTRUMENT', 'INSULT', 'INSURANCE',
  'INTEGRATE', 'INTELLECT', 'INTELLIGENT', 'INTEND', 'INTENSE', 'INTENT', 'INTERACT', 'INTEREST',
  'INTERFERE', 'INTERIOR', 'INTERNAL', 'INTERNET', 'INTERPRET', 'INTERRUPT', 'INTERVAL', 'INTERVIEW',
  'INTIMATE', 'INTOXICATE', 'INTRIGUE', 'INTRODUCE', 'INVADE', 'INVALID', 'INVASION', 'INVENT',
  'INVEST', 'INVESTIGATE', 'INVESTMENT', 'INVITE', 'INVOLVE', 'IRONIC', 'IRRIGATE', 'IRRITATE',
  'ISLAND', 'ISOLATE', 'ISSUE', 'ITEM', 'JACKET', 'JAIL', 'JAM', 'JANUARY',
  'JAR', 'JAW', 'JAZZ', 'JEALOUS', 'JEANS', 'JELLY', 'JERSEY', 'JEST',
  'JET', 'JEWEL', 'JOB', 'JOIN', 'JOINT', 'JOKE', 'JOURNAL', 'JOURNEY',
  'JOY', 'JUDGE', 'JUICE', 'JULY', 'JUMP', 'JUNE', 'JUNGLE', 'JUNIOR',
  'JUNK', 'JURY', 'JUST', 'JUSTICE', 'JUSTIFY', 'KEEP', 'KEY', 'KICK',
  'KID', 'KILL', 'KILO', 'KIND', 'KING', 'KISS', 'KIT', 'KITCHEN',
  'KITE', 'KNEE', 'KNIFE', 'KNIGHT', 'KNOCK', 'KNOT', 'KNOW', 'KNOWLEDGE',
  'LAB', 'LABEL', 'LABOR', 'LABORATORY', 'LACK', 'LADDER', 'LADY', 'LAKE',
  'LAMB', 'LAMP', 'LAND', 'LANDSCAPE', 'LANE', 'LANGUAGE', 'LAP', 'LAPTOP',
  'LARGE', 'LASER', 'LAST', 'LATE', 'LATER', 'LATEST', 'LATIN', 'LATTER',
  'LAUGH', 'LAUNCH', 'LAW', 'LAWN', 'LAWYER', 'LAY', 'LAYER', 'LAZY',
  'LEAD', 'LEADER', 'LEAF', 'LEAGUE', 'LEAN', 'LEARN', 'LEASE', 'LEAST',
  'LEATHER', 'LEAVE', 'LECTURE', 'LEFT', 'LEG', 'LEGAL', 'LEGEND', 'LEGISLATION',
  'LEGITIMATE', 'LEMON', 'LEND', 'LENGTH', 'LENS', 'LESS', 'LESSON', 'LET',
  'LETTER', 'LEVEL', 'LIBERAL', 'LIBERTY', 'LIBRARY', 'LICENSE', 'LID', 'LIE',
  'LIFE', 'LIFT', 'LIGHT', 'LIKE', 'LIKELY', 'LIMB', 'LIMIT', 'LINE',
  'LINK', 'LION', 'LIP', 'LIQUID', 'LIST', 'LISTEN', 'LITERALLY', 'LITERARY',
  'LITERATURE', 'LITTLE', 'LIVE', 'LIVELY', 'LIVING', 'LOAD', 'LOAN', 'LOCAL',
  'LOCATE', 'LOCATION', 'LOCK', 'LODGE', 'LOG', 'LOGIC', 'LOGICAL', 'LONELY',
  'LONG', 'LOOK', 'LOOP', 'LOOSE', 'LORD', 'LOSE', 'LOSS', 'LOST',
  'LOT', 'LOUD', 'LOVE', 'LOVELY', 'LOVER', 'LOW', 'LUCK', 'LUCKY',
  'LUNCH', 'LUNG', 'MACHINE', 'MAD', 'MAGAZINE', 'MAGIC', 'MAID', 'MAIL',
  'MAIN', 'MAINLY', 'MAINTAIN', 'MAJOR', 'MAJORITY', 'MAKE', 'MAKER', 'MALE',
  'MALL', 'MAN', 'MANAGE', 'MANAGER', 'MANNER', 'MANUFACTURE', 'MANY', 'MAP',
  'MARCH', 'MARGIN', 'MARK', 'MARKET', 'MARRIAGE', 'MARRIED', 'MARRY', 'MASS',
  'MASSIVE', 'MASTER', 'MATCH', 'MATE', 'MATERIAL', 'MATH', 'MATTER', 'MATURE',
  'MAXIMUM', 'MAY', 'MAYBE', 'MAYOR', 'ME', 'MEAL', 'MEAN', 'MEANING',
  'MEANWHILE', 'MEASURE', 'MEAT', 'MECHANIC', 'MECHANICAL', 'MEDIA', 'MEDICAL', 'MEDICINE',
  'MEDIUM', 'MEET', 'MEETING', 'MELT', 'MEMBER', 'MEMBERSHIP', 'MEMORY', 'MENTAL',
  'MENTION', 'MENU', 'MERE', 'MERELY', 'MERRY', 'MESS', 'MESSAGE', 'METAL',
  'METER', 'METHOD', 'METRO', 'MIDDLE', 'MIDNIGHT', 'MIGHT', 'MILE', 'MILITARY',
  'MILK', 'MILL', 'MILLION', 'MIND', 'MINE', 'MINERAL', 'MINIMUM', 'MINING',
  'MINISTER', 'MINOR', 'MINORITY', 'MINUTE', 'MIRACLE', 'MIRROR', 'MISS', 'MISSILE',
  'MISSION', 'MISTAKE', 'MIX', 'MIXTURE', 'MOBILE', 'MODE', 'MODEL', 'MODERATE',
  'MODERN', 'MODEST', 'MODIFY', 'MOMENT', 'MONDAY', 'MONEY', 'MONITOR', 'MONKEY',
  'MONTH', 'MOOD', 'MOON', 'MORAL', 'MORE', 'MORNING', 'MORTAL', 'MOST',
  'MOSTLY', 'MOTHER', 'MOTION', 'MOTIVE', 'MOTOR', 'MOUNTAIN', 'MOUSE', 'MOUTH',
  'MOVE', 'MOVEMENT', 'MOVIE', 'MUCH', 'MUD', 'MULTIPLE', 'MULTIPLY', 'MURDER',
  'MUSCLE', 'MUSEUM', 'MUSIC', 'MUSICAL', 'MUSICIAN', 'MUST', 'MUTUAL', 'MY',
  'MYSELF', 'MYSTERIOUS', 'MYSTERY', 'MYTH', 'NAIL', 'NAKED', 'NAME', 'NAMELY',
  'NARROW', 'NATION', 'NATIONAL', 'NATIVE', 'NATURAL', 'NATURALLY', 'NATURE', 'NAVY',
  'NEAR', 'NEARBY', 'NEARLY', 'NEAT', 'NECESSARILY', 'NECESSARY', 'NECK', 'NEED',
  'NEEDLE', 'NEGATIVE', 'NEGLECT', 'NEGOTIATE', 'NEIGHBOR', 'NEIGHBORHOOD', 'NEITHER', 'NERVE',
  'NERVOUS', 'NEST', 'NET', 'NETWORK', 'NEUTRAL', 'NEVER', 'NEVERTHELESS', 'NEW',
  'NEWLY', 'NEWS', 'NEWSPAPER', 'NEXT', 'NICE', 'NIGHT', 'NIGHTMARE', 'NINE',
  'NINETEEN', 'NO', 'NOBODY', 'NOD', 'NOISE', 'NONE', 'NOON', 'NOR',
  'NORMAL', 'NORMALLY', 'NORTH', 'NORTHERN', 'NOSE', 'NOT', 'NOTE', 'NOTHING',
  'NOTICE', 'NOTION', 'NOVEL', 'NOW', 'NOWHERE', 'NUCLEAR', 'NUMBER', 'NUMEROUS',
  'NURSE', 'NUT', 'OBJECT', 'OBJECTIVE', 'OBLIGATION', 'OBSERVE', 'OBTAIN', 'OBVIOUS',
  'OBVIOUSLY', 'OCCASION', 'OCCASIONALLY', 'OCCUPATION', 'OCCUR', 'OCEAN', 'OCTOBER', 'ODD',
  'OF', 'OFF', 'OFFENSE', 'OFFER', 'OFFICE', 'OFFICER', 'OFFICIAL', 'OFTEN',
  'OH', 'OIL', 'OKAY', 'OLD', 'ON', 'ONCE', 'ONE', 'ONION',
  'ONLINE', 'ONLY', 'ONTO', 'OPEN', 'OPENING', 'OPERATE', 'OPERATION', 'OPERATOR',
  'OPINION', 'OPPONENT', 'OPPORTUNITY', 'OPPOSE', 'OPPOSITE', 'OPTION', 'OR', 'ORAL',
  'ORANGE', 'ORBIT', 'ORCHESTRA', 'ORDER', 'ORDINARY', 'ORGAN', 'ORGANIC', 'ORGANIZATION',
  'ORGANIZE', 'ORIGIN', 'ORIGINAL', 'ORIGINALLY', 'OTHER', 'OTHERS', 'OTHERWISE', 'OUGHT',
  'OUR', 'OURS', 'OURSELVES', 'OUT', 'OUTCOME', 'OUTDOOR', 'OUTER', 'OUTLET',
  'OUTLINE', 'OUTPUT', 'OUTSIDE', 'OUTSTANDING', 'OVER', 'OVERALL', 'OVERCOME', 'OVERHEAD',
  'OVERLOOK', 'OVERNIGHT', 'OVERS', 'OVERTAKE', 'OWE', 'OWN', 'OWNER', 'OWNERSHIP',
  'OX', 'PACE', 'PACK', 'PACKAGE', 'PAGE', 'PAID', 'PAIN', 'PAINT',
  'PAINTING', 'PAIR', 'PALACE', 'PALE', 'PAN', 'PANEL', 'PANT', 'PAPER',
  'PARENT', 'PARK', 'PARLIAMENT', 'PART', 'PARTIAL', 'PARTICULARLY', 'PARTLY', 'PARTNER',
  'PARTNERSHIP', 'PARTY', 'PASS', 'PASSAGE', 'PASSENGER', 'PASSION', 'PAST', 'PATH',
  'PATIENT', 'PATTERN', 'PAUSE', 'PAY', 'PAYMENT', 'PEACE', 'PEAK', 'PEAR',
  'PENALTY', 'PENCIL', 'PEOPLE', 'PEPPER', 'PER', 'PERCEIVE', 'PERCENT', 'PERCENTAGE',
  'PERCEPTION', 'PERFECT', 'PERFECTLY', 'PERFORM', 'PERFORMANCE', 'PERHAPS', 'PERIOD', 'PERMANENT',
  'PERMISSION', 'PERMIT', 'PERSON', 'PERSONAL', 'PERSONALITY', 'PERSONALLY', 'PERSONNEL', 'PERSUADE',
  'PET', 'PHASE', 'PHENOMENON', 'PHILOSOPHY', 'PHONE', 'PHOTO', 'PHOTOGRAPH', 'PHRASE',
  'PHYSICAL', 'PHYSICALLY', 'PHYSICIAN', 'PHYSICS', 'PIANO', 'PICK', 'PICTURE', 'PIE',
  'PIECE', 'PILE', 'PILOT', 'PIN', 'PINK', 'PIONEER', 'PIPE', 'PITCH',
  'PLACE', 'PLAIN', 'PLAN', 'PLANE', 'PLANET', 'PLANNING', 'PLANT', 'PLASTIC',
  'PLATE', 'PLATFORM', 'PLAY', 'PLAYER', 'PLEASANT', 'PLEASE', 'PLEASURE', 'PLENTY',
  'PLOT', 'PLUG', 'PLUS', 'POCKET', 'POEM', 'POET', 'POETRY', 'POINT',
  'POISON', 'POLICE', 'POLICY', 'POLISH', 'POLITICAL', 'POLITICALLY', 'POLITICIAN', 'POLITICS',
  'POLL', 'POLLUTION', 'POOL', 'POOR', 'POP', 'POPULAR', 'POPULATION', 'PORCH',
  'PORT', 'PORTION', 'PORTRAIT', 'POSE', 'POSITION', 'POSITIVE', 'POSSESS', 'POSSIBILITY',
  'POSSIBLE', 'POSSIBLY', 'POST', 'POT', 'POTATO', 'POTENTIAL', 'POTENTIALLY', 'POUND',
  'POUR', 'POVERTY', 'POWDER', 'POWER', 'POWERFUL', 'PRACTICAL', 'PRACTICALLY', 'PRACTICE',
  'PRAISE', 'PRAY', 'PRAYER', 'PRECISE', 'PRECISELY', 'PREDICT', 'PREFER', 'PREFERENCE',
  'PREGNANT', 'PREPARATION', 'PREPARE', 'PRESENCE', 'PRESENT', 'PRESENTATION', 'PRESERVE', 'PRESIDENT',
  'PRESS', 'PRESSURE', 'PRETEND', 'PRETTY', 'PREVENT', 'PREVIOUS', 'PREVIOUSLY', 'PRICE',
  'PRIDE', 'PRIEST', 'PRIMARILY', 'PRIMARY', 'PRIME', 'PRINCIPLE', 'PRINT', 'PRIOR',
  'PRIORITY', 'PRISON', 'PRISONER', 'PRIVATE', 'PROBABLY', 'PROBLEM', 'PROCEDURE', 'PROCEED',
  'PROCESS', 'PRODUCE', 'PRODUCER', 'PRODUCT', 'PRODUCTION', 'PROFESSION', 'PROFESSIONAL', 'PROFESSOR',
  'PROFILE', 'PROFIT', 'PROGRAM', 'PROGRESS', 'PROJECT', 'PROMINENT', 'PROMISE', 'PROMOTE',
  'PROMOTION', 'PROMPT', 'PROOF', 'PROPER', 'PROPERLY', 'PROPERTY', 'PROPORTION', 'PROPOSAL',
  'PROPOSE', 'PROPOSED', 'PROSECUTOR', 'PROSPECT', 'PROTECT', 'PROTECTION', 'PROTEIN', 'PROTEST',
  'PROUD', 'PROVE', 'PROVIDE', 'PROVIDER', 'PROVINCE', 'PROVISION', 'PSYCHOLOGICAL', 'PSYCHOLOGY',
  'PUBLIC', 'PUBLICATION', 'PUBLICLY', 'PUBLISH', 'PULL', 'PUNISHMENT', 'PUPIL', 'PURCHASE',
  'PURE', 'PURPLE', 'PURPOSE', 'PURSUE', 'PUSH', 'PUT', 'QUALIFY', 'QUALITY',
  'QUANTITY', 'QUARTER', 'QUESTION', 'QUICK', 'QUICKLY', 'QUIET', 'QUIETLY', 'QUIT',
  'QUITE', 'QUOTE', 'RACE', 'RACIAL', 'RADICAL', 'RADIO', 'RAIL', 'RAIN',
  'RAISE', 'RANGE', 'RANK', 'RAPID', 'RAPIDLY', 'RARE', 'RARELY', 'RATE',
  'RATHER', 'RATING', 'RATIO', 'RAW', 'REACH', 'REACT', 'REACTION', 'READ',
  'READER', 'READILY', 'READING', 'READY', 'REAL', 'REALITY', 'REALIZE', 'REALLY',
  'REASON', 'REASONABLE', 'REASONABLY', 'RECALL', 'RECEIVE', 'RECENT', 'RECENTLY', 'RECEPTION',
  'RECIPE', 'RECOGNIZE', 'RECOMMEND', 'RECORD', 'RECORDING', 'RECOVER', 'RECOVERY', 'RECREATION',
  'RECRUIT', 'RED', 'REDUCE', 'REDUCTION', 'REFER', 'REFERENCE', 'REFLECT', 'REFLECTION',
  'REFORM', 'REFUSE', 'REGARD', 'REGARDING', 'REGARDLESS', 'REGIME', 'REGION', 'REGIONAL',
  'REGISTER', 'REGULAR', 'REGULARLY', 'REGULATE', 'REGULATION', 'REINFORCE', 'REJECT', 'RELATE',
  'RELATION', 'RELATIONSHIP', 'RELATIVE', 'RELATIVELY', 'RELAX', 'RELEASE', 'RELEVANT', 'RELIEF',
  'RELIGION', 'RELIGIOUS', 'RELUCTANT', 'RELY', 'REMAIN', 'REMAINING', 'REMARKABLE', 'REMEMBER',
  'REMIND', 'REMOTE', 'REMOVE', 'REPEAT', 'REPLACE', 'REPLY', 'REPORT', 'REPORTER',
  'REPRESENT', 'REPRESENTATIVE', 'REPUBLICAN', 'REPUTATION', 'REQUEST', 'REQUIRE', 'REQUIREMENT', 'RESEARCH',
  'RESEARCHER', 'RESERVE', 'RESIDENT', 'RESIST', 'RESOLUTION', 'RESOLVE', 'RESORT', 'RESOURCE',
  'RESPECT', 'RESPOND', 'RESPONSE', 'RESPONSIBILITY', 'RESPONSIBLE', 'REST', 'RESTAURANT', 'RESTORE',
  'RESTRICT', 'RESTRICTION', 'RESULT', 'RETAIN', 'RETIRE', 'RETURN', 'REVEAL', 'REVENUE',
  'REVIEW', 'REVOLUTION', 'RHYTHM', 'RICE', 'RICH', 'RID', 'RIDE', 'RIDGE',
  'RIDICULOUS', 'RIFLE', 'RIGHT', 'RING', 'RIP', 'RISE', 'RISK', 'RIVER',
  'ROAD', 'ROCK', 'ROLE', 'ROLL', 'ROMANTIC', 'ROOF', 'ROOM', 'ROOT',
  'ROPE', 'ROSE', 'ROUGH', 'ROUGHLY', 'ROUND', 'ROUTE', 'ROUTINE', 'ROW',
  'ROYAL', 'RUB', 'RULE', 'RUN', 'RUNNER', 'RURAL', 'RUSH', 'RUSSIAN',
  'SACRED', 'SAD', 'SAFE', 'SAFETY', 'SAID', 'SAIL', 'SAKE', 'SALAD',
  'SALARY', 'SALE', 'SALES', 'SALT', 'SAME', 'SAMPLE', 'SANCTION', 'SAND',
  'SANDWICH', 'SAT', 'SATISFACTION', 'SATISFY', 'SAUCE', 'SAVE', 'SAVING', 'SAW',
  'SAY', 'SCALE', 'SCAN', 'SCARCE', 'SCARED', 'SCENARIO', 'SCENE', 'SCHEDULE',
  'SCHEME', 'SCHOLAR', 'SCHOLARSHIP', 'SCHOOL', 'SCIENCE', 'SCIENTIFIC', 'SCIENTIST', 'SCOPE',
  'SCORE', 'SCREAM', 'SCREEN', 'SCRIPT', 'SCULPTURE', 'SEA', 'SEARCH', 'SEASON',
  'SEAT', 'SECOND', 'SECRET', 'SECRETARY', 'SECTION', 'SECTOR', 'SECURE', 'SECURITY',
  'SEE', 'SEED', 'SEEK', 'SEEM', 'SEGMENT', 'SEIZE', 'SELECT', 'SELECTION',
  'SELL', 'SENATE', 'SENATOR', 'SEND', 'SENIOR', 'SENSE', 'SENSITIVE', 'SENTENCE',
  'SEPARATE', 'SEQUENCE', 'SERIES', 'SERIOUS', 'SERIOUSLY', 'SERVANT', 'SERVE', 'SERVICE',
  'SESSION', 'SET', 'SETTING', 'SETTLE', 'SETTLEMENT', 'SEVEN', 'SEVERAL', 'SEVERE',
  'SEX', 'SEXUAL', 'SHADE', 'SHADOW', 'SHAKE', 'SHALL', 'SHAPE', 'SHARE',
  'SHARP', 'SHE', 'SHEET', 'SHELF', 'SHELL', 'SHELTER', 'SHIFT', 'SHINE',
  'SHIP', 'SHIRT', 'SHOCK', 'SHOE', 'SHOOT', 'SHOP', 'SHORE', 'SHORT',
  'SHORTLY', 'SHOT', 'SHOULD', 'SHOULDER', 'SHOUT', 'SHOW', 'SHOWER', 'SHRINK',
  'SHUT', 'SICK', 'SIDE', 'SIGHT', 'SIGN', 'SIGNAL', 'SIGNIFICANCE', 'SIGNIFICANT',
  'SIGNIFICANTLY', 'SILENCE', 'SILENT', 'SILLY', 'SILVER', 'SIMILAR', 'SIMILARLY', 'SIMPLE',
  'SIMPLY', 'SIMULTANEOUSLY', 'SIN', 'SINCE', 'SING', 'SINGER', 'SINGLE', 'SINK',
  'SIR', 'SISTER', 'SIT', 'SITE', 'SITUATION', 'SIX', 'SIZE', 'SKILL',
  'SKIN', 'SKY', 'SLAVE', 'SLEEP', 'SLICE', 'SLIDE', 'SLIGHT', 'SLIGHTLY',
  'SLIP', 'SLOW', 'SLOWLY', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMOKE',
  'SMOOTH', 'SNAKE', 'SNOW', 'SO', 'SOAP', 'SOCCER', 'SOCIAL', 'SOCIETY',
  'SOFT', 'SOFTWARE', 'SOIL', 'SOLAR', 'SOLD', 'SOLDIER', 'SOLID', 'SOLUTION',
  'SOLVE', 'SOME', 'SOMEBODY', 'SOMEHOW', 'SOMEONE', 'SOMETHING', 'SOMETIMES', 'SOMEWHAT',
  'SOMEWHERE', 'SON', 'SONG', 'SOON', 'SORRY', 'SORT', 'SOUL', 'SOUND',
  'SOUP', 'SOURCE', 'SOUTH', 'SOUTHERN', 'SPACE', 'SPANISH', 'SPARE', 'SPEAK',
  'SPEAKER', 'SPECIAL', 'SPECIALLY', 'SPECIES', 'SPECIFIC', 'SPECIFICALLY', 'SPEECH', 'SPEED',
  'SPELL', 'SPEND', 'SPENDING', 'SPIN', 'SPIRIT', 'SPIRITUAL', 'SPLIT', 'SPOKE',
  'SPOKEN', 'SPORT', 'SPOT', 'SPREAD', 'SPRING', 'SQUARE', 'SQUEEZE', 'STABLE',
  'STAFF', 'STAGE', 'STAIR', 'STAKE', 'STAND', 'STANDARD', 'STANDING', 'STAR',
  'STARE', 'START', 'STATE', 'STATEMENT', 'STATION', 'STATISTICS', 'STATUE', 'STATUS',
  'STAY', 'STEADY', 'STEAK', 'STEAL', 'STEAM', 'STEEL', 'STEP', 'STICK',
  'STILL', 'STIR', 'STOCK', 'STOMACH', 'STONE', 'STOOD', 'STOP', 'STORAGE',
  'STORE', 'STORM', 'STORY', 'STRAIGHT', 'STRANGE', 'STRANGER', 'STRATEGIC', 'STRATEGY',
  'STREAM', 'STREET', 'STRENGTH', 'STRESS', 'STRETCH', 'STRIKE', 'STRING', 'STRIP',
  'STRONG', 'STRONGLY', 'STRUCTURE', 'STRUGGLE', 'STUCK', 'STUDENT', 'STUDIO', 'STUDY',
  'STUFF', 'STUPID', 'STYLE', 'SUBJECT', 'SUBMIT', 'SUBSEQUENT', 'SUBSTANCE', 'SUBSTANTIAL',
  'SUCCEED', 'SUCCESS', 'SUCCESSFUL', 'SUCCESSFULLY', 'SUCH', 'SUDDEN', 'SUDDENLY', 'SUFFER',
  'SUFFICIENT', 'SUGAR', 'SUGGEST', 'SUGGESTION', 'SUIT', 'SUMMER', 'SUM', 'SUN',
  'SUNDAY', 'SUNLIGHT', 'SUNNY', 'SUPER', 'SUPPLY', 'SUPPORT', 'SUPPORTER', 'SUPPOSE',
  'SUPPOSED', 'SUPPOSEDLY', 'SURE', 'SURELY', 'SURFACE', 'SURGEON', 'SURGERY', 'SURPRISE',
  'SURPRISED', 'SURPRISING', 'SURPRISINGLY', 'SURROUND', 'SURROUNDING', 'SURVEY', 'SURVIVAL', 'SURVIVE',
  'SURVIVOR', 'SUSPECT', 'SUSPEND', 'SUSTAIN', 'SWEAR', 'SWEEP', 'SWEET', 'SWIM',
  'SWING', 'SWITCH', 'SYMBOL', 'SYMPTOM', 'SYSTEM', 'TABLE', 'TABLESPOON', 'TACTIC',
  'TAIL', 'TAKE', 'TALE', 'TALENT', 'TALK', 'TALL', 'TANK', 'TAP',
  'TAPE', 'TARGET', 'TASK', 'TASTE', 'TAX', 'TAXI', 'TEA', 'TEACH',
  'TEACHER', 'TEAM', 'TEAR', 'TEASPOON', 'TECHNICAL', 'TECHNIQUE', 'TECHNOLOGY', 'TEEN',
  'TELEPHONE', 'TELL', 'TEMPERATURE', 'TEMPLE', 'TEMPORARY', 'TEN', 'TEND', 'TENDENCY',
  'TENNIS', 'TENSION', 'TENT', 'TERM', 'TERMS', 'TERRIBLE', 'TERRITORY', 'TERROR',
  'TERRORISM', 'TERRORIST', 'TEST', 'TESTIFY', 'TESTIMONY', 'TESTING', 'TEXT', 'THAN',
  'THANK', 'THANKS', 'THAT', 'THE', 'THEATER', 'THEIR', 'THEM', 'THEME',
  'THEMSELVES', 'THEN', 'THEORY', 'THERAPY', 'THERE', 'THEREFORE', 'THESE', 'THEY',
  'THICK', 'THIN', 'THING', 'THINK', 'THINKING', 'THIRD', 'THIRTY', 'THIS',
  'THOSE', 'THOUGH', 'THOUGHT', 'THOUSAND', 'THREAT', 'THREATEN', 'THREE', 'THROAT',
  'THROUGH', 'THROUGHOUT', 'THROW', 'THUMB', 'THUS', 'TICKET', 'TIDE', 'TIE',
  'TIGHT', 'TILL', 'TIME', 'TINY', 'TIP', 'TIRED', 'TISSUE', 'TITLE',
  'TO', 'TOBACCO', 'TODAY', 'TOE', 'TOGETHER', 'TOILET', 'TOLERANCE', 'TOLERATE',
  'TOLL', 'TOMORROW', 'TONE', 'TONGUE', 'TONIGHT', 'TOO', 'TOOL', 'TOOTH',
  'TOP', 'TOPIC', 'TOSS', 'TOTAL', 'TOTALLY', 'TOUCH', 'TOUGH', 'TOUR',
  'TOURIST', 'TOURNAMENT', 'TOWARD', 'TOWARDS', 'TOWEL', 'TOWER', 'TOWN', 'TOY',
  'TRACE', 'TRACK', 'TRADE', 'TRADITION', 'TRADITIONAL', 'TRAFFIC', 'TRAGEDY', 'TRAIL',
  'TRAIN', 'TRAINING', 'TRANSFER', 'TRANSFORM', 'TRANSFORMATION', 'TRANSITION', 'TRANSLATE', 'TRANSPORTATION',
  'TRAP', 'TRASH', 'TRAVEL', 'TREAT', 'TREATMENT', 'TREATY', 'TREE', 'TREMENDOUS',
  'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TRIP', 'TROOP', 'TROUBLE',
  'TRUCK', 'TRUE', 'TRULY', 'TRUST', 'TRUTH', 'TRY', 'TUBE', 'TUNE',
  'TUNNEL', 'TURN', 'TV', 'TWELVE', 'TWENTY', 'TWICE', 'TWIN', 'TWO',
  'TYPE', 'TYPICAL', 'TYPICALLY', 'UGLY', 'ULTIMATE', 'ULTIMATELY', 'UNABLE', 'UNANIMOUS',
  'UNCLE', 'UNDER', 'UNDERGO', 'UNDERSTAND', 'UNDERSTANDING', 'UNDERTAKE', 'UNEMPLOYMENT', 'UNEXPECTED',
  'UNFORTUNATELY', 'UNION', 'UNIQUE', 'UNIT', 'UNITED', 'UNIVERSAL', 'UNIVERSE', 'UNIVERSITY',
  'UNKNOWN', 'UNLESS', 'UNLIKE', 'UNLIKELY', 'UNTIL', 'UNUSUAL', 'UP', 'UPON',
  'UPPER', 'URBAN', 'URGE', 'US', 'USE', 'USED', 'USEFUL', 'USER',
  'USUAL', 'USUALLY', 'UTILITY', 'UTILIZE', 'VACATION', 'VALLEY', 'VALUABLE', 'VALUE',
  'VARIABLE', 'VARIATION', 'VARIETY', 'VARIOUS', 'VAST', 'VEGETABLE', 'VEHICLE', 'VENDOR',
  'VERSION', 'VERSUS', 'VERY', 'VESSEL', 'VETERAN', 'VIA', 'VICTIM', 'VICTORY',
  'VIDEO', 'VIEW', 'VIEWER', 'VILLAGE', 'VIOLATE', 'VIOLATION', 'VIOLENCE', 'VIOLENT',
  'VIRTUALLY', 'VIRTUE', 'VIRUS', 'VISIBLE', 'VISION', 'VISIT', 'VISITOR', 'VISUAL',
  'VITAL', 'VOCABULARY', 'VOICE', 'VOLUME', 'VOLUNTARY', 'VOLUNTEER', 'VOTE', 'VOTER',
  'VS', 'VULNERABLE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WANDER',
  'WANT', 'WAR', 'WARD', 'WAREHOUSE', 'WARM', 'WARN', 'WARNING', 'WARRANT',
  'WARRIOR', 'WASH', 'WASTE', 'WATCH', 'WATER', 'WAVE', 'WAY', 'WE',
  'WEAK', 'WEALTH', 'WEAPON', 'WEAR', 'WEATHER', 'WEDDING', 'WEEK', 'WEEKEND',
  'WEEKLY', 'WEIGH', 'WEIGHT', 'WELCOME', 'WELFARE', 'WELL', 'WENT', 'WERE',
  'WEST', 'WESTERN', 'WHAT', 'WHATEVER', 'WHEEL', 'WHEN', 'WHENEVER', 'WHERE',
  'WHEREAS', 'WHETHER', 'WHICH', 'WHILE', 'WHIP', 'WHISPER', 'WHITE', 'WHO',
  'WHOLE', 'WHOM', 'WHOSE', 'WHY', 'WIDE', 'WIDELY', 'WIFE', 'WILD',
  'WILL', 'WILLING', 'WIN', 'WIND', 'WINDOW', 'WINE', 'WING', 'WINNER',
  'WINTER', 'WIPE', 'WIRE', 'WISDOM', 'WISE', 'WISH', 'WITH', 'WITHDRAW',
  'WITHIN', 'WITHOUT', 'WITNESS', 'WOMAN', 'WONDER', 'WONDERFUL', 'WOOD', 'WOODEN',
  'WORD', 'WORK', 'WORKER', 'WORKING', 'WORKS', 'WORKSHOP', 'WORLD', 'WORRIED',
  'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD', 'WRAP', 'WRITE', 'WRITER',
  'WRITING', 'WRITTEN', 'WRONG', 'WROTE', 'YARD', 'YEAH', 'YEAR', 'YELLOW',
  'YES', 'YESTERDAY', 'YET', 'YIELD', 'YOU', 'YOUNG', 'YOUR', 'YOURS',
  'YOURSELF', 'YOUTH', 'ZONE'
];

// Minimal valid template: CAT, AT, ATE
// CAT across (0,0): C(0,1), A(0,2), T(0,3)
// AT right-down (0,1): A(0,2), T(1,2) - crosses CAT at (0,2) = A matches A ✓
// ATE across (1,0): A(1,1), T(1,2), E(1,3) - crosses AT at (1,2) = T matches T ✓
const SIMPLE_PUZZLE: Puzzle = {
  title: "Minimal Template",
  difficulty: Difficulty.EASY,
  category: "Daily Life",
  grid: { rows: 3, cols: 4 },
  clues: [
    { number: 1, direction: 'across', clue: 'Feline', answer: 'CAT', enumeration: [3], startRow: 0, startCol: 0 },
    { number: 2, direction: 'across', clue: 'Preposition', answer: 'AT', enumeration: [2], startRow: 1, startCol: 0 },
    { number: 3, direction: 'across', clue: 'Consumed', answer: 'ATE', enumeration: [3], startRow: 2, startCol: 0 }
  ],
  estimatedTime: 30,
  coinReward: 5
};

const GOOD_EXAMPLE_PUZZLE: Puzzle = {
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
};

// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private templates: GridTemplate[] = [];
  
  constructor() {
    // Build word index for fast lookups
    this.wordIndex = buildCrossingIndex(WORD_LIST);
  }
  
  /**
   * Add a template from an existing puzzle
   */
  addTemplateFromPuzzle(puzzle: Puzzle): void {
    const template = createTemplateFromPuzzle(puzzle);
    this.templates.push(template);
    console.log(`Added template: ${template.name} (${template.slots.length} slots)`);
  }
  
  /**
   * Add simple template for easier generation
   */
  addSimpleTemplate(): void {
    this.addTemplateFromPuzzle(SIMPLE_PUZZLE);
  }
  
  /**
   * Generate a puzzle variant from a template
   */
  generateFromTemplate(
    templateIndex: number = 0,
    config: {
      title: string;
      difficulty: Difficulty;
      category: string;
    }
  ): Puzzle | null {
    if (templateIndex >= this.templates.length) {
      throw new Error(`Template index ${templateIndex} out of bounds`);
    }
    
    const template = this.templates[templateIndex];
    
    // Solve the grid with increased attempts and allow word reuse
    // Try with word reuse first (easier), then without if needed
    let result = solveGrid(template, this.wordIndex, {
      maxAttempts: 100000, // Increased further
      shuffleWords: true,
      preferCommonWords: true,
      allowWordReuse: true // Allow words to be reused if needed
    });
    
    // If that fails, try without word reuse (more variety but harder)
    if (!result) {
      console.log(`  🔄 Retrying without word reuse...`);
      result = solveGrid(template, this.wordIndex, {
        maxAttempts: 100000,
        shuffleWords: true,
        preferCommonWords: true,
        allowWordReuse: false
      });
    }
    
    if (!result) {
      console.log(`Failed to generate puzzle variant (template: ${template.name}, slots: ${template.slots.length})`);
      return null;
    }
    
    // Create clue database
    const clueDb: ClueDatabase = {
      getClue: (word: string, difficulty: Difficulty) => getClue(word, difficulty)
    };
    
    // Build the puzzle
    const puzzle = generatePuzzleFromGrid(
      template,
      result,
      clueDb,
      {
      title: config.title,
      difficulty: config.difficulty,
      category: config.category,
      estimatedTime: config.difficulty === Difficulty.EASY ? 60 : 
                     config.difficulty === Difficulty.MEDIUM ? 90 : 120,
      coinReward: config.difficulty === Difficulty.EASY ? 10 :
                    config.difficulty === Difficulty.MEDIUM ? 15 : 20
      }
    );
    
    return puzzle;
  }
  
  /**
   * Generate multiple puzzle variants
   */
  generateBatch(
    count: number,
    config: {
      difficulty: Difficulty;
      category: string;
      titlePrefix: string;
    }
  ): Puzzle[] {
    const puzzles: Puzzle[] = [];
    let attempts = 0;
    const maxAttempts = count * 20; // Increased from count * 5
    
    while (puzzles.length < count && attempts < maxAttempts) {
      attempts++;
      
      const templateIndex = Math.floor(Math.random() * this.templates.length);
      const puzzle = this.generateFromTemplate(templateIndex, {
        title: `${config.titlePrefix} #${puzzles.length + 1}`,
        difficulty: config.difficulty,
        category: config.category
      });
      
      if (puzzle) {
        puzzles.push(puzzle);
        console.log(`Generated puzzle ${puzzles.length}/${count}`);
      } else if (attempts % 10 === 0) {
        // Log progress every 10 attempts
        console.log(`Attempt ${attempts}/${maxAttempts}...`);
      }
    }
    
    console.log(`Generated ${puzzles.length} puzzles in ${attempts} attempts`);
    if (puzzles.length < count) {
      console.log(`⚠️  Warning: Only generated ${puzzles.length} out of ${count} requested puzzles`);
    }
    return puzzles;
  }
}

/**
 * Generate puzzles using the generator
 * This function can be called from seedPuzzles.ts
 */
export function generatePuzzles(
  count: number = 20,
  config: {
    difficulty?: Difficulty;
    category?: string;
    titlePrefix?: string;
  } = {}
): Puzzle[] {
  console.log('='.repeat(60));
  console.log('Swedish Arrow Crossword Puzzle Generator');
  console.log('='.repeat(60));
  
  // Create generator
  const generator = new PuzzleGenerator();
  
  // Add simple template first (easier to solve)
  generator.addSimpleTemplate();
  
  // Also add the complex template as a fallback
  // generator.addTemplateFromPuzzle(GOOD_EXAMPLE_PUZZLE);
  
  const puzzles: Puzzle[] = [];
  puzzles.push(...generator.generateBatch(count, {
    difficulty: config.difficulty || Difficulty.EASY,
    category: config.category || 'Daily Life',
    titlePrefix: config.titlePrefix || 'Generated Puzzle'
  }));
  // Output results
  console.log('\n' + '='.repeat(60));
  console.log(`Generated ${puzzles.length} Puzzles:`);
  console.log('='.repeat(60));
  
  for (const puzzle of puzzles) {
    console.log(`  ✓ ${puzzle.title}: ${puzzle.grid.rows}x${puzzle.grid.cols}, ${puzzle.clues.length} clues`);
  }
  
  return puzzles;
}

export { GOOD_EXAMPLE_PUZZLE, SIMPLE_PUZZLE, WORD_LIST, getClue };