// Pure text utilities used across the Text & Content SEO tools.
import GraphemeSplitter from 'grapheme-splitter';

const splitter = new GraphemeSplitter();


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
  if (!text.trim()) return 0;
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

export function countSyllablesInWord(word: string): number {
  word = word.replace(/[^a-z]/gi, '').toLowerCase();
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function gunningFogIndex(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  
  const numSentences = Math.max(1, countSentences(text));
  const complexWords = words.filter(w => countSyllablesInWord(w) >= 3).length;
  
  return 0.4 * ((words.length / numSentences) + 100 * (complexWords / words.length));
}

export function smogIndex(text: string): number {
  const numSentences = countSentences(text);
  if (numSentences === 0) return 0;
  
  const words = text.split(/\s+/).filter(Boolean);
  const complexWords = words.filter(w => countSyllablesInWord(w) >= 3).length;
  
  return 1.0430 * Math.sqrt(complexWords * (30 / numSentences)) + 3.1291;
}

export function getSentences(text: string): string[] {
  // Simple sentence tokenizer using regex
  // Matches sentences ending with . ! ? followed by space or end of string
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches) {
    return text.trim() ? [text.trim()] : [];
  }
  return matches.map(m => m.trim()).filter(Boolean);
}

export function countSyllables(text: string): number {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc, word) => acc + countSyllablesInWord(word), 0);
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

export function toSnakeCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .join('_');
}

export function toKebabCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .join('-');
}

export function removeExtraSpaces(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function removeLineBreaks(text: string, separator: string = ' '): string {
  if (separator === ' ') {
    return text.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  return text.trim().split(/\r?\n+/).join(separator);
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
  return splitter.splitGraphemes(text).reverse().join('');
}

const flipTable: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ı', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: '𐐒', C: 'Ɔ', D: '◖', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'ʞ', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  0: '0', 1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6',
  ',': "'", '.': '˙', '?': '¿', '!': '¡', '"': '„', "'": ',', '`': ',', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '&': '℘', '_': '‾'
};

export function mirrorText(text: string): string {
  return splitter.splitGraphemes(text)
    .reverse()
    .map(char => flipTable[char] || char)
    .join('');
}

export function textToHtml(text: string): string {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Simple Markdown formatting
  // Bold
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Links
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return escaped
    .split(/\n\s*\n/)
    .map((p) => {
      // Headings
      const headingMatch = p.match(/^(#{1,6})\s+([\s\S]*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        return `<h${level}>${headingMatch[2].replace(/\n/g, '<br />')}</h${level}>`;
      }
      return `<p>${p.replace(/\n/g, '<br />')}</p>`;
    })
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

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  if (ignoreHiddenElements) {
    result = result.replace(/<[^>]+style\s*=\s*['"][^'"]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^'"]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi, '');
    result = result.replace(/<input[^>]+type\s*=\s*['"]hidden['"][^>]*>/gi, '');
  }

  // Remove elements that shouldn't contribute to text
  result = result.replace(/<(script|style|head|noscript|iframe|svg|object|embed|canvas)[^>]*>[\s\S]*?<\/\1>/gi, '');

  if (preserveNewlines) {
    // Add newlines around block elements
    result = result.replace(/<\/?(p|div|h[1-6]|ul|ol|li|tr|table|blockquote|article|section|nav|header|footer|aside)[^>]*>/gi, '\n');
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<hr\s*\/?>/gi, '\n\n');
    result = result.replace(/<\/(td|th)>/gi, '\t');
  } else {
    result = result.replace(/<\/?(p|div|h[1-6]|ul|ol|li|tr|table|blockquote|article|section|nav|header|footer|aside)[^>]*>/gi, ' ');
    result = result.replace(/<br\s*\/?>/gi, ' ');
    result = result.replace(/<hr\s*\/?>/gi, ' ');
    result = result.replace(/<\/(td|th)>/gi, ' ');
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
      .replace(/[ \t]*\n[ \t]*/g, '\n')
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

export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did',
  'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself',
  'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', 'it', "it's",
  'its', 'itself', "let's", 'me', 'more', 'most', 'my', 'myself', 'nor', 'of', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', "she'd", "she'll",
  "she's", 'should', 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've",
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', "we'd", "we'll",
  "we're", "we've", 'were', 'what', "what's", 'when', "when's", 'where', "where's", 'which', 'while',
  'who', "who's", 'whom', 'why', "why's", 'with', 'would', 'you', "you'd", "you'll", "you're", "you've",
  'your', 'yours', 'yourself', 'yourselves'
]);

export function ngramDensity(text: string, n: number = 1, filterStopwords: boolean = false): { word: string; count: number; density: number }[] {
  // Use a regex that captures words. Allow numbers as well for better SEO (e.g. "web 2.0", "top 10")
  const words = text.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
  
  const totalNgrams = words.length - n + 1;
  if (totalNgrams <= 0) return [];
  
  const ngrams: string[] = [];

  for (let i = 0; i < totalNgrams; i++) {
    const chunk = words.slice(i, i + n);
    
    // If filtering stopwords, skip any n-gram that starts or ends with a stopword.
    // For n=1, this filters if the word itself is a stopword.
    if (filterStopwords && (STOP_WORDS.has(chunk[0]) || STOP_WORDS.has(chunk[n - 1]))) {
      continue;
    }
    
    ngrams.push(chunk.join(' '));
  }
  
  if (!ngrams.length) return [];
  
  const counts = new Map<string, number>();
  for (const gram of ngrams) {
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count, density: (count / totalNgrams) * 100 }))
    .sort((a, b) => b.count - a.count);
}
