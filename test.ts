import { test } from 'node:test';
// I will just copy the relevant functions and run them.

function levenshteinSimilarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length === 0 && b.length === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  const dist = matrix[a.length][b.length];
  return 1 - dist / Math.max(a.length, b.length);
}

console.log(levenshteinSimilarity('running shoes', 'running shoe'));
