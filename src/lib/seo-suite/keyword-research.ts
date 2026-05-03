/**
 * Keyword research utilities. The real volume/CPC data is sourced from
 * external providers via the existing seo-tools API; this module provides
 * intent classification and seed expansion that can run anywhere.
 */
import type { Keyword, KeywordIntent } from './types';

const TRANSACTIONAL = [
  'buy', 'order', 'purchase', 'shop', 'price', 'pricing', 'cost', 'cheap',
  'discount', 'coupon', 'deal', 'sale', 'subscribe', 'signup', 'sign up',
];
const COMMERCIAL = [
  'best', 'top', 'review', 'reviews', 'compare', 'comparison', 'vs',
  'alternative', 'alternatives', 'rated', 'ranking',
];
const NAVIGATIONAL = [
  'login', 'log in', 'sign in', 'dashboard', 'homepage', 'official', 'website',
];
const INFORMATIONAL = [
  'how', 'what', 'why', 'when', 'where', 'who', 'guide', 'tutorial',
  'learn', 'examples', 'tips', 'definition', 'meaning',
];

/**
 * Heuristic intent classifier — fast, deterministic, and works offline.
 * For ambiguous terms, transactional > commercial > navigational > informational.
 */
export function classifyIntent(keyword: string): KeywordIntent {
  const k = keyword.toLowerCase().trim();
  if (!k) return 'informational';
  const has = (list: string[]) => list.some((token) => new RegExp(`\\b${escape(token)}\\b`).test(k));
  if (has(TRANSACTIONAL)) return 'transactional';
  if (has(COMMERCIAL)) return 'commercial';
  if (has(NAVIGATIONAL)) return 'navigational';
  if (has(INFORMATIONAL)) return 'informational';
  return 'informational';
}

const MODIFIERS: Record<KeywordIntent, string[]> = {
  informational: ['how to', 'what is', 'guide', 'tutorial', 'tips'],
  commercial: ['best', 'top', 'review', 'vs', 'alternative'],
  transactional: ['buy', 'price', 'pricing', 'discount', 'free'],
  navigational: ['login', 'official', 'app'],
};

export type ExpandKeywordOptions = {
  /**
   * Optional adapter that returns real volume/CPC data.
   * If absent, deterministic heuristic estimates are used.
   */
  enrich?: (terms: string[]) => Promise<Pick<Keyword, 'term' | 'volume' | 'difficulty' | 'cpc'>[]>;
  /** Maximum number of variants to return. */
  limit?: number;
};

export async function expandKeyword(seed: string, opts: ExpandKeywordOptions = {}): Promise<Keyword[]> {
  const limit = opts.limit ?? 25;
  const variants = generateVariants(seed).slice(0, limit);
  const enriched = opts.enrich ? await opts.enrich(variants) : null;
  const enrichMap = new Map((enriched ?? []).map((e) => [e.term, e]));

  return variants.map((term) => {
    const match = enrichMap.get(term);
    return {
      term,
      volume: match?.volume ?? estimateVolume(term, seed),
      difficulty: match?.difficulty ?? estimateDifficulty(term),
      cpc: match?.cpc,
      intent: classifyIntent(term),
      parent: seed,
    };
  });
}

function generateVariants(seed: string): string[] {
  const base = seed.toLowerCase().trim();
  if (!base) return [];
  const out = new Set<string>([base]);
  for (const intent of Object.keys(MODIFIERS) as KeywordIntent[]) {
    for (const mod of MODIFIERS[intent]) {
      out.add(`${mod} ${base}`);
      out.add(`${base} ${mod}`);
    }
  }
  out.add(`${base} 2025`);
  out.add(`${base} for beginners`);
  out.add(`${base} examples`);
  return Array.from(out);
}

/**
 * Stable pseudo-volume — short, single-word terms get higher estimates.
 * This is *not* a substitute for real data; it just gives the UI sensible
 * non-zero numbers when no provider is wired up.
 */
function estimateVolume(term: string, seed: string): number {
  const words = term.split(/\s+/).length;
  const base = 5000;
  const wordPenalty = Math.max(0, words - 1) * 0.55;
  const seedBoost = term === seed ? 1.5 : 1;
  const v = (base / Math.pow(1 + wordPenalty, 1.4)) * seedBoost;
  return Math.round(v);
}

function estimateDifficulty(term: string): number {
  const words = term.split(/\s+/).length;
  // shorter, head terms are harder
  return Math.max(5, Math.min(95, 90 - (words - 1) * 12));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
