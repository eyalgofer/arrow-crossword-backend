import { applyHebrewFinalForms } from '../scripts/core/hebrewOrthography';

/** Compare submitted answers the same way stored puzzle answers are normalized. */
export function normalizeAnswer(word: string): string {
  return applyHebrewFinalForms(word.replace(/\s+/g, '').toUpperCase());
}

export function answersMatch(submitted: string, expected: string): boolean {
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}
