/**
 * SabCRM — indexed full-text search — PURE helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable). Two responsibilities:
 *
 *  1. {@link buildTextQuery} — turn a raw user term into a sanitised MongoDB
 *     `$text.$search` string. Mongo's `$text` operator has its own micro-syntax
 *     (`"quoted phrase"` = exact phrase, `-token` = negation, bare tokens are
 *     OR-matched). We surface phrase quoting but defuse everything else so a
 *     hostile term can neither smuggle a negation that empties the result set
 *     nor inject unmatched quotes that the server rejects.
 *
 *  2. {@link rankSnippet} / {@link bestSnippetField} — derive a short
 *     matched-text snippet from a record's `data.*` values, the same way the
 *     command-menu surfaces a hit. Pure string work — the I/O (index + query)
 *     lives in `./text-search.server.ts`.
 *
 * Nothing here touches Mongo, the session, or `process.*`.
 */

/** Result of parsing a raw user term into the `$text` micro-syntax. */
export interface TextQuery {
  /** The string handed to `{ $text: { $search } }`. Empty → no useful query. */
  search: string;
  /** Whether ANY usable token/phrase survived sanitisation. */
  hasTerms: boolean;
  /** The plain (unquoted, un-negated) terms — used for snippet highlighting. */
  terms: string[];
  /** Exact phrases requested with double quotes (also used for highlighting). */
  phrases: string[];
}

/** A snippet of matched text with the matched span located inside it. */
export interface RankedSnippet {
  /** The trimmed window of source text containing the match. */
  text: string;
  /** Start offset of the matched span within {@link text} (−1 = none). */
  matchStart: number;
  /** Length of the matched span (0 = none). */
  matchLength: number;
}

/** Tokens shorter than this contribute nothing to a `$text` query. */
const MIN_TOKEN_LEN = 1;
/** Upper bound on tokens we forward so a giant paste can't blow up the query. */
const MAX_TOKENS = 24;
/** Default characters of context shown around a snippet match. */
const SNIPPET_RADIUS = 40;
/** Hard cap on a returned snippet so the UI never receives a wall of text. */
const MAX_SNIPPET_LEN = 160;

/**
 * Strip characters that have special meaning to Mongo's `$text` parser (or that
 * are simply noise) from a single token: leading `-` (negation), embedded
 * quotes, and the back-/forward-slashes that can break the scan. Whitespace is
 * collapsed by the tokenizer, never here.
 */
function sanitiseToken(token: string): string {
  return token
    .replace(/^[-\s]+/, '') // leading negation / whitespace
    .replace(/["'\\]/g, '') // quotes + backslash
    .trim();
}

/** Quote an exact phrase for the `$text` syntax (after stripping inner quotes). */
function quotePhrase(phrase: string): string {
  const clean = phrase.replace(/["\\]/g, '').trim();
  return clean ? `"${clean}"` : '';
}

/**
 * Parse a raw user term into a {@link TextQuery}.
 *
 * - Double-quoted runs become exact phrases (`"acme corp"` → phrase match).
 * - Everything outside quotes is split on whitespace into OR-matched tokens.
 * - Leading `-` (negation), stray quotes and backslashes are stripped so a
 *   crafted term can never negate-away every result or unbalance the quotes.
 * - Tokens are de-duplicated (case-insensitively) and capped at
 *   {@link MAX_TOKENS}.
 *
 * Never throws; an empty / quote-only / punctuation-only term yields
 * `{ search: '', hasTerms: false }`.
 */
export function buildTextQuery(term: string): TextQuery {
  const raw = typeof term === 'string' ? term : '';
  const phrases: string[] = [];
  const tokens: string[] = [];

  // Pull out "quoted phrases" first; whatever is left is free tokens.
  const phraseRe = /"([^"]+)"/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const freeText: string[] = [];
  while ((m = phraseRe.exec(raw)) !== null) {
    freeText.push(raw.slice(lastIndex, m.index));
    const phrase = m[1].trim();
    if (phrase) phrases.push(phrase);
    lastIndex = phraseRe.lastIndex;
  }
  freeText.push(raw.slice(lastIndex));

  for (const chunk of freeText) {
    for (const part of chunk.split(/\s+/)) {
      const tok = sanitiseToken(part);
      if (tok.length >= MIN_TOKEN_LEN) tokens.push(tok);
    }
  }

  // De-dupe tokens case-insensitively, preserving first-seen order.
  const seen = new Set<string>();
  const uniqTokens: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqTokens.push(t);
    if (uniqTokens.length >= MAX_TOKENS) break;
  }

  // De-dupe phrases case-insensitively too.
  const seenPhrase = new Set<string>();
  const uniqPhrases: string[] = [];
  for (const p of phrases) {
    const key = p.toLowerCase();
    if (seenPhrase.has(key)) continue;
    seenPhrase.add(key);
    uniqPhrases.push(p);
  }

  const searchParts = [
    ...uniqPhrases.map(quotePhrase).filter(Boolean),
    ...uniqTokens,
  ];
  const search = searchParts.join(' ').trim();

  return {
    search,
    hasTerms: search.length > 0,
    terms: uniqTokens,
    phrases: uniqPhrases,
  };
}

/** Escape a string for safe use inside a `RegExp` source. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the earliest case-insensitive occurrence of ANY of `needles` inside
 * `haystack`. Returns `{ index, length }` of the first match, or `null`. The
 * shortest match wins ties so highlighting hugs the term tightly.
 */
export function firstMatch(
  haystack: string,
  needles: string[],
): { index: number; length: number } | null {
  if (!haystack) return null;
  const lower = haystack.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const needle of needles) {
    const n = needle.trim().toLowerCase();
    if (!n) continue;
    const idx = lower.indexOf(n);
    if (idx === -1) continue;
    if (
      !best ||
      idx < best.index ||
      (idx === best.index && n.length < best.length)
    ) {
      best = { index: idx, length: n.length };
    }
  }
  return best;
}

/**
 * Build a short, centred snippet of `source` around the first match of any of
 * `needles`, with the matched span located inside the returned window.
 *
 * - When nothing matches, returns the leading `radius * 2` chars (an ellipsised
 *   preview) with `matchStart: -1`.
 * - Windows that don't start/end at a boundary are prefixed/suffixed with `…`,
 *   and the reported `matchStart` accounts for any leading ellipsis.
 *
 * Pure + deterministic; never throws.
 */
export function rankSnippet(
  source: string,
  needles: string[],
  radius: number = SNIPPET_RADIUS,
): RankedSnippet {
  const text = (source ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { text: '', matchStart: -1, matchLength: 0 };

  const hit = firstMatch(text, needles);
  if (!hit) {
    const head = text.slice(0, Math.min(text.length, MAX_SNIPPET_LEN));
    const suffix = text.length > head.length ? '…' : '';
    return { text: head + suffix, matchStart: -1, matchLength: 0 };
  }

  const start = Math.max(0, hit.index - radius);
  const end = Math.min(text.length, hit.index + hit.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  let window = text.slice(start, end);

  // Enforce the hard length cap (rare for long matched tokens).
  if (window.length > MAX_SNIPPET_LEN) {
    window = window.slice(0, MAX_SNIPPET_LEN);
  }

  return {
    text: prefix + window + suffix,
    matchStart: prefix.length + (hit.index - start),
    matchLength: hit.length,
  };
}

/**
 * Pick the best snippet across a record's candidate text values: prefer the
 * first value that actually contains a match; fall back to the first non-empty
 * value's preview. `values` is the ordered list of stringified searchable
 * fields (label-ish first). Returns `undefined` when there is nothing to show.
 */
export function bestSnippetField(
  values: Array<string | undefined>,
  needles: string[],
): string | undefined {
  let fallback: string | undefined;
  for (const value of values) {
    if (!value) continue;
    const snip = rankSnippet(value, needles);
    if (!snip.text) continue;
    if (snip.matchStart >= 0) return snip.text;
    if (fallback === undefined) fallback = snip.text;
  }
  return fallback;
}
