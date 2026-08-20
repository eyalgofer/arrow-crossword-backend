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

function runSeed(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['ts-node', script, '--lang', 'he'],
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
    await runSeed('src/scripts/seedPackages.ts');

    console.log('\n📅 Seeding Hebrew dailies...\n');
    await runSeed('src/scripts/seedDaily.ts');

    console.log('\n🎮 Seeding Hebrew multiplayer...\n');
    await runSeed('src/scripts/seedMultiplayer.ts');

    console.log('\n✅ Hebrew puzzles recreated.');
    process.exit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
