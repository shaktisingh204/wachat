/**
 * Pure helpers for the SabSMS lists page.
 *
 * Kept out of `actions.ts` so unit tests can import them without
 * dragging in `server-only` + the Mongo client.
 */

export function normalisePhone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
    return null;
  }
  if (/^\d{10,15}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

export interface ParsePhoneListResult {
  valid: string[];
  invalid: string[];
}

export function parsePhoneList(text: string): ParsePhoneListResult {
  const tokens = text
    .split(/[\s,;\n\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const norm = normalisePhone(tok);
    if (!norm) {
      invalid.push(tok);
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    valid.push(norm);
  }
  return { valid, invalid };
}

export interface OverlapResult {
  onlyA: string[];
  onlyB: string[];
  both: string[];
}

export function computeOverlap(a: string[], b: string[]): OverlapResult {
  const setA = new Set(a);
  const setB = new Set(b);
  const both: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const p of setA) {
    if (setB.has(p)) both.push(p);
    else onlyA.push(p);
  }
  for (const p of setB) {
    if (!setA.has(p)) onlyB.push(p);
  }
  return { onlyA, onlyB, both };
}
