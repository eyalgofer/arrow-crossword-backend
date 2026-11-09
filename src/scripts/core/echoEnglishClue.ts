/**
 * English glosses that are only a Latin reading of the Hebrew answer.
 * Solvers can copy the sounds into Hebrew letters, so these are not vocab clues.
 * A parenthetical definition ("Hemophilia (blood disorder)") keeps the clue.
 */

/** One Hebrew letter, as a chunk of a Latin reading. Final ה is handled separately. */
const LETTER_READING: Record<string, string> = {
  א: '(?:a|e|i|o|u)?',
  ע: '(?:a|e|i|o|u)?',
  ב: '(?:bb|b|vv|v)',
  ג: '(?:gg|g|j)',
  ד: '(?:dd|d|t)',
  ה: '(?:h|a|e)',
  ו: '(?:vv|v|w|oo|o|u)',
  ז: '(?:zz|z|s)',
  ח: '(?:ch|kh|h)',
  ט: '(?:tt|t|th)',
  י: '(?:y|ee|i|e)',
  כ: '(?:ch|kh|ck|k|c)',
  ך: '(?:ch|kh|k)',
  ל: 'l+',
  מ: 'mm|m',
  ם: 'm',
  נ: 'nn|n',
  ן: 'n',
  ס: 's+',
  פ: '(?:pp|p|ff|f|ph)',
  ף: '(?:ff|f|p|ph)',
  צ: '(?:tz|ts|zz|z|c)',
  ץ: '(?:tz|ts|z)',
  ק: '(?:ck|k|q|c)',
  ר: 'r+',
  ש: '(?:sh|sch|ch|ss|s)',
  ת: '(?:tt|t|th|s)',
};

/** Parentheticals that add no definition, only a tag. */
const EMPTY_LABEL =
  /^(loanwords?|english loans?|english loanwords?|slangs?|spoken language|in slang|abbr\.?|abbreviations?)$/i;

function hebrewLetters(text: string): string[] {
  return [...text].filter((ch) => LETTER_READING[ch] !== undefined);
}

function readingPattern(hebrew: string): RegExp | null {
  const letters = hebrewLetters(hebrew);
  if (letters.length < 2) return null;
  const parts = letters.map((ch, index) => {
    if (ch === 'ה' && index === letters.length - 1) return '(?:h|a|e)?';
    return `(?:${LETTER_READING[ch]})`;
  });
  return new RegExp(`^${parts.join('[aeiouy]{0,2}')}e?$`, 'i');
}

function isEmptyLabel(note: string): boolean {
  return EMPTY_LABEL.test(note) || /\bloan\b/i.test(note);
}

/** Clue text with punctuation and empty tags removed. A real parenthetical sets hasDefinition. */
export function echoClueHead(clue: string): { head: string; hasDefinition: boolean } {
  const notes: string[] = [];
  const stripped = clue.replace(/\(([^)]*)\)/g, (_match, inner: string) => {
    notes.push(inner.trim());
    return ' ';
  });
  const head = stripped
    .replace(/[?!.]+/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/['’"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    head,
    hasDefinition: notes.some((note) => note.length > 0 && !isEmptyLabel(note)),
  };
}

function stems(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (w.endsWith('ing') && w.length > 5) out.push(w.slice(0, -3));
  if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) out.push(w.slice(0, -1));
  return out;
}

function readsAs(hebrew: string, latin: string): boolean {
  const pattern = readingPattern(hebrew);
  if (!pattern) return false;
  return stems(latin).some((stem) => pattern.test(stem.replace(/^wh/i, 'w')));
}

/**
 * True when the clue is only a Latin spelling of the Hebrew answer
 * (optionally plus an empty tag like "(loanword)").
 */
export function isEchoEnglishClue(answer: string, clue: string): boolean {
  const { head, hasDefinition } = echoClueHead(clue);
  if (!head || hasDefinition) return false;

  const compactAnswer = hebrewLetters(answer).join('');
  const compactClue = head.replace(/\s+/g, '');
  if (readsAs(compactAnswer, compactClue)) return true;

  const hebrewWords = answer.split(/\s+/).filter((word) => hebrewLetters(word).length >= 2);
  const englishWords = head.split(/\s+/).filter(Boolean);
  if (hebrewWords.length < 2 || hebrewWords.length !== englishWords.length) return false;
  return hebrewWords.every((word, index) => readsAs(word, englishWords[index]));
}
