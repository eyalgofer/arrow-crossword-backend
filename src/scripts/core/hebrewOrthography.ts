/**
 * Hebrew letterform helpers.
 *
 * Players type final forms (ך/ם/ן/ף/ץ) at the end of a word and regular
 * forms (כ/מ/נ/פ/צ) everywhere else. Answer matching is per-character, so
 * stored answers and grid letters must use exactly those forms.
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
