// Pure text utilities used across the Text & Content SEO tools.

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?\n]+[.!?]+/g);
  return matches ? matches.length : text.trim() ? 1 : 0;
}

export function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export function readingTimeMinutes(text: string, wpm = 200): number {
  const words = countWords(text);
  return Math.max(1, Math.round(words / wpm));
}

// Flesch Reading Ease — higher is easier to read.
export function fleschReadingEase(text: string): number {
  const words = countWords(text);
  const sentences = Math.max(1, countSentences(text));
  const syllables = countSyllables(text);
  if (!words) return 0;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function fleschKincaidGrade(text: string): number {
  const words = countWords(text);
  const sentences = Math.max(1, countSentences(text));
  const syllables = countSyllables(text);
  if (!words) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

export function countSyllables(text: string): number {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc, word) => acc + syllableCount(word), 0);
}

function syllableCount(word: string): number {
  word = word.replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function keywordDensity(text: string): { word: string; count: number; density: number }[] {
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  const total = words.length;
  if (!total) return [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count, density: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function toTitleCase(text: string): string {
  return text.replace(
    /\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}

export function toSentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
}

export function toCamelCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
}

export function removeExtraSpaces(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function removeLineBreaks(text: string): string {
  return text.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function removeDuplicateLines(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out.join('\n');
}

export function reverseWords(text: string): string {
  return text.split(/\s+/).reverse().join(' ');
}

export function reverseCharacters(text: string): string {
  return text.split('').reverse().join('');
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

export interface HtmlToTextOptions {
  preserveNewlines?: boolean;
  ignoreHiddenElements?: boolean;
  decodeEntities?: boolean;
}

export function htmlToText(html: string, options: HtmlToTextOptions = {}): string {
  const { preserveNewlines = true, ignoreHiddenElements = true, decodeEntities = true } = options;

  let result = html;

  if (ignoreHiddenElements) {
    result = result.replace(/<[^>]+style\s*=\s*['"][^'"]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^'"]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi, '');
    result = result.replace(/<input[^>]+type\s*=\s*['"]hidden['"][^>]*>/gi, '');
  }

  result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '');

  if (preserveNewlines) {
    result = result.replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n');
    result = result.replace(/<br\s*\/?>/gi, '\n');
  } else {
    result = result.replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, ' ');
    result = result.replace(/<br\s*\/?>/gi, ' ');
  }

  result = result.replace(/<\/?[^>]+>/g, '');

  if (!preserveNewlines) {
    result = result.replace(/\n+/g, ' ');
  }

  if (decodeEntities) {
    result = result
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&cent;/gi, '¢')
      .replace(/&pound;/gi, '£')
      .replace(/&yen;/gi, '¥')
      .replace(/&euro;/gi, '€')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  } else {
    // If not decoding entities, still maybe do minimal decoding, or leave them.
    // The previous implementation did minimal decoding implicitly, but with explicit decodeEntities = false, we might want to preserve them.
    // We'll leave them as is if decodeEntities is false, to fully respect the flag.
  }

  if (preserveNewlines) {
    result = result
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    result = result.replace(/\s+/g, ' ');
  }

  return result.trim();
}

export function wordFrequency(text: string, top = 50): { word: string; count: number }[] {
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

export function diffLines(a: string, b: string): { left: string | null; right: string | null; equal: boolean }[] {
  // Very small line-by-line diff, good enough for side-by-side presentation.
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const max = Math.max(aLines.length, bLines.length);
  const rows: { left: string | null; right: string | null; equal: boolean }[] = [];
  for (let i = 0; i < max; i++) {
    const left = i < aLines.length ? aLines[i] : null;
    const right = i < bLines.length ? bLines[i] : null;
    rows.push({ left, right, equal: left === right });
  }
  return rows;
}


export function ngramDensity(text: string, n: number = 1): { word: string; count: number; density: number }[] {
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
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
