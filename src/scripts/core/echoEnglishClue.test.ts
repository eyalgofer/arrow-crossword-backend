import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEchoEnglishClue } from './echoEnglishClue';

describe('isEchoEnglishClue', () => {
  it('flags Latin spellings of the Hebrew answer', () => {
    const echoes: Array<[string, string]> = [
      ['לגו', 'Lego'],
      ['סקי', 'Ski'],
      ['סקי', 'Skiing'],
      ['דקל', 'Dekel'],
      ['אביב', 'Aviv'],
      ['דבש', 'Dvash'],
      ['שמש', 'Shemesh'],
      ['פיצה', 'Pizza?'],
      ['שוקולד', 'Chocolate'],
      ['ויסקי', 'Whisky'],
      ['אגד', 'Egged'],
      ['אגסי', 'Agassi'],
      ['בנק', 'Bank'],
      ['היסטוריה', 'History'],
      ['גיטרה', 'Guitar'],
      ['דלק', 'DELEK'],
      ['זאב', 'ZEEV'],
      ['שביל החלב', 'Shvil Hahalav'],
      ['בני עקיבא', 'Bnei Akiva'],
      ['וינו', 'Vino (loanword)'],
    ];
    for (const [answer, clue] of echoes) {
      assert.equal(isEchoEnglishClue(answer, clue), true, `${clue} / ${answer}`);
    }
  });

  it('keeps real translations, including ones that only sound related', () => {
    const keepers: Array<[string, string]> = [
      ['אב', 'Father'],
      ['טלפון', 'Phone'],
      ['פירות', 'Fruit'],
      ['אהבה', 'Love'],
      ['אגוז', 'Nut'],
      ['הולך', 'Walking'],
      ['קפיצה', 'Jumping'],
      ['הוא', 'He (male pronoun)'],
      ['המופיליה', 'Hemophilia (blood disorder)'],
      ['וינו', 'Wine (loanword)'],
    ];
    for (const [answer, clue] of keepers) {
      assert.equal(isEchoEnglishClue(answer, clue), false, `${clue} / ${answer}`);
    }
  });
});
