/**
 * SabCRM — fuzzy duplicate matching — PURE helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable like `./scoring.ts`). Uses the
 * already-installed `leven` (Levenshtein) plus a small Jaro-Winkler for
 * transposition-tolerant name matching; the two are combined so neither's
 * blind spot dominates. `clusterByField` does an O(n²) single-link clustering
 * used by the on-demand fuzzy duplicate scan in `./data-quality.server.ts`.
 */

import leven from 'leven';

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'string' ? value : String(value);
  s = s.normalize('NFKD').replace(/\p{M}/gu, ''); // strip combining diacritics
  s = s.toLowerCase().trim();
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' '); // punctuation → space (phones use normalizePhone)
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Digits-only view of a phone number. */
export function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Jaro-Winkler similarity in [0, 1]; tolerant of short transpositions. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  // Winkler boost for a common prefix up to 4 chars.
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Normalized Levenshtein similarity in [0, 1]. */
export function levenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - leven(a, b) / max;
}

/**
 * Combined similarity of two raw values, normalized by field kind. Returns the
 * higher of Levenshtein and Jaro-Winkler so transpositions and edits both
 * count. Empty values score 0 (never auto-cluster blanks).
 */
export function fieldSimilarity(
  a: unknown,
  b: unknown,
  kind?: 'text' | 'email' | 'phone',
): number {
  if (kind === 'phone') {
    const pa = normalizePhone(a);
    const pb = normalizePhone(b);
    if (!pa || !pb) return 0;
    return pa === pb ? 1 : levenSimilarity(pa, pb);
  }
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(levenSimilarity(na, nb), jaroWinkler(na, nb));
}

/** A minimal record shape for clustering. */
export interface DedupRecord {
  id: string;
  data: Record<string, unknown>;
}

/** A cluster of likely-duplicate records (size ≥ 2). */
export interface DedupCluster {
  /** The field value the cluster keyed on (from the first member). */
  key: string;
  /** Best pairwise similarity observed inside the cluster. */
  score: number;
  members: DedupRecord[];
}

/**
 * Single-link clustering of records whose `fieldKey` values are at least
 * `threshold` similar. O(n²) — callers must cap `records`. Returns only
 * clusters with ≥ 2 members, largest first.
 */
export function clusterByField(
  records: DedupRecord[],
  fieldKey: string,
  threshold: number,
  kind?: 'text' | 'email' | 'phone',
): DedupCluster[] {
  const n = records.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const bestScore = new Map<number, number>(); // root → best pairwise score
  for (let i = 0; i < n; i++) {
    const vi = records[i].data[fieldKey];
    if (normalizeText(vi) === '' && normalizePhone(vi) === '') continue;
    for (let j = i + 1; j < n; j++) {
      const s = fieldSimilarity(vi, records[j].data[fieldKey], kind);
      if (s >= threshold) {
        union(i, j);
        const root = find(i);
        bestScore.set(root, Math.max(bestScore.get(root) ?? 0, s));
      }
    }
  }

  const groups = new Map<number, DedupRecord[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    // Only keep records that actually joined something (root has a score) or
    // share a root with others.
    const arr = groups.get(root) ?? [];
    arr.push(records[i]);
    groups.set(root, arr);
  }

  const out: DedupCluster[] = [];
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    out.push({
      key: normalizeText(members[0].data[fieldKey]) || '(blank)',
      score: bestScore.get(root) ?? threshold,
      members,
    });
  }
  out.sort((a, b) => b.members.length - a.members.length || b.score - a.score);
  return out;
}
