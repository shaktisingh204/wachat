/**
 * Rich error reporting helpers for the SabFlow expression pipeline.
 *
 * Track B / Phase 4 — sub-task #8.
 *
 * This module owns the *presentation* of failures coming out of:
 *   - sibling #2 — `TokenizeError`  (tokenizer)
 *   - sibling #3 — `ParseError`     (parser)
 *   - sibling #4 — `ExpressionError`(evaluator)
 *
 * It is intentionally:
 *   - pure (no I/O, no module-level state)
 *   - dependency-free (no other sabflow imports, no npm deps)
 *   - duck-typed on the inbound errors so it does not couple the diagnose
 *     surface to the concrete classes — discrimination is by `name`/`class`
 *     plus the presence of `pos` / `line` / `col` / `span` fields.
 *
 * The four public helpers:
 *   - {@link formatExpressionError} — multi-line, source-aware diagnostic
 *   - {@link hoveredValue}          — best-effort value tooltip for editors
 *   - {@link summarizeForToast}     — 80-char single-line summary
 *   - {@link suggestIdentifier}     — Levenshtein-≤2 typo correction
 */

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/**
 * Minimal duck-typed shape for any expression-pipeline error.
 *
 * Concrete sibling classes (`TokenizeError`, `ParseError`, `ExpressionError`)
 * are all assignable to this shape — diagnose.ts never imports them, it just
 * reads optional location/identifier fields off whatever is thrown.
 */
export type ExpressionLikeError = {
  /** Human-readable message. Required. */
  message: string;
  /** Discriminator. Falls back to the constructor name when omitted. */
  name?: string;
  /** Linear character offset into the source (0-based). */
  pos?: number;
  /** 1-based line number. */
  line?: number;
  /** 1-based column number. */
  col?: number;
  /** Inclusive start / exclusive end character offsets, when available. */
  span?: { start: number; end: number };
  /** Identifier that triggered the failure (for typo suggestions). */
  identifier?: string;
  /** Optional set of valid identifiers in the surrounding scope. */
  knownIdentifiers?: readonly string[];
};

/** Input bundle for {@link formatExpressionError}. */
export type FormatInput = {
  /** Original expression source text (the inside of `{{ ... }}` is fine). */
  source: string;
  /** The error to render. Anything `Error`-shaped also works. */
  error: ExpressionLikeError | Error | unknown;
  /**
   * Optional identifier dictionary used to power typo suggestions.
   * Merged with `error.knownIdentifiers` when both are present.
   */
  knownIdentifiers?: readonly string[];
};

/**
 * Minimal AST node shape consumed by {@link hoveredValue}.
 *
 * We don't import the real `AstNode` union from sibling #3 — instead we walk
 * any tree whose nodes carry a `span` (or `pos`) plus a `kind`/`type` tag.
 * Property/index/identifier nodes can supply enough information for the
 * partial evaluation. Unknown node kinds fall through harmlessly.
 */
export type DiagnoseAstNode = {
  /** Discriminator. Common: 'identifier' | 'member' | 'index' | 'literal'. */
  kind?: string;
  /** Alternate discriminator field, mirrors `kind`. */
  type?: string;
  /** Inclusive start / exclusive end character offsets. */
  span?: { start: number; end: number };
  /** Linear offset, used when `span` is absent. */
  pos?: number;
  /** Identifier name (for `kind === 'identifier'`). */
  name?: string;
  /** Object side of a `.` access (`member`) or `[…]` access (`index`). */
  object?: DiagnoseAstNode;
  /** Property side of a `.` access. */
  property?: DiagnoseAstNode | string;
  /** Index expression for `index` nodes. */
  index?: DiagnoseAstNode;
  /** Literal value when `kind === 'literal'`. */
  value?: unknown;
  /** Children fallback for tree walkers. */
  children?: DiagnoseAstNode[];
  /** Allow extra fields without losing structural typing. */
  [extra: string]: unknown;
};

/** Input bundle for {@link hoveredValue}. */
export type HoveredValueInput = {
  ast: DiagnoseAstNode | null | undefined;
  /** Character offset of the cursor. */
  position: number;
  /** Scope to resolve identifiers against. */
  scope: Record<string, unknown>;
};

/** Result returned by {@link hoveredValue}. */
export type HoveredValue =
  | { kind: 'value'; value: unknown; node: DiagnoseAstNode }
  | { kind: 'undefined'; expected: string; node: DiagnoseAstNode | null }
  | { kind: 'none' };

// -----------------------------------------------------------------------------
// formatExpressionError
// -----------------------------------------------------------------------------

/** Hard cap on the toast summary length (sub-task spec). */
const TOAST_MAX = 80;

/** Coerce anything thrown into our `ExpressionLikeError` shape. */
function toLikeError(err: unknown): ExpressionLikeError {
  if (err === null || err === undefined) {
    return { message: 'Unknown error', name: 'Error' };
  }
  if (typeof err === 'string') {
    return { message: err, name: 'Error' };
  }
  if (typeof err !== 'object') {
    return { message: String(err), name: 'Error' };
  }
  const e = err as Record<string, unknown>;
  const message =
    typeof e.message === 'string' && e.message.length > 0
      ? e.message
      : String(err);
  const name =
    typeof e.name === 'string' && e.name.length > 0
      ? e.name
      : err instanceof Error
        ? err.constructor?.name ?? 'Error'
        : 'Error';
  const out: ExpressionLikeError = { message, name };
  if (typeof e.pos === 'number') out.pos = e.pos;
  if (typeof e.line === 'number') out.line = e.line;
  if (typeof e.col === 'number') out.col = e.col;
  if (
    e.span &&
    typeof e.span === 'object' &&
    typeof (e.span as { start?: unknown }).start === 'number' &&
    typeof (e.span as { end?: unknown }).end === 'number'
  ) {
    out.span = {
      start: (e.span as { start: number }).start,
      end: (e.span as { end: number }).end,
    };
  }
  if (typeof e.identifier === 'string') out.identifier = e.identifier;
  if (Array.isArray(e.knownIdentifiers)) {
    out.knownIdentifiers = (e.knownIdentifiers as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    );
  }
  return out;
}

/**
 * Derive 1-based `{line, col}` from a linear offset.
 * Newlines are `\n`; `\r\n` is treated as one logical break.
 */
function locateOffset(source: string, offset: number): { line: number; col: number } {
  const safe = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let col = 1;
  for (let i = 0; i < safe; i++) {
    const ch = source[i];
    if (ch === '\n') {
      line++;
      col = 1;
    } else if (ch === '\r') {
      // swallow CRLF as a single break
      if (source[i + 1] === '\n') i++;
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/** Split source into lines, preserving an empty trailing line for blank input. */
function splitLines(source: string): string[] {
  if (source.length === 0) return [''];
  // Normalise line endings before splitting so col math stays consistent.
  return source.replace(/\r\n?/g, '\n').split('\n');
}

/** Build the caret underline: spaces + ^^^ of the right width. */
function buildCaret(col: number, width: number): string {
  const c = Math.max(1, col);
  const w = Math.max(1, width);
  return `${' '.repeat(c - 1)}${'^'.repeat(w)}`;
}

/** Levenshtein distance with an early-out cap. Pure, no allocations beyond rows. */
function levenshtein(a: string, b: string, cap: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Two-row DP.
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0] ?? 0;
    for (let j = 1; j <= b.length; j++) {
      const cost = (a[i - 1] ?? '') === (b[j - 1] ?? '') ? 0 : 1;
      const c1 = (curr[j - 1] ?? 0) + 1;
      const c2 = (prev[j] ?? 0) + 1;
      const c3 = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(c1, c2, c3);
      if ((curr[j] ?? 0) < rowMin) rowMin = curr[j] ?? 0;
    }
    if (rowMin > cap) return cap + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] ?? b.length;
}

/**
 * Find the best identifier match within Levenshtein distance ≤ `maxDistance`.
 * Ties broken by shorter distance, then alphabetical order. Returns `null`
 * when no candidate is within range.
 */
export function suggestIdentifier(
  target: string,
  known: readonly string[],
  maxDistance = 2,
): string | null {
  if (!target || known.length === 0) return null;
  let best: { name: string; dist: number } | null = null;
  for (const name of known) {
    if (name === target) continue;
    const d = levenshtein(target, name, maxDistance);
    if (d > maxDistance) continue;
    if (
      best === null ||
      d < best.dist ||
      (d === best.dist && name < best.name)
    ) {
      best = { name, dist: d };
    }
  }
  return best ? best.name : null;
}

/**
 * Classify the inbound error by discriminator. Falls back to a neutral label
 * when the discriminator does not match any known sibling.
 */
function classifyError(err: ExpressionLikeError): 'tokenize' | 'parse' | 'eval' | 'other' {
  const tag = (err.name ?? '').toLowerCase();
  if (tag.includes('token')) return 'tokenize';
  if (tag.includes('parse')) return 'parse';
  if (tag.includes('expression') || tag.includes('eval')) return 'eval';
  return 'other';
}

/**
 * Build a rich, multi-line diagnostic for an expression error.
 *
 * Layout:
 *   Expression error: <message>
 *     at line L col C
 *
 *     <line above>
 *     <line with caret>
 *        ^^^
 *     <line below>
 *
 *     suggestion: did you mean `<ident>`?
 */
export function formatExpressionError(input: FormatInput): string {
  const source = input.source ?? '';
  const err = toLikeError(input.error);
  const lines = splitLines(source);

  // Resolve a location: prefer explicit line/col, then `pos`, then `span.start`.
  let line: number | undefined = err.line;
  let col: number | undefined = err.col;
  let span: { start: number; end: number } | undefined = err.span;

  if ((line === undefined || col === undefined) && typeof err.pos === 'number') {
    const loc = locateOffset(source, err.pos);
    line = line ?? loc.line;
    col = col ?? loc.col;
    if (!span) span = { start: err.pos, end: err.pos + 1 };
  }
  if ((line === undefined || col === undefined) && span) {
    const loc = locateOffset(source, span.start);
    line = line ?? loc.line;
    col = col ?? loc.col;
  }

  const out: string[] = [];
  out.push(`Expression error: ${err.message}`);

  if (line !== undefined && col !== undefined) {
    out.push(`  at line ${line} col ${col}`);
  }

  // Source context: 3-line window centred on the failing line.
  if (line !== undefined && lines.length > 0 && source.length > 0) {
    const idx = Math.max(0, Math.min(line - 1, lines.length - 1));
    const above = idx > 0 ? lines[idx - 1] : null;
    const target = lines[idx] ?? '';
    const below = idx < lines.length - 1 ? lines[idx + 1] : null;

    out.push('');
    if (above !== null) out.push(`  ${above}`);
    out.push(`  ${target}`);

    // Caret width: span length when the failure stays on one line, else 3.
    let caretCol = col ?? 1;
    let caretWidth = 3;
    if (span && span.end > span.start) {
      const sameLine =
        locateOffset(source, span.end - 1).line === idx + 1 &&
        locateOffset(source, span.start).line === idx + 1;
      if (sameLine) {
        caretCol = locateOffset(source, span.start).col;
        caretWidth = Math.max(1, span.end - span.start);
      }
    }
    out.push(`  ${buildCaret(caretCol, caretWidth)}`);
    if (below !== null) out.push(`  ${below}`);
  }

  // Suggestion: typo correction against the identifier dictionary.
  const known = [
    ...(input.knownIdentifiers ?? []),
    ...(err.knownIdentifiers ?? []),
  ];
  if (err.identifier && known.length > 0) {
    const suggestion = suggestIdentifier(err.identifier, known, 2);
    if (suggestion) {
      out.push('');
      out.push(`  suggestion: did you mean \`${suggestion}\`?`);
    }
  }

  // Tag the originating stage so downstream surfaces can colour-code if they want.
  const stage = classifyError(err);
  if (stage !== 'other') {
    out.push('');
    out.push(`  (${stage} stage)`);
  }

  return out.join('\n');
}

// -----------------------------------------------------------------------------
// summarizeForToast
// -----------------------------------------------------------------------------

/**
 * Collapse an error down to a single line of at most 80 characters, suitable
 * for toast notifications. Stage prefix + message; truncated with an ellipsis
 * when needed. Newlines are stripped so the toast renderer cannot wrap.
 */
export function summarizeForToast(error: unknown): string {
  const err = toLikeError(error);
  const stage = classifyError(err);
  const prefix =
    stage === 'tokenize' ? 'Tokenize: ' :
    stage === 'parse'    ? 'Parse: '    :
    stage === 'eval'     ? 'Eval: '     :
    '';
  const flat = err.message.replace(/\s+/g, ' ').trim();
  const raw = `${prefix}${flat}`;
  if (raw.length <= TOAST_MAX) return raw;
  // Reserve one char for the ellipsis ("…").
  return `${raw.slice(0, TOAST_MAX - 1)}…`;
}

// -----------------------------------------------------------------------------
// hoveredValue
// -----------------------------------------------------------------------------

/** Read either a numeric `pos` or the start of a `span`. */
function nodeStart(node: DiagnoseAstNode): number | undefined {
  if (node.span) return node.span.start;
  if (typeof node.pos === 'number') return node.pos;
  return undefined;
}

/** Read either `span.end` or `pos + 1`. */
function nodeEnd(node: DiagnoseAstNode): number | undefined {
  if (node.span) return node.span.end;
  if (typeof node.pos === 'number') return node.pos + 1;
  return undefined;
}

/** Position is within `[start, end)`. End-inclusive when end is missing. */
function nodeCoversPosition(node: DiagnoseAstNode, position: number): boolean {
  const s = nodeStart(node);
  const e = nodeEnd(node);
  if (s === undefined) return false;
  if (e === undefined) return position >= s;
  return position >= s && position < e;
}

/** Iterate over the structural children of a node without depending on shape. */
function childrenOf(node: DiagnoseAstNode): DiagnoseAstNode[] {
  const out: DiagnoseAstNode[] = [];
  if (Array.isArray(node.children)) {
    for (const c of node.children) if (c && typeof c === 'object') out.push(c);
  }
  if (node.object && typeof node.object === 'object') out.push(node.object);
  if (node.property && typeof node.property === 'object') {
    out.push(node.property as DiagnoseAstNode);
  }
  if (node.index && typeof node.index === 'object') out.push(node.index);
  return out;
}

/** Find the deepest node whose span covers `position`. Pre-order, depth-tracked. */
function findDeepestCoveringNode(
  root: DiagnoseAstNode,
  position: number,
): DiagnoseAstNode | null {
  if (!nodeCoversPosition(root, position)) return null;
  for (const child of childrenOf(root)) {
    const inner = findDeepestCoveringNode(child, position);
    if (inner) return inner;
  }
  return root;
}

/** Discriminator helper — checks either `kind` or `type`. */
function nodeKind(node: DiagnoseAstNode): string {
  return (node.kind ?? node.type ?? '').toLowerCase();
}

/**
 * Try to compute the current value of `node` against `scope`.
 * Only safe property/index access is performed — no calls, no operators.
 * Returns `{ ok: false }` whenever resolution would require a full evaluator,
 * or when an intermediate value is `null`/`undefined`.
 */
function safePartialEval(
  node: DiagnoseAstNode,
  scope: Record<string, unknown>,
): { ok: true; value: unknown } | { ok: false; expected: string } {
  const kind = nodeKind(node);

  if (kind === 'literal') {
    return { ok: true, value: node.value };
  }

  if (kind === 'identifier') {
    const name = typeof node.name === 'string' ? node.name : '';
    if (!name) return { ok: false, expected: 'identifier' };
    if (Object.prototype.hasOwnProperty.call(scope, name)) {
      return { ok: true, value: scope[name] };
    }
    return { ok: false, expected: 'any' };
  }

  if (kind === 'member') {
    if (!node.object) return { ok: false, expected: 'any' };
    const base = safePartialEval(node.object, scope);
    if (!base.ok) return base;
    const obj = base.value;
    if (obj === null || obj === undefined) {
      return { ok: false, expected: 'object' };
    }
    let key: string;
    if (typeof node.property === 'string') {
      key = node.property;
    } else if (node.property && nodeKind(node.property) === 'identifier') {
      key = (node.property.name as string) ?? '';
    } else {
      return { ok: false, expected: 'any' };
    }
    if (typeof obj !== 'object' && typeof obj !== 'function') {
      return { ok: false, expected: 'object' };
    }
    // Hard-stop on prototype-walking / well-known dangerous keys.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return { ok: false, expected: 'any' };
    }
    const next = (obj as Record<string, unknown>)[key];
    return { ok: true, value: next };
  }

  if (kind === 'index') {
    if (!node.object || !node.index) return { ok: false, expected: 'any' };
    const base = safePartialEval(node.object, scope);
    if (!base.ok) return base;
    const idx = safePartialEval(node.index, scope);
    if (!idx.ok) return idx;
    const obj = base.value;
    const key = idx.value;
    if (obj === null || obj === undefined) {
      return { ok: false, expected: 'object | array' };
    }
    if (typeof key !== 'string' && typeof key !== 'number') {
      return { ok: false, expected: 'string | number' };
    }
    if (typeof obj !== 'object' && typeof obj !== 'function') {
      return { ok: false, expected: 'object | array' };
    }
    const sKey = String(key);
    if (sKey === '__proto__' || sKey === 'constructor' || sKey === 'prototype') {
      return { ok: false, expected: 'any' };
    }
    const next = (obj as Record<string, unknown>)[sKey];
    return { ok: true, value: next };
  }

  // Calls, operators, conditionals, etc. — explicitly not evaluated here.
  return { ok: false, expected: 'any' };
}

/**
 * Tooltip helper for the expression editor.
 *
 * Walks the AST, finds the deepest node covering `position`, and attempts a
 * safe partial evaluation against `scope`. Property access and index access
 * are the only supported operations — anything that would require running the
 * full evaluator returns `{ kind: 'undefined', expected }` instead.
 */
export function hoveredValue(input: HoveredValueInput): HoveredValue {
  const { ast, position, scope } = input;
  if (!ast || typeof ast !== 'object') return { kind: 'none' };
  const node = findDeepestCoveringNode(ast, position);
  if (!node) return { kind: 'none' };
  const result = safePartialEval(node, scope);
  if (result.ok) {
    if (result.value === undefined) {
      return { kind: 'undefined', expected: 'any', node };
    }
    return { kind: 'value', value: result.value, node };
  }
  return { kind: 'undefined', expected: result.expected, node };
}
