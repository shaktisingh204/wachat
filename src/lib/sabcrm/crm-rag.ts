/**
 * SabCRM — "ask-your-CRM" grounding — PURE helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable). Ranks candidate records
 * against a natural-language query by keyword overlap and formats the top
 * matches into a compact, char-bounded context block the LLM is grounded on.
 * This is the in-house, no-vector-store path (keyword retrieval via the records
 * engine's existing substring search); a vector/embedding retriever can be
 * swapped behind the same shape later. The Mongo retrieval + LLM call live in
 * `./crm-rag.server.ts`.
 */

/** A retrieved record candidate (object slug + display label + data bag). */
export interface RagCandidate {
  id: string;
  object: string;
  label: string;
  data: Record<string, unknown>;
}

/** A ranked candidate with its keyword score. */
export interface RankedCandidate extends RagCandidate {
  score: number;
}

const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are',
  'was', 'were', 'with', 'by', 'at', 'as', 'show', 'me', 'list', 'all', 'my',
  'what', 'which', 'who', 'how', 'many', 'much', 'find', 'get',
]);

/** Tokenize a query into meaningful lowercase terms (len ≥ 2, no stopwords). */
export function queryTerms(query: string): string[] {
  return Array.from(
    new Set(
      (query || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
    ),
  );
}

/** Flatten a record's searchable text (label + primitive data values). */
function recordText(rec: RagCandidate): string {
  const parts: string[] = [rec.label || '', rec.object || ''];
  for (const v of Object.values(rec.data ?? {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(String(v));
    } else if (typeof v === 'object') {
      for (const k of ['label', 'name', 'value', 'title']) {
        const c = (v as Record<string, unknown>)[k];
        if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
      }
    }
  }
  return parts.join(' ').toLowerCase();
}

/** Keyword score = sum of term occurrence counts in the record's text. */
export function scoreCandidate(rec: RagCandidate, terms: string[]): number {
  if (terms.length === 0) return 0;
  const text = recordText(rec);
  let score = 0;
  for (const term of terms) {
    let idx = text.indexOf(term);
    while (idx !== -1) {
      score += 1;
      idx = text.indexOf(term, idx + term.length);
    }
  }
  return score;
}

/** Rank candidates by keyword score (desc), keeping only positive matches. */
export function rankCandidates(
  candidates: RagCandidate[],
  query: string,
  topK = 12,
): RankedCandidate[] {
  const terms = queryTerms(query);
  const scored = candidates
    .map((c) => ({ ...c, score: scoreCandidate(c, terms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK));
}

/** Compact one record into a `[object] label — k=v; k=v` line. */
function formatCandidate(rec: RagCandidate, maxFields = 6): string {
  const fields: string[] = [];
  for (const [k, v] of Object.entries(rec.data ?? {})) {
    if (k.startsWith('__')) continue;
    if (v === null || v === undefined || v === '') continue;
    let val: string;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      val = String(v);
    } else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const pick = o.label ?? o.name ?? o.value ?? o.title;
      if (pick === undefined) continue;
      val = String(pick);
    } else continue;
    if (val.length > 80) val = `${val.slice(0, 77)}…`;
    fields.push(`${k}=${val}`);
    if (fields.length >= maxFields) break;
  }
  return `- [${rec.object}] ${rec.label}${fields.length ? ` — ${fields.join('; ')}` : ''}`;
}

/**
 * Build a char-bounded grounding context block from ranked candidates. Stops
 * adding lines once `maxChars` would be exceeded (keeps the prompt bounded).
 */
export function buildGroundingContext(
  ranked: RagCandidate[],
  maxChars = 4000,
): string {
  const lines: string[] = [];
  let used = 0;
  for (const rec of ranked) {
    const line = formatCandidate(rec);
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

export const ASK_CRM_SYSTEM =
  'You answer questions about the user\'s CRM using ONLY the records provided ' +
  'as context. Be concise and specific, cite record labels you used, and if ' +
  'the context does not contain the answer, say so plainly — never invent ' +
  'records, numbers, or fields.';

/** Assemble the grounded user prompt (context + question). */
export function buildGroundedPrompt(query: string, context: string): string {
  if (!context.trim()) {
    return (
      `The CRM search returned no matching records for the question below. ` +
      `Tell the user no matching records were found.\n\nQuestion: ${query}`
    );
  }
  return (
    `CRM records (context):\n${context}\n\n` +
    `Answer the question using only the records above.\n\nQuestion: ${query}`
  );
}
