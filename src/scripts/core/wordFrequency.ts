/**
 * Word frequency data for difficulty classification
 * Words are categorized by how common they are in everyday English
 */

// Top ~3000 most common English words (good for EASY puzzles)
// These are words most English speakers would know
const COMMON_WORDS = new Set([
  // Very common 3-4 letter words
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
  'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS',
  'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY',
  'DID', 'OWN', 'SAY', 'SHE', 'TOO', 'USE', 'ACE', 'ACT', 'ADD', 'AGE',
  'AGO', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BAD', 'BAG', 'BAR',
  'BAT', 'BED', 'BET', 'BIG', 'BIT', 'BOX', 'BUS', 'BUY', 'CAR', 'CAT',
  'CUP', 'CUT', 'DOG', 'DOT', 'DRY', 'DUE', 'EAR', 'EAT', 'EGG', 'END',
  'ERA', 'EYE', 'FAR', 'FAT', 'FEW', 'FIT', 'FLY', 'FUN', 'GAS', 'GAP',
  'GOT', 'GUN', 'GUY', 'HAT', 'HIT', 'HOT', 'ICE', 'ILL', 'JOB', 'JOY',
  'KEY', 'KID', 'LAP', 'LAW', 'LAY', 'LED', 'LEG', 'LET', 'LIE', 'LIP',
  'LOT', 'LOW', 'MAD', 'MAN', 'MAP', 'MEN', 'MET', 'MIX', 'MOM', 'MUD',
  'NET', 'NOR', 'NUT', 'ODD', 'OFF', 'OIL', 'PAN', 'PAY', 'PEN', 'PET',
  'PIE', 'PIN', 'PIT', 'POP', 'POT', 'PUT', 'RAN', 'RAT', 'RAW', 'RED',
  'RIB', 'RID', 'ROW', 'RUB', 'RUN', 'SAD', 'SAT', 'SET', 'SIT', 'SIX',
  'SKY', 'SON', 'SUN', 'TAB', 'TAX', 'TEA', 'TEN', 'TIE', 'TIP', 'TOP',
  'TOY', 'TRY', 'TWO', 'VAN', 'WAR', 'WAS', 'WET', 'WON', 'YES', 'YET',
  
  // Common 5-letter words
  'ABOUT', 'ABOVE', 'ACTOR', 'ADDED', 'AFTER', 'AGAIN', 'AGREE', 'AHEAD',
  'ALARM', 'ALBUM', 'ALIEN', 'ALIKE', 'ALIVE', 'ALLOW', 'ALONE', 'ALONG',
  'AMONG', 'ANGEL', 'ANGRY', 'APART', 'APPLE', 'APRIL', 'ARENA', 'ARGUE',
  'ARISE', 'ARMOR', 'ARRAY', 'ARROW', 'ASIDE', 'ASKED', 'ASSET', 'AVOID',
  'AWARD', 'AWARE', 'AWFUL', 'BASIC', 'BASIS', 'BEACH', 'BEGAN', 'BEGIN',
  'BEING', 'BELOW', 'BENCH', 'BIBLE', 'BIKES', 'BIRTH', 'BLACK', 'BLADE',
  'BLAME', 'BLANK', 'BLAST', 'BLEND', 'BLIND', 'BLOCK', 'BLOOD', 'BLOWN',
  'BOARD', 'BONUS', 'BOOKS', 'BOOST', 'BOOTH', 'BOUND', 'BRAIN', 'BRAND',
  'BRAVE', 'BREAD', 'BREAK', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROAD',
  'BROKE', 'BROWN', 'BRUSH', 'BUILD', 'BUILT', 'BUNCH', 'BURST', 'BUYER',
  'CABLE', 'CALLS', 'CANDY', 'CARDS', 'CARRY', 'CASES', 'CATCH', 'CAUSE',
  'CHAIN', 'CHAIR', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHECK',
  'CHEST', 'CHIEF', 'CHILD', 'CHINA', 'CHIPS', 'CHOSE', 'CIVIL', 'CLAIM',
  'CLASS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIMB', 'CLOCK', 'CLOSE',
  'CLOTH', 'CLOUD', 'COACH', 'COAST', 'COLON', 'COLOR', 'COMES', 'COUCH',
  'COULD', 'COUNT', 'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRASH', 'CRAZY',
  'CREAM', 'CREEK', 'CRIME', 'CROSS', 'CROWD', 'CROWN', 'CRUEL', 'CRUSH',
  'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DATED', 'DEALT', 'DEATH', 'DEBUT',
  'DELAY', 'DEPTH', 'DIARY', 'DIRTY', 'DISCO', 'DOING', 'DOUBT', 'DOZEN',
  'DRAFT', 'DRAIN', 'DRAMA', 'DRANK', 'DRAWN', 'DREAM', 'DRESS', 'DRIED',
  'DRILL', 'DRINK', 'DRIVE', 'DROPS', 'DROVE', 'DRUGS', 'DRUNK', 'DYING',
  'EAGER', 'EARLY', 'EARTH', 'EDGES', 'EIGHT', 'ELECT', 'ELITE', 'EMPTY',
  'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'EQUAL', 'ERROR', 'ESSAY', 'EVENT',
  'EVERY', 'EXACT', 'EXTRA', 'FACES', 'FACTS', 'FAINT', 'FAITH', 'FALSE',
  'FANCY', 'FATAL', 'FAULT', 'FAVOR', 'FENCE', 'FEVER', 'FEWER', 'FIBER',
  'FIELD', 'FIFTH', 'FIFTY', 'FIGHT', 'FILED', 'FINAL', 'FINDS', 'FIRED',
  'FIRMS', 'FIRST', 'FIXED', 'FLAME', 'FLASH', 'FLEET', 'FLESH', 'FLOAT',
  'FLOOD', 'FLOOR', 'FLOUR', 'FLUID', 'FLUSH', 'FOCUS', 'FOLKS', 'FORCE',
  'FORMS', 'FORTH', 'FORTY', 'FORUM', 'FOUND', 'FRAME', 'FRANK', 'FRAUD',
  'FRESH', 'FRONT', 'FRUIT', 'FULLY', 'FUNNY', 'GAMES', 'GATES', 'GHOST',
  'GIANT', 'GIFTS', 'GIRLS', 'GIVEN', 'GIVES', 'GLASS', 'GLORY', 'GOING',
  'GOODS', 'GRACE', 'GRADE', 'GRAIN', 'GRAND', 'GRANT', 'GRAPH', 'GRASS',
  'GRAVE', 'GREAT', 'GREEN', 'GREET', 'GROSS', 'GROUP', 'GROWN', 'GUARD',
  'GUESS', 'GUEST', 'GUIDE', 'GUILT', 'HABIT', 'HANDS', 'HAPPY', 'HARSH',
  'HEADS', 'HEARD', 'HEART', 'HEAVY', 'HELLO', 'HELPS', 'HENCE', 'HERBS',
  'HILLS', 'HIRED', 'HOLDS', 'HOLES', 'HOMES', 'HONOR', 'HOPED', 'HOPES',
  'HORSE', 'HOSTS', 'HOTEL', 'HOURS', 'HOUSE', 'HUMAN', 'HUMOR', 'IDEAL',
  'IDEAS', 'IMAGE', 'IMPLY', 'INDEX', 'INNER', 'INPUT', 'INTRO', 'ISSUE',
  'ITEMS', 'JAPAN', 'JEANS', 'JESUS', 'JOINT', 'JONES', 'JUDGE', 'JUICE',
  'KEEPS', 'KINDS', 'KINGS', 'KNIFE', 'KNOCK', 'KNOWN', 'KNOWS', 'LABEL',
  'LABOR', 'LAKES', 'LANDS', 'LARGE', 'LASER', 'LATER', 'LAUGH', 'LAYER',
  'LEADS', 'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LEGAL', 'LEMON', 'LEVEL',
  'LEWIS', 'LIGHT', 'LIKED', 'LIKES', 'LIMIT', 'LINES', 'LINKS', 'LISTS',
  'LIVED', 'LIVER', 'LIVES', 'LOCAL', 'LOGIC', 'LOOKS', 'LOOSE', 'LORDS',
  'LOSES', 'LOVED', 'LOVER', 'LOVES', 'LOWER', 'LOYAL', 'LUCKY', 'LUNCH',
  'LYING', 'MAGIC', 'MAGNET', 'MAJOR', 'MAKER', 'MAKES', 'MARCH', 'MARKS',
  'MATCH', 'MAYBE', 'MAYOR', 'MEALS', 'MEANS', 'MEANT', 'MEDIA', 'MEETS',
  'MELON', 'MERCY', 'MERIT', 'METAL', 'METER', 'MIGHT', 'MILES', 'MINDS',
  'MINOR', 'MINUS', 'MIXED', 'MODEL', 'MODES', 'MONEY', 'MONTH', 'MORAL',
  'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVED', 'MOVES', 'MOVIE', 'MUSIC',
  'NAMED', 'NAMES', 'NEEDS', 'NERVE', 'NEVER', 'NEWLY', 'NIGHT', 'NINTH',
  'NOISE', 'NONE', 'NORTH', 'NOTED', 'NOTES', 'NOVEL', 'NURSE', 'OCCUR',
  'OCEAN', 'OFFER', 'OFTEN', 'OLDER', 'OLIVE', 'OMEGA', 'ONSET', 'OPENS',
  'OPERA', 'ORBIT', 'ORDER', 'OTHER', 'OUGHT', 'OUTER', 'OWNED', 'OWNER',
  'PAGES', 'PAINT', 'PAIRS', 'PANEL', 'PANIC', 'PAPER', 'PARKS', 'PARTS',
  'PARTY', 'PASTA', 'PATCH', 'PATHS', 'PAUSE', 'PEACE', 'PEARL', 'PEERS',
  'PENNY', 'PHASE', 'PHONE', 'PHOTO', 'PIANO', 'PICKS', 'PIECE', 'PILOT',
  'PITCH', 'PIZZA', 'PLACE', 'PLAIN', 'PLANE', 'PLANS', 'PLANT', 'PLATE',
  'PLAYS', 'PLAZA', 'PLOTS', 'PLUS', 'POCKET', 'POEMS', 'POET', 'POINT',
  'POLAR', 'POLES', 'POOLS', 'PORCH', 'PORTS', 'POSED', 'POSTS', 'POUND',
  'POWER', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE',
  'PROBE', 'PROOF', 'PROUD', 'PROVE', 'PROXY', 'PULLS', 'PUNCH', 'PUPIL',
  'PURSE', 'QUEEN', 'QUEST', 'QUICK', 'QUIET', 'QUITE', 'QUOTE', 'RACES',
  'RADAR', 'RADIO', 'RAISE', 'RALLY', 'RANCH', 'RANGE', 'RAPID', 'RATED',
  'RATES', 'RATIO', 'REACH', 'REACT', 'READS', 'READY', 'REALM', 'REBEL',
  'REFER', 'REIGN', 'RELAX', 'RELY', 'REMAINS', 'REPLY', 'RESET', 'RIDGE',
  'RIFLE', 'RIGHT', 'RINGS', 'RIOTS', 'RISEN', 'RISES', 'RISKS', 'RISKY',
  'RIVAL', 'RIVER', 'ROADS', 'ROBOT', 'ROCKS', 'ROCKY', 'ROLES', 'ROMAN',
  'ROOMS', 'ROOTS', 'ROSES', 'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RUGBY',
  'RULED', 'RULER', 'RULES', 'RURAL', 'SADLY', 'SAFER', 'SAINT', 'SALAD',
  'SALES', 'SANDS', 'SANTA', 'SAUCE', 'SAVED', 'SAVES', 'SCALE', 'SCENE',
  'SCOPE', 'SCORE', 'SEATS', 'SEEDS', 'SEEKS', 'SEEMS', 'SEIZE', 'SELLS',
  'SENDS', 'SENSE', 'SERVE', 'SETUP', 'SEVEN', 'SHADE', 'SHAFT', 'SHAKE',
  'SHALL', 'SHAME', 'SHAPE', 'SHARE', 'SHARP', 'SHEEP', 'SHEER', 'SHEET',
  'SHELF', 'SHELL', 'SHIFT', 'SHINE', 'SHIPS', 'SHIRT', 'SHOCK', 'SHOES',
  'SHOOK', 'SHOOT', 'SHOPS', 'SHORE', 'SHORT', 'SHOTS', 'SHOWN', 'SHOWS',
  'SIDES', 'SIGHT', 'SIGNS', 'SILLY', 'SIMON', 'SINCE', 'SITES', 'SIXTH',
  'SIXTY', 'SIZED', 'SIZES', 'SKILL', 'SKIRT', 'SLAVE', 'SLEEP', 'SLICE',
  'SLIDE', 'SLOPE', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMITH', 'SMOKE',
  'SNAKE', 'SOLAR', 'SOLID', 'SOLVE', 'SONGS', 'SORRY', 'SORTS', 'SOULS',
  'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPEAK', 'SPEED', 'SPELL',
  'SPEND', 'SPENT', 'SPICE', 'SPINE', 'SPITE', 'SPLIT', 'SPOKE', 'SPORT',
  'SPOTS', 'SPRAY', 'SQUAD', 'STACK', 'STAFF', 'STAGE', 'STAKE', 'STAMP',
  'STAND', 'STARK', 'STARS', 'START', 'STATE', 'STAYS', 'STEAK', 'STEAL',
  'STEAM', 'STEEL', 'STEEP', 'STEMS', 'STEPS', 'STICK', 'STILL', 'STOCK',
  'STOLE', 'STONE', 'STOOD', 'STOPS', 'STORE', 'STORM', 'STORY', 'STOVE',
  'STRIP', 'STUCK', 'STUDY', 'STUFF', 'STYLE', 'SUGAR', 'SUITE', 'SUNNY',
  'SUPER', 'SWEAR', 'SWEEP', 'SWEET', 'SWIFT', 'SWING', 'SWORD', 'TABLE',
  'TAKEN', 'TAKES', 'TALES', 'TALKS', 'TAPES', 'TASTE', 'TAXES', 'TEACH',
  'TEAMS', 'TEARS', 'TEENS', 'TEETH', 'TELLS', 'TEMPO', 'TENDS', 'TENOR',
  'TENTH', 'TERMS', 'TESTS', 'TEXAS', 'TEXTS', 'THANK', 'THEFT', 'THEME',
  'THICK', 'THIEF', 'THING', 'THINK', 'THIRD', 'THOSE', 'THREE', 'THREW',
  'THROW', 'THUMB', 'TIGER', 'TIGHT', 'TIMER', 'TIMES', 'TIRED', 'TITLE',
  'TODAY', 'TOKEN', 'TONES', 'TOOLS', 'TOOTH', 'TOPIC', 'TOTAL', 'TOUCH',
  'TOUGH', 'TOURS', 'TOWER', 'TOWNS', 'TRACE', 'TRACK', 'TRADE', 'TRAIL',
  'TRAIN', 'TRAIT', 'TRASH', 'TREAT', 'TREES', 'TREND', 'TRIAL', 'TRIBE',
  'TRICK', 'TRIED', 'TRIES', 'TRIPS', 'TROOP', 'TRUCK', 'TRULY', 'TRUNK',
  'TRUST', 'TRUTH', 'TUMOR', 'TURNS', 'TUTOR', 'TWIST', 'TYPES', 'UNCLE',
  'UNDER', 'UNION', 'UNITE', 'UNITS', 'UNITY', 'UNTIL', 'UPPER', 'UPSET',
  'URBAN', 'URGED', 'USAGE', 'USERS', 'USING', 'USUAL', 'VALID', 'VALUE',
  'VAULT', 'VEGAS', 'VENUE', 'VERSE', 'VIDEO', 'VIEWS', 'VILLA', 'VIRAL',
  'VIRUS', 'VISIT', 'VITAL', 'VOCAL', 'VOICE', 'VOTED', 'VOTER', 'VOTES',
  'WAGES', 'WAGON', 'WAIST', 'WALKS', 'WALLS', 'WANTS', 'WASTE', 'WATCH',
  'WATER', 'WAVES', 'WEEKS', 'WEIRD', 'WELLS', 'WELSH', 'WHEAT', 'WHEEL',
  'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WIDER', 'WIDOW',
  'WIDTH', 'WINDS', 'WINES', 'WINGS', 'WITCH', 'WIVES', 'WOMAN', 'WOMEN',
  'WOODS', 'WORDS', 'WORKS', 'WORLD', 'WORRY', 'WORSE', 'WORST', 'WORTH',
  'WOULD', 'WOUND', 'WRIST', 'WRITE', 'WRONG', 'WROTE', 'YARDS', 'YEARS',
  'YIELD', 'YOUNG', 'YOURS', 'YOUTH', 'ZONES',

  // Common 6-7 letter words
  'ACCEPT', 'ACCESS', 'ACROSS', 'ACTION', 'ACTIVE', 'ACTUAL', 'ADDING',
  'AFRAID', 'AGENCY', 'AGENDA', 'ALMOST', 'ALWAYS', 'AMOUNT', 'ANIMAL',
  'ANNUAL', 'ANSWER', 'ANYONE', 'APPEAR', 'AROUND', 'ARRIVE', 'ARTIST',
  'ASKING', 'ATTACK', 'AUTHOR', 'BACKUP', 'BALANCE', 'BANANA', 'BATTLE',
  'BEAUTY', 'BECOME', 'BEFORE', 'BEHIND', 'BELIEF', 'BELONG', 'BETTER',
  'BEYOND', 'BIGGER', 'BOTTLE', 'BOTTOM', 'BRANCH', 'BRIDGE', 'BRIGHT',
  'BROKEN', 'BROTHER', 'BUDGET', 'BURDEN', 'BUTTER', 'BUTTON', 'BUYING',
  'CAMERA', 'CAMPUS', 'CANCEL', 'CANCER', 'CANNOT', 'CARBON', 'CAREER',
  'CARING', 'CARPET', 'CASINO', 'CASTLE', 'CASUAL', 'CENTER', 'CENTRE',
  'CHANCE', 'CHANGE', 'CHARGE', 'CHEESE', 'CHOICE', 'CHOOSE', 'CHOSEN',
  'CHURCH', 'CIRCLE', 'CITIES', 'CLAIMS', 'CLIENT', 'CLOSED', 'CLOSER',
  'CLOTHES', 'COFFEE', 'COLUMN', 'COMBAT', 'COMING', 'COMMON', 'COOKIE',
  'CORNER', 'COTTON', 'COUNTY', 'COUPLE', 'COURSE', 'COURTS', 'COUSIN',
  'CREATE', 'CREDIT', 'CRISIS', 'CUSTOM', 'DAMAGE', 'DANCER', 'DANGER',
  'DATING', 'DEALER', 'DEBATE', 'DECADE', 'DECIDE', 'DEGREE', 'DEMAND',
  'DENTAL', 'DEPEND', 'DESERT', 'DESIGN', 'DESIRE', 'DETAIL', 'DEVICE',
  'DIALOG', 'DIESEL', 'DIFFER', 'DINNER', 'DIRECT', 'DOCTOR', 'DOLLAR',
  'DOMAIN', 'DOUBLE', 'DRIVEN', 'DRIVER', 'DURING', 'EASILY', 'EATING',
  'EDITOR', 'EFFECT', 'EFFORT', 'EITHER', 'ELEVEN', 'EMERGE', 'EMPIRE',
  'ENABLE', 'ENDING', 'ENERGY', 'ENGINE', 'ENOUGH', 'ENSURE', 'ENTIRE',
  'ENTITY', 'EQUITY', 'ESCAPE', 'ESTATE', 'ETHNIC', 'EVENTS', 'EVOLVE',
  'EXCEPT', 'EXCUSE', 'EXPAND', 'EXPECT', 'EXPERT', 'EXPORT', 'EXTEND',
  'FABRIC', 'FACTOR', 'FAILED', 'FAIRLY', 'FALLEN', 'FAMILY', 'FAMOUS',
  'FARMER', 'FASTER', 'FATHER', 'FAVOUR', 'FELLOW', 'FEMALE', 'FIGURE',
  'FILING', 'FILLED', 'FILTER', 'FINALE', 'FINDER', 'FINGER', 'FINISH',
  'FISCAL', 'FLIGHT', 'FLOWER', 'FLYING', 'FOLLOW', 'FORCED', 'FOREST',
  'FORGET', 'FORMAT', 'FORMER', 'FOSSIL', 'FOUGHT', 'FOURTH', 'FRAMES',
  'FRIEND', 'FROZEN', 'FUTURE', 'GALAXY', 'GAMING', 'GARAGE', 'GARDEN',
  'GATHER', 'GENDER', 'GENIUS', 'GERMAN', 'GLOBAL', 'GOLDEN', 'GOSPEL',
  'GOTTEN', 'GROUND', 'GROWTH', 'GUILTY', 'GUITAR', 'HAMLET', 'HANDLE',
  'HAPPEN', 'HARBOR', 'HARDLY', 'HAVING', 'HEADED', 'HEADER', 'HEALTH',
  'HEARTS', 'HEATED', 'HEAVEN', 'HEIGHT', 'HELPED', 'HELPER', 'HEREBY',
  'HIDDEN', 'HIGHER', 'HIGHLY', 'HIRING', 'HOCKEY', 'HOLDER', 'HONEST',
  'HOPING', 'HORROR', 'HOSTED', 'HOTELS', 'HOUSES', 'HUNGER', 'HUNGRY',
  'HUNTER', 'HYBRID', 'IGNORE', 'IMPORT', 'IMPOSE', 'INCOME', 'INDEED',
  'INFANT', 'INJURY', 'INSIDE', 'INSIST', 'INSURE', 'INTACT', 'INTAKE',
  'INTEND', 'INTENT', 'INVEST', 'INVITE', 'ISLAND', 'ISSUES', 'ITSELF',
  'JACKET', 'JERSEY', 'JOINED', 'JOSEPH', 'JUNGLE', 'JUNIOR', 'KILLED',
  'KILLER', 'KINDLY', 'KNIGHT', 'LAPTOP', 'LARGER', 'LAUNCH', 'LAWYER',
  'LAYERS', 'LAYOUT', 'LEADER', 'LEAGUE', 'LEAVES', 'LEGACY', 'LENGTH',
  'LESSON', 'LETTER', 'LEVELS', 'LIGHTS', 'LIKELY', 'LINEAR', 'LINKED',
  'LIQUID', 'LISTEN', 'LITTLE', 'LIVING', 'LOCATE', 'LOCKED', 'LONELY',
  'LONGER', 'LOOKUP', 'LOSING', 'LOVING', 'LOWEST', 'LUXURY', 'MAIDEN',
  'MAINLY', 'MAKING', 'MANAGE', 'MANNER', 'MANUAL', 'MARGIN', 'MARINE',
  'MARKED', 'MARKET', 'MARTIN', 'MASTER', 'MATRIX', 'MATTER', 'MATURE',
  'MEDIUM', 'MEMBER', 'MEMORY', 'MENTAL', 'MENTOR', 'METHOD', 'MIDDLE',
  'MILLER', 'MINING', 'MINUTE', 'MIRROR', 'MOBILE', 'MODERN', 'MODEST',
  'MODULE', 'MOMENT', 'MONKEY', 'MOTHER', 'MOTION', 'MOSTLY', 'MOVING',
  'MURDER', 'MUSCLE', 'MUSEUM', 'MUTUAL', 'MYSELF', 'NARROW', 'NATION',
  'NATIVE', 'NATURE', 'NEARBY', 'NEARLY', 'NEEDED', 'NEURAL', 'NEWEST',
  'NIGHTS', 'NOBODY', 'NORMAL', 'NOTICE', 'NOTION', 'NUMBER', 'OBJECT',
  'OBTAIN', 'OCCUPY', 'OFFERS', 'OFFICE', 'OFFSET', 'OLDEST', 'ONLINE',
  'OPENED', 'OPENLY', 'OPPOSE', 'OPTION', 'ORANGE', 'ORIGIN', 'OTHERS',
  'OUTFIT', 'OUTPUT', 'OUTSET', 'OVER', 'OWNERS', 'PACKET', 'PALACE',
  'PANELS', 'PAPERS', 'PARADE', 'PARENT', 'PARTLY', 'PASSED', 'PASTOR',
  'PATENT', 'PATROL', 'PATRON', 'PAYING', 'PEOPLE', 'PERIOD', 'PERMIT',
  'PERSON', 'PHRASE', 'PICKED', 'PIECES', 'PLANET', 'PLANTS', 'PLASMA',
  'PLAYED', 'PLAYER', 'PLEASE', 'PLEDGE', 'PLENTY', 'POCKET', 'POETRY',
  'POINTS', 'POLICE', 'POLICY', 'POLISH', 'POOLED', 'POORLY', 'POPPER',
  'PORTAL', 'POSTER', 'POTATO', 'POUNDS', 'POWDER', 'POWERS', 'PRAYER',
  'PREFIX', 'PRETTY', 'PRICES', 'PRIEST', 'PRINCE', 'PRINTS', 'PRISON',
  'PROFIT', 'PROPER', 'PROVEN', 'PUBLIC', 'PULLED', 'PUMPED', 'PUPPET',
  'PURPLE', 'PURSUE', 'PUSHED', 'PUZZLE', 'PYTHON', 'QUEBEC', 'QUOTED',
  'RACIAL', 'RACING', 'RACISM', 'RAISED', 'RANDOM', 'RANKED', 'RARELY',
  'RATHER', 'RATING', 'READER', 'REALLY', 'REASON', 'RECALL', 'RECIPE',
  'RECORD', 'REDUCE', 'REFERS', 'REFORM', 'REFUSE', 'REGARD', 'REGIME',
  'REGION', 'REJECT', 'RELATE', 'RELIEF', 'REMAIN', 'REMAKE', 'REMOTE',
  'REMOVE', 'RENDER', 'RENTAL', 'REPAIR', 'REPEAT', 'REPLAY', 'REPORT',
  'RESCUE', 'RESIGN', 'RESIST', 'RESORT', 'RESULT', 'RETAIL', 'RETAIN',
  'RETIRE', 'RETURN', 'REVEAL', 'REVIEW', 'REWARD', 'RHYTHM', 'RIGHTS',
  'RISING', 'ROBUST', 'ROCKET', 'ROLLED', 'ROTATE', 'ROUTER', 'RUBBER',
  'RULING', 'RUNNER', 'SACRED', 'SAFETY', 'SALARY', 'SALMON', 'SAMPLE',
  'SAVING', 'SAYING', 'SCENES', 'SCHEME', 'SCHOOL', 'SCORES', 'SCREEN',
  'SCRIPT', 'SEARCH', 'SEASON', 'SECOND', 'SECRET', 'SECTOR', 'SECURE',
  'SEEING', 'SEEMED', 'SELECT', 'SELLER', 'SENATE', 'SENIOR', 'SERIES',
  'SERVER', 'SETTLE', 'SEVERE', 'SEXUAL', 'SHADOW', 'SHAPED', 'SHARES',
  'SHEETS', 'SHOULD', 'SHOWER', 'SIGNAL', 'SIGNED', 'SILENT', 'SILVER',
  'SIMPLE', 'SIMPLY', 'SINGER', 'SINGLE', 'SISTER', 'SKILLS', 'SLAVES',
  'SLIGHT', 'SLOWLY', 'SMOOTH', 'SOCCER', 'SOCIAL', 'SOCKET', 'SODIUM',
  'SOLELY', 'SOLVER', 'SORTED', 'SOUGHT', 'SOURCE', 'SOVIET', 'SPEECH',
  'SPOKEN', 'SPORTS', 'SPREAD', 'SPRING', 'SQUARE', 'STABLE', 'STAGES',
  'STARTS', 'STATED', 'STATIC', 'STATUE', 'STATUS', 'STEADY', 'STEREO',
  'STOLEN', 'STONES', 'STORED', 'STORES', 'STORMS', 'STRAIN', 'STRAND',
  'STREAM', 'STREET', 'STRESS', 'STRICT', 'STRIKE', 'STRING', 'STRONG',
  'STRUCK', 'STUDIO', 'STUPID', 'SUBMIT', 'SUBURB', 'SUDDEN', 'SUFFER',
  'SUMMER', 'SUMMIT', 'SUNDAY', 'SUNSET', 'SUPPLY', 'SURELY', 'SURVEY',
  'SWITCH', 'SYMBOL', 'SYNTAX', 'SYSTEM', 'TABLES', 'TABLET', 'TACKLE',
  'TAKING', 'TALENT', 'TALKED', 'TARGET', 'TAUGHT', 'TENNIS', 'TESTED',
  'THANKS', 'THEORY', 'THESIS', 'THINGS', 'THREAT', 'THROWN', 'TICKET',
  'TIMBER', 'TIMING', 'TISSUE', 'TITLES', 'TOPICS', 'TOWARD', 'TOWERS',
  'TRACKS', 'TRADED', 'TRADER', 'TRAGIC', 'TRAINS', 'TRAVEL', 'TREATY',
  'TRENDS', 'TRIALS', 'TRIBAL', 'TRIBES', 'TRICKS', 'TROOPS', 'TROPHY',
  'TROUBLE', 'TRUCKS', 'TURNED', 'TURTLE', 'TWELVE', 'TWENTY', 'UNABLE',
  'UNIQUE', 'UNLESS', 'UNLIKE', 'UNLOCK', 'UPDATE', 'UPLOAD', 'USEFUL',
  'VALLEY', 'VALUES', 'VARIED', 'VARIES', 'VENDOR', 'VESSEL', 'VICTIM',
  'VIDEOS', 'VIEWED', 'VIEWER', 'VIRGIN', 'VISION', 'VISITS', 'VISUAL',
  'VOLUME', 'VOTERS', 'VOTING', 'WAITED', 'WALKED', 'WALKER', 'WALLET',
  'WANTED', 'WARDEN', 'WARMTH', 'WARNED', 'WARREN', 'WASHER', 'WATERS',
  'WEALTH', 'WEAPON', 'WEEKLY', 'WEIGHT', 'WELCOM', 'WHEELS', 'WHILST',
  'WHOLLY', 'WIDELY', 'WILLED', 'WINDOW', 'WINNER', 'WINTER', 'WISDOM',
  'WISHED', 'WITHIN', 'WIZARD', 'WONDER', 'WOODEN', 'WORKER', 'WORTHY',
  'WOUNDS', 'WRITER', 'WRITES', 'YELLOW', 'YOGURT', 'ZOMBIE',
]);

// Cryptic crossword indicator words - presence suggests harder clue
const CRYPTIC_INDICATORS = new Set([
  'ABOUT', 'AROUND', 'BACK', 'BACKWARD', 'BADLY', 'BROKEN', 'CONFUSED',
  'CRAZY', 'CRYPTIC', 'DESTROYED', 'DISTURBED', 'DRUNK', 'EXPLODING',
  'MANGLED', 'MAYBE', 'MESSY', 'MIXED', 'ODD', 'OFF', 'OUT', 'PERHAPS',
  'POSSIBLY', 'RUINED', 'SCATTERED', 'SCRAMBLED', 'SHATTERED', 'SHUFFLED',
  'SILLY', 'SMASHED', 'SOMEHOW', 'SORT', 'SORTED', 'STRANGE', 'UPSET',
  'WEIRD', 'WILD', 'WRONG', 'ANAGRAM', 'REARRANGED', 'REBUILT', 'REFORMED',
  'REORDERED', 'RESHAPED', 'TWISTED', 'WANDERING', 'WRECKED',
  // Hidden word indicators
  'HELD', 'HOLDING', 'HIDES', 'HIDING', 'CONCEALED', 'CONTAINS', 'WITHIN',
  // Reversal indicators  
  'RETURNED', 'REVERSED', 'GOING BACK', 'REFLECTED', 'OVERTURNED',
  // Double definition hints
  'ALTERNATIVELY', 'DOUBLE', 'EITHER', 'ALSO',
]);

// Patterns that suggest cryptic/wordplay clues
const CRYPTIC_PATTERNS = [
  /\(wordplay\)/i,
  /\(cryptic\)/i,
  /\(anagram\)/i,
  /\breorganized?\b/i,
  /\brearranged?\b/i,
  /\bperhaps\b/i,
  /\bmaybe\b/i,
  /\bpossibly\b/i,
  /\bsomehow\b/i,
  /\bcould be\b/i,
  /\bmight be\b/i,
  /\bsort of\b/i,
  /\bin a way\b/i,
  /\bfor example\b/i,  // Often indicates misdirection
  /\bsay\b/i,          // "Say" as in "for example"
];

export type ClueDifficulty = 'easy' | 'medium' | 'hard';

export interface ClueWithDifficulty {
  clue: string;
  difficulty: ClueDifficulty;
}

/**
 * Check if a word is common (good for easy puzzles)
 */
export function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toUpperCase().replace(/\s+/g, ''));
}

/**
 * Check if a clue appears to be cryptic (harder)
 */
export function isCrypticClue(clue: string): boolean {
  const upperClue = clue.toUpperCase();
  
  // Check for cryptic patterns
  for (const pattern of CRYPTIC_PATTERNS) {
    if (pattern.test(clue)) {
      return true;
    }
  }
  
  // Check for cryptic indicator words at key positions
  const words = upperClue.split(/\s+/);
  for (const word of words) {
    // Remove punctuation for comparison
    const cleanWord = word.replace(/[^A-Z]/g, '');
    if (CRYPTIC_INDICATORS.has(cleanWord)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Classify a clue's difficulty based on multiple factors
 */
export function classifyClue(clue: string, answer: string): ClueDifficulty {
  const normalizedAnswer = answer.toUpperCase().replace(/\s+/g, '');
  
  // Factor 1: Is it a cryptic clue?
  if (isCrypticClue(clue)) {
    return 'hard';
  }
  
  // Factor 2: Clue length (very long clues are often cryptic or complex)
  if (clue.length > 80) {
    return 'hard';
  }
  
  // Factor 3: Answer length extremes
  if (normalizedAnswer.length > 10) {
    return 'hard';
  }
  
  // Factor 4: Is the answer a common word?
  if (isCommonWord(normalizedAnswer)) {
    // Common word + short/simple clue = easy
    if (clue.length < 40) {
      return 'easy';
    }
    return 'medium';
  }
  
  // Factor 5: Check for proper nouns/names (often harder - requires specific knowledge)
  // Names often have capitalized first letter in answer
  if (/^[A-Z][a-z]/.test(answer)) {
    return 'hard';
  }
  
  // Default to medium for unknown words with straightforward clues
  if (clue.length < 50) {
    return 'medium';
  }
  
  return 'hard';
}

/**
 * Get words that are suitable for a given difficulty
 */
export function getCommonWordsSet(): Set<string> {
  return COMMON_WORDS;
}
