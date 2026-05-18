/**
 * SabFlow expression-language tokenizer (n8n-compat).
 *
 * Track B / Phase 4 / sub-task #2.
 *
 * The tokenizer accepts a *full* source string that may contain literal text
 * interleaved with one or more `{{ ... }}` expression segments — same shape as
 * n8n's Tournament-style template strings. Outside a `{{ ... }}` block the
 * tokenizer emits `TEMPLATE_TEXT` chunks; on `{{` it flips into expression mode
 * and on `}}` it flips back to text mode.
 *
 * The function is **pure** — no module-level mutable state — and returns a
 * flat `Token[]` ending in an `EOF` token. Every token records its byte
 * `start`/`end` plus 1-based `line`/`col` for diagnostics.
 *
 * NOTE: ES2020-target `String` index access can yield `undefined`; we rely on
 * `tsconfig` `strict` to keep the boundary checks honest.
 *
 * @see ./parser.ts (consumer)
 * @see ../../expressions/tokenizer.ts (legacy expression-only tokenizer)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TokenKind =
  | 'IDENT'
  | 'NUMBER'
  | 'STRING'
  | 'DOLLAR_IDENT'
  | 'PUNCT'
  | 'OP'
  | 'TEMPLATE_OPEN'
  | 'TEMPLATE_CLOSE'
  | 'TEMPLATE_TEXT'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

export class TokenizeError extends Error {
  public readonly line: number;
  public readonly col: number;
  constructor(message: string, line: number, col: number, context?: string) {
    const ctx = context ? `\n  | ${context}` : '';
    super(`Tokenize error (line ${line}, col ${col}): ${message}${ctx}`);
    this.name = 'TokenizeError';
    this.line = line;
    this.col = col;
  }
}

// ---------------------------------------------------------------------------
// Char classes
// ---------------------------------------------------------------------------

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isHexDigit = (c: string): boolean =>
  isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
const isOctDigit = (c: string): boolean => c >= '0' && c <= '7';
const isBinDigit = (c: string): boolean => c === '0' || c === '1';
const isIdentStart = (c: string): boolean =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isIdentPart = (c: string): boolean => isIdentStart(c) || isDigit(c);

// Multi-char operators (longest-match first).
const OPS_3 = ['===', '!=='] as const;
const OPS_2 = ['==', '!=', '<=', '>=', '&&', '||', '??', '?.', '=>'] as const;
const OPS_1 = ['+', '-', '*', '/', '%', '<', '>', '!'] as const;
const PUNCT_CHARS = new Set(['[', ']', '(', ')', '{', '}', '.', ',', ';', ':', '?']);

// ---------------------------------------------------------------------------
// Tokenizer (pure)
// ---------------------------------------------------------------------------

export function tokenize(source: string): Token[] {
  const out: Token[] = [];

  // Scanner state — local; the function stays pure.
  let i = 0;
  let line = 1;
  let col = 1;
  // Depth of `{{` we are currently inside. n8n does NOT nest, but a `{{` inside
  // a string literal must not flip mode — that's handled by string parsing.
  let inExpr = false;

  const len = source.length;

  // -- helpers --------------------------------------------------------------

  const peek = (off = 0): string => (i + off < len ? source[i + off]! : '');

  const lineOf = (idx: number): string => {
    let lineStart = idx;
    while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--;
    let lineEnd = idx;
    while (lineEnd < len && source[lineEnd] !== '\n') lineEnd++;
    return source.slice(lineStart, lineEnd);
  };

  const fail = (msg: string, atLine = line, atCol = col): never => {
    throw new TokenizeError(msg, atLine, atCol, lineOf(i));
  };

  const advance = (n = 1): void => {
    for (let k = 0; k < n && i < len; k++) {
      if (source[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const push = (
    kind: TokenKind,
    value: string,
    start: number,
    end: number,
    sLine: number,
    sCol: number,
  ): void => {
    out.push({ kind, value, start, end, line: sLine, col: sCol });
  };

  // -- text-mode segment ---------------------------------------------------
  // Consume raw text up to the next `{{` (or EOF). Emit a TEMPLATE_TEXT token
  // only when non-empty so a leading `{{` doesn't generate a blank chunk.

  const readTemplateText = (): void => {
    const start = i;
    const sLine = line;
    const sCol = col;
    let buf = '';
    while (i < len) {
      if (source[i] === '{' && source[i + 1] === '{') break;
      // Allow `\{{` as an escape — keeps templates literal-friendly.
      if (source[i] === '\\' && source[i + 1] === '{' && source[i + 2] === '{') {
        buf += '{{';
        advance(3);
        continue;
      }
      buf += source[i];
      advance();
    }
    if (buf.length > 0) {
      push('TEMPLATE_TEXT', buf, start, i, sLine, sCol);
    }
  };

  // -- expression-mode helpers ---------------------------------------------

  const skipWhitespaceAndComments = (): void => {
    while (i < len) {
      const c = source[i]!;
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        advance();
        continue;
      }
      // Line comment.
      if (c === '/' && peek(1) === '/') {
        while (i < len && source[i] !== '\n') advance();
        continue;
      }
      // Block comment.
      if (c === '/' && peek(1) === '*') {
        advance(2);
        while (i < len && !(source[i] === '*' && peek(1) === '/')) advance();
        if (i >= len) fail('unterminated block comment');
        advance(2);
        continue;
      }
      break;
    }
  };

  const readString = (quote: string): void => {
    const start = i;
    const sLine = line;
    const sCol = col;
    advance(); // opening quote
    let value = '';
    while (i < len) {
      const c = source[i]!;
      if (c === quote) {
        advance();
        push('STRING', value, start, i, sLine, sCol);
        return;
      }
      if (c === '\n' && quote !== '`') {
        fail('unterminated string literal');
      }
      if (c === '\\') {
        const n = peek(1);
        if (n === '') fail('unterminated escape sequence');
        // n8n explicitly does NOT support `${...}` template-string
        // interpolation inside expression strings, even within backticks.
        // `\${` collapses to a literal `${`.
        switch (n) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '0': value += '\0'; break;
          case 'b': value += '\b'; break;
          case 'f': value += '\f'; break;
          case 'v': value += '\v'; break;
          case '\\': value += '\\'; break;
          case '\'': value += '\''; break;
          case '"': value += '"'; break;
          case '`': value += '`'; break;
          case '$': value += '$'; break;
          case 'x': {
            const hex = source.slice(i + 2, i + 4);
            if (hex.length < 2 || !/^[0-9a-fA-F]{2}$/.test(hex)) {
              fail('invalid \\x escape');
            }
            value += String.fromCharCode(parseInt(hex, 16));
            advance(4);
            continue;
          }
          case 'u': {
            if (peek(2) === '{') {
              const closeRel = source.indexOf('}', i + 3);
              if (closeRel < 0) fail('unterminated \\u{...} escape');
              const hex = source.slice(i + 3, closeRel);
              if (!/^[0-9a-fA-F]+$/.test(hex)) fail('invalid \\u{...} escape');
              value += String.fromCodePoint(parseInt(hex, 16));
              advance(closeRel - i + 1);
              continue;
            }
            const hex = source.slice(i + 2, i + 6);
            if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
              fail('invalid \\u escape');
            }
            value += String.fromCharCode(parseInt(hex, 16));
            advance(6);
            continue;
          }
          default:
            // Unknown escape: keep the next char verbatim (lenient, n8n-ish).
            value += n;
            break;
        }
        advance(2);
        continue;
      }
      value += c;
      advance();
    }
    fail('unterminated string literal', sLine, sCol);
  };

  const readNumber = (): void => {
    const start = i;
    const sLine = line;
    const sCol = col;
    let value = '';

    // Radix prefixes — only valid immediately after a leading `0`.
    if (source[i] === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
      value += source[i]! + source[i + 1]!;
      advance(2);
      const digitsStart = i;
      while (i < len && isHexDigit(source[i]!)) {
        value += source[i]!;
        advance();
      }
      if (i === digitsStart) fail('invalid hex literal');
      maybeBigInt(value, start, sLine, sCol);
      return;
    }
    if (source[i] === '0' && (peek(1) === 'o' || peek(1) === 'O')) {
      value += source[i]! + source[i + 1]!;
      advance(2);
      const digitsStart = i;
      while (i < len && isOctDigit(source[i]!)) {
        value += source[i]!;
        advance();
      }
      if (i === digitsStart) fail('invalid octal literal');
      maybeBigInt(value, start, sLine, sCol);
      return;
    }
    if (source[i] === '0' && (peek(1) === 'b' || peek(1) === 'B')) {
      value += source[i]! + source[i + 1]!;
      advance(2);
      const digitsStart = i;
      while (i < len && isBinDigit(source[i]!)) {
        value += source[i]!;
        advance();
      }
      if (i === digitsStart) fail('invalid binary literal');
      maybeBigInt(value, start, sLine, sCol);
      return;
    }

    // Decimal — int / float / scientific.
    while (i < len && isDigit(source[i]!)) {
      value += source[i]!;
      advance();
    }
    if (source[i] === '.' && isDigit(peek(1))) {
      value += '.';
      advance();
      while (i < len && isDigit(source[i]!)) {
        value += source[i]!;
        advance();
      }
    }
    if (source[i] === 'e' || source[i] === 'E') {
      value += source[i]!;
      advance();
      if (source[i] === '+' || source[i] === '-') {
        value += source[i]!;
        advance();
      }
      const expStart = i;
      while (i < len && isDigit(source[i]!)) {
        value += source[i]!;
        advance();
      }
      if (i === expStart) fail('invalid exponent in number');
    }
    maybeBigInt(value, start, sLine, sCol);
  };

  const maybeBigInt = (
    value: string,
    start: number,
    sLine: number,
    sCol: number,
  ): void => {
    // `123n` — only legal for ints (no `.`, no exponent).
    if (source[i] === 'n' && !value.includes('.') && !/[eE]/.test(value)) {
      value += 'n';
      advance();
    }
    push('NUMBER', value, start, i, sLine, sCol);
  };

  const readIdent = (): string => {
    let v = '';
    while (i < len && isIdentPart(source[i]!)) {
      v += source[i]!;
      advance();
    }
    return v;
  };

  const readDollarIdent = (): void => {
    const start = i;
    const sLine = line;
    const sCol = col;
    advance(); // `$`
    // `$('name')` and `$("name")` — capture the call form as the value.
    if (source[i] === '(') {
      let value = '$(';
      advance();
      // Optional whitespace.
      while (i < len && (source[i] === ' ' || source[i] === '\t')) {
        value += source[i]!;
        advance();
      }
      const quote = source[i];
      if (quote !== '"' && quote !== "'" && quote !== '`') {
        fail('expected quoted string in $(...) accessor');
      }
      value += quote;
      advance();
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < len) {
          value += source[i]! + source[i + 1]!;
          advance(2);
          continue;
        }
        if (source[i] === '\n') fail('unterminated $() accessor');
        value += source[i]!;
        advance();
      }
      if (i >= len) fail('unterminated $() accessor');
      value += quote;
      advance();
      while (i < len && (source[i] === ' ' || source[i] === '\t')) {
        value += source[i]!;
        advance();
      }
      if (source[i] !== ')') fail('expected ) to close $() accessor');
      value += ')';
      advance();
      push('DOLLAR_IDENT', value, start, i, sLine, sCol);
      return;
    }
    // Plain `$json`, `$node`, `$now`, ...
    const tail = readIdent();
    push('DOLLAR_IDENT', '$' + tail, start, i, sLine, sCol);
  };

  // -- main loop -----------------------------------------------------------

  while (i < len) {
    if (!inExpr) {
      // Text mode: look for next `{{`.
      readTemplateText();
      if (i >= len) break;
      // We're at `{{`.
      const start = i;
      const sLine = line;
      const sCol = col;
      advance(2);
      push('TEMPLATE_OPEN', '{{', start, i, sLine, sCol);
      inExpr = true;
      continue;
    }

    // Expression mode.
    skipWhitespaceAndComments();
    if (i >= len) fail('unterminated `{{` expression');

    // Closing `}}` — but only when not directly after a non-paired `}`.
    if (source[i] === '}' && peek(1) === '}') {
      const start = i;
      const sLine = line;
      const sCol = col;
      advance(2);
      push('TEMPLATE_CLOSE', '}}', start, i, sLine, sCol);
      inExpr = false;
      continue;
    }

    const c = source[i]!;
    const start = i;
    const sLine = line;
    const sCol = col;

    // Strings.
    if (c === '"' || c === '\'' || c === '`') {
      readString(c);
      continue;
    }

    // Numbers.
    if (isDigit(c) || (c === '.' && isDigit(peek(1)))) {
      readNumber();
      continue;
    }

    // `$` accessor.
    if (c === '$') {
      readDollarIdent();
      continue;
    }

    // Identifiers (keywords like `true`/`false`/`null`/`undefined`/`in`/`typeof`
    // are emitted as plain IDENTs — the parser decides their meaning).
    if (isIdentStart(c)) {
      const v = readIdent();
      push('IDENT', v, start, i, sLine, sCol);
      continue;
    }

    // 3-char operators.
    let matched = false;
    for (const op of OPS_3) {
      if (source.startsWith(op, i)) {
        advance(op.length);
        push('OP', op, start, i, sLine, sCol);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2-char operators.
    for (const op of OPS_2) {
      if (source.startsWith(op, i)) {
        advance(op.length);
        push('OP', op, start, i, sLine, sCol);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 1-char operators.
    for (const op of OPS_1) {
      if (c === op) {
        advance();
        push('OP', op, start, i, sLine, sCol);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Punctuation (single-char).
    if (PUNCT_CHARS.has(c)) {
      advance();
      push('PUNCT', c, start, i, sLine, sCol);
      continue;
    }

    fail(`unexpected character ${JSON.stringify(c)}`);
  }

  if (inExpr) fail('unterminated `{{` expression — missing `}}`');

  push('EOF', '', i, i, line, col);
  return out;
}
