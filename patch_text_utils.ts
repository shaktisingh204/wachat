import { readFileSync, writeFileSync } from 'fs';

const p = 'src/lib/seo-tools/text-utils.ts';
let content = readFileSync(p, 'utf-8');

const ngramDensityFunc = `

export function ngramDensity(text: string, n: number = 1): { word: string; count: number; density: number }[] {
  const words = text.toLowerCase().match(/\\b[a-z]{2,}\\b/g) || [];
  if (words.length < n) return [];
  
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  
  const total = ngrams.length;
  if (!total) return [];
  
  const counts = new Map<string, number>();
  for (const gram of ngrams) counts.set(gram, (counts.get(gram) || 0) + 1);
  
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count, density: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}
`;

content += ngramDensityFunc;

writeFileSync(p, content, 'utf-8');
console.log('patched');
