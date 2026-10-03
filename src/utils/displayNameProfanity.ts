import { foldHebrewLetter } from '../scripts/core/hebrewOrthography';

/**
 * Whole nickname or whole token only. Short words are ordinary pieces of
 * longer names (Assaf, classic, אחראי, מכוסה), and a few slurs sit inside
 * harmless words (spice, cocoon).
 */
const EXACT_TERMS = [
  'ass',
  'cum',
  'fag',
  'tit',
  'fck',
  'fuk',
  'sht',
  'dck',
  'cnt',
  'kkk',
  'jap',
  'spic',
  'paki',
  'coon',
  'dyke',
  'cock',
  'wank',
  'prick',
  'piss',
  'anal',
  'זין',
  'חרא',
  'כוס',
  'תחת',
  'שיט',
  'קוק',
  'דיק',
  'פאק',
  'ביץ',
  'אנאל',
];

/** Distinctive curses and slurs. Matched inside the squeezed nickname. */
const SUBSTRING_TERMS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'pussy',
  'slut',
  'whore',
  'twat',
  'wanker',
  'jizz',
  'tits',
  'pissed',
  'pisser',
  'porn',
  'phuck',
  'fvck',
  'shyt',
  'biatch',
  'btch',
  'asshole',
  'arsehole',
  'bastard',
  'bollock',
  'douche',
  'dildo',
  'cocksuck',
  'ashole',
  'penis',
  'vagina',
  'dumbass',
  'jackass',
  'blowjob',
  'handjob',
  'cumshot',
  'nigger',
  'nigga',
  'faggot',
  'fagot',
  'retard',
  'chink',
  'kike',
  'tranny',
  'beaner',
  'gook',
  'wetback',
  'raghead',
  'nazi',
  'hitler',
  'זונה',
  'שרמוטה',
  'שרמוט',
  'שארמוטה',
  'מניאק',
  'מניוק',
  'כוסאמק',
  'כוסעמק',
  'קוסאמק',
  'קוסעמק',
  'כסאמק',
  'כוסאחת',
  'כוסית',
  'מזדיין',
  'מזדיינת',
  'מזדין',
  'קיבינימט',
  'מפגר',
  'מפגרת',
  'מטומטם',
  'מטומטמת',
  'דביל',
  'דבילה',
  'כלבה',
  'כושי',
  'נאצי',
  'היטלר',
  'ניגר',
  'פאקינג',
  'פאקר',
  'פאקיו',
  'חרמן',
  'חארות',
  'זיין',
  'יאזין',
  'יאחרא',
  'יאכוס',
  'התחת',
  'אינעל',
  'ינעל',
  'ממזר',
  'מוצץ',
  'מוצצת',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const NIKUD_OR_INVISIBLE = /[\u0591-\u05C7\u200B-\u200F\uFEFF\u2060]/;
const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const LATIN_LETTER = /[a-z]/;

function squeeze(input: string): string {
  let out = '';
  for (const ch of input) {
    const mapped = LEET[ch] ?? ch.toLocaleLowerCase();
    if (NIKUD_OR_INVISIBLE.test(mapped)) continue;
    const folded = foldHebrewLetter(mapped);
    if (HEBREW_LETTER.test(folded) || LATIN_LETTER.test(folded)) out += folded;
  }
  return out;
}

function collapseRuns(input: string): string {
  let out = '';
  let prev = '';
  for (const ch of input) {
    if (ch === prev) continue;
    out += ch;
    prev = ch;
  }
  return out;
}

function flexiblePattern(term: string): RegExp {
  const chars = Array.from(term);
  let source = '';
  for (let i = 0; i < chars.length; ) {
    let j = i + 1;
    while (j < chars.length && chars[j] === chars[i]) j += 1;
    const escaped = chars[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    source += j - i >= 2 ? `${escaped}{${j - i},}` : `${escaped}+`;
    i = j;
  }
  return new RegExp(source);
}

type ExactTerm = { squeezed: string; collapsed: string; hasDouble: boolean };

const exactTerms: ExactTerm[] = [];
for (const term of EXACT_TERMS) {
  const normalized = squeeze(term);
  if (normalized.length < 2) continue;
  exactTerms.push({
    squeezed: normalized,
    collapsed: collapseRuns(normalized),
    hasDouble: hasConsecutiveDouble(normalized),
  });
}

const substringPatterns = SUBSTRING_TERMS
  .map(squeeze)
  .filter((term) => term.length >= 4)
  .map(flexiblePattern);

function hasConsecutiveDouble(value: string): boolean {
  for (let i = 1; i < value.length; i += 1) {
    if (value[i] === value[i - 1]) return true;
  }
  return false;
}

function hasTripleRun(value: string): boolean {
  let run = 1;
  for (let i = 1; i < value.length; i += 1) {
    if (value[i] === value[i - 1]) {
      run += 1;
      if (run >= 3) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/**
 * Exact term, or the same letters stretched.
 * A single doubled letter is left alone when the term itself has no double,
 * so "Jaap" is not treated as "jap". Terms that already contain a double
 * ("ass") still catch "aass" / "asss".
 */
function matchesExact(candidate: string): boolean {
  if (!candidate) return false;
  const collapsed = collapseRuns(candidate);
  return exactTerms.some((term) => {
    if (candidate === term.squeezed) return true;
    if (collapsed !== term.collapsed || candidate === collapsed) return false;
    return term.hasDouble || hasTripleRun(candidate);
  });
}

/** True when a nickname contains an English or Hebrew slur or strong curse. */
export function containsBlockedDisplayName(name: string): boolean {
  const squeezed = squeeze(name);
  if (!squeezed) return false;
  if (matchesExact(squeezed)) return true;
  for (const token of name.split(' ')) {
    if (matchesExact(squeeze(token))) return true;
  }
  if (substringPatterns.some((pattern) => pattern.test(squeezed))) return true;
  // "f**k" / "f*k" keep no vowel and no "c", so the squeezed name is only f and k.
  return /^f+k+$/.test(squeezed);
}
