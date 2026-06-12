/**
 * Pure logic for the formula-bar assist: function-name autocomplete and signature help.
 * Kept free of React so it's unit-testable.
 */

/** A partial function name being typed at the caret (only inside a `=` formula). */
export interface PrefixMatch {
  /** The partial name, uppercased (e.g. "SU"). */
  prefix: string;
  /** Index in the draft where the name starts (for replacement on accept). */
  start: number;
}

/**
 * The function-name prefix immediately before the caret, or null. A name char is A-Z, 0-9, `.`, `_`;
 * the char before the name must be a formula delimiter (start, `(`, `,`, operator, space).
 */
export function matchFunctionPrefix(draft: string, caret: number): PrefixMatch | null {
  if (!draft.startsWith("=")) return null;
  const upto = draft.slice(0, caret);
  const m = /([A-Za-z][A-Za-z0-9_.]*)$/.exec(upto);
  if (!m) return null;
  const start = caret - m[1].length;
  const before = upto[start - 1];
  // Must not be part of a cell ref like A1 being typed after a sheet/quote, and must follow a delimiter.
  if (before !== undefined && !"=(),+-*/^&<>; ".includes(before)) return null;
  // Pure cell-reference shapes (e.g. "A1", "BC23") shouldn't autocomplete as functions.
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(m[1])) return null;
  return { prefix: m[1].toUpperCase(), start };
}

/** Filter the catalog names for a prefix (prefix-anchored, then contains), capped. */
export function filterFunctions(names: string[], prefix: string, cap = 8): string[] {
  if (!prefix) return [];
  const p = prefix.toUpperCase();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const n of names) {
    if (n.startsWith(p)) starts.push(n);
    else if (n.includes(p)) contains.push(n);
    if (starts.length >= cap) break;
  }
  return [...starts, ...contains].slice(0, cap);
}

/** The innermost un-closed function call containing the caret, with the 0-based argument index. */
export interface ActiveCall {
  name: string;
  argIndex: number;
}

export function activeCall(draft: string, caret: number): ActiveCall | null {
  if (!draft.startsWith("=")) return null;
  const upto = draft.slice(0, caret);
  // Stack of { name, argIndex } for each open paren that followed a name.
  const stack: ActiveCall[] = [];
  let i = 0;
  let inString = false;
  while (i < upto.length) {
    const ch = upto[i];
    if (inString) {
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }
    if (ch === "(") {
      const before = upto.slice(0, i);
      const m = /([A-Za-z][A-Za-z0-9_.]*)$/.exec(before);
      stack.push({ name: m ? m[1].toUpperCase() : "", argIndex: 0 });
      i++;
      continue;
    }
    if (ch === ")") {
      stack.pop();
      i++;
      continue;
    }
    if (ch === "," && stack.length > 0) {
      stack[stack.length - 1].argIndex++;
      i++;
      continue;
    }
    i++;
  }
  // Innermost call that actually has a function name.
  for (let k = stack.length - 1; k >= 0; k--) {
    if (stack[k].name) return stack[k];
  }
  return null;
}

/** Replace the prefix at `start..caret` with `NAME(`, returning the new draft + caret position. */
export function acceptCompletion(
  draft: string,
  caret: number,
  start: number,
  name: string,
): { draft: string; caret: number } {
  const next = draft.slice(0, start) + name + "(" + draft.slice(caret);
  return { draft: next, caret: start + name.length + 1 };
}
