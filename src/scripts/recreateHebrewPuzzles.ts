/**
 * Recreate all Hebrew dailies, packages, and multiplayer puzzles from the
 * current clue database. English content is left untouched.
 *
 * Usage: npx ts-node src/scripts/recreateHebrewPuzzles.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'child_process';
import { connectToDatabase, handleScriptError, clearPuzzlesForLanguage } from './utils/scriptUtils';

dotenv.config();

function runScript(script: string, extraArgs: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['ts-node', script, ...extraArgs],
      { stdio: 'inherit', cwd: process.cwd(), env: process.env }
    );
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

const main = async () => {
  try {
    await connectToDatabase();
    await clearPuzzlesForLanguage('he');
    await mongoose.connection.close();

    console.log('\n📦 Seeding Hebrew packages...\n');
    await runScript('src/scripts/seedPackages.ts', ['--lang', 'he']);

    console.log('\n📅 Seeding Hebrew dailies (60 days from today)...\n');
    await runScript('src/scripts/seedHebrewDailies60.ts');

    console.log('\n🎮 Seeding Hebrew multiplayer...\n');
    await runScript('src/scripts/seedMultiplayer.ts', ['--lang', 'he']);

    console.log('\n✅ Hebrew puzzles recreated.');
    process.exit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
