/**
 * Hebrew letterform helpers.
 *
 * Stored answers use final forms (ך/ם/ן/ף/ץ) on the last letter, because
 * players type those forms. Grid *fill* folds finals back to regular forms
 * (כ/מ/נ/פ/צ) so a word-final ם can still cross a mid-word מ.
 */

const FINAL_FORMS: Record<string, string> = {
  'כ': 'ך',
  'מ': 'ם',
  'נ': 'ן',
  'פ': 'ף',
  'צ': 'ץ',
};

const REGULAR_FORMS: Record<string, string> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
};

/** Map ך/ם/ן/ף/ץ to כ/מ/נ/פ/צ so crossing cells can match. */
export function foldHebrewLetter(ch: string): string {
  return REGULAR_FORMS[ch] ?? ch;
}

/**
 * Regular forms inside the word, final form on the last letter.
 * Non-Hebrew text is returned unchanged.
 */
export function applyHebrewFinalForms(word: string): string {
  if (!word) return word;
  const chars = Array.from(word).map(ch => REGULAR_FORMS[ch] ?? ch);
  const last = chars.length - 1;
  if (last >= 0 && FINAL_FORMS[chars[last]]) {
    chars[last] = FINAL_FORMS[chars[last]];
  }
  return chars.join('');
}
