// PORT-NOTE: confirmation.question.ts — nest-commander @QuestionSet/@Question
// had no Next.js equivalent. This module exports a plain helper function for
// confirming destructive CLI operations in a Node.js script context.

import * as readline from 'readline';

const CONFIRMATION_MESSAGE =
  "You are about to delete data from the database. Are you sure you want to continue? Consider the '--dry-run' option first (y/N): ";

/**
 * Prompts the user to confirm a destructive operation via stdin.
 * Returns true if the user answers 'y' or 'yes' (case-insensitive).
 */
export async function askForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(CONFIRMATION_MESSAGE, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * Parses a raw string answer to a boolean (truthy strings: 'y', 'yes', 'true', '1').
 */
export function parseConfirm(val: string): boolean {
  return ['y', 'yes', 'true', '1'].includes(val.trim().toLowerCase());
}
