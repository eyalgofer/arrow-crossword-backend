import { applyHebrewFinalForms } from '../scripts/core/hebrewOrthography';

/** Compare submitted answers the same way stored puzzle answers are normalized. */
export function normalizeAnswer(word: string): string {
  return applyHebrewFinalForms(word.replace(/\s+/g, '').toUpperCase());
}

/** False when either side is missing. Never throws on a bad puzzle item. */
export function answersMatch(submitted: unknown, expected: unknown): boolean {
  if (typeof submitted !== 'string' || typeof expected !== 'string' || expected.trim().length === 0) {
    return false;
  }
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}
