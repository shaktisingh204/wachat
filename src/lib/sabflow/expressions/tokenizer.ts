/**
 * Tokenizer for the SabFlow expression language.
 *
 * Consumes the raw source *inside* `{{ ... }}` (callers must strip the outer
 * braces first) and produces a flat stream of tokens.  The output is designed
 * to be fed directly into the recursive-descent parser in `parser.ts`.
 *
 * Supported lexemes:
 *   - identifiers (including leading `$`)
 *   - numeric literals (integers + decimals)
 *   - string literals (single, double, and backtick-quoted)
 *   - punctuation:  .   ,   (   )   [   ]   ?   :
 *   - operators:    +  -  *  /  %
 *   - comparisons:  ==  !=  ===  !==  <  >  <=  >=
 *   - logical:      &&  ||  !
 */

export type TokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'dot'
  | 'comma'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'question'
  | 'colon'
  | 'op'        // + - * / %
  | 'cmp'       // == != === !== < > <= >=
  | 'logical'   // && || !
  | 'eof';

export type Token = {
  type: TokenType;
  value: string;
  pos: number;
};

export class TokenizerError extends Error {
  public readonly pos: number;
  constructor(message: string, pos: number) {
    super(`Tokenizer error at ${pos}: ${message}`);
    this.name = 'TokenizerError';
    this.pos = pos;
  }
}

const isWhitespace = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

const isIdentStart = (ch: string): boolean =>
  (ch >= 'a' && ch <= 'z') ||
  (ch >= 'A' && ch <= 'Z') ||
  ch === '_' ||
  ch === '$';

const isIdentPart = (ch: string): boolean => isIdentStart(ch) || isDigit(ch);

/**
 * Reads a quoted string literal.
 * Supports `\n`, `\t`, `\r`, `\\`, `\'`, `\"`, `\``, `\0`, `\x{HH}`, `\u{HHHH}`.
 */
function readString(src: string, start: number, quote: string): { value: string; end: number } {
  let i = start + 1;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === quote) {
      return { value: out, end: i + 1 };
    }
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === undefined) throw new TokenizerError('unterminated escape', i);
      switch (next) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case '\\': out += '\\'; break;
        case '\'': out += '\''; break;
        case '"': out += '"'; break;
        case '`': out += '`'; break;
        case '0': out += '\0'; break;
        default: out += next; break;
      }
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  throw new TokenizerError(`unterminated string starting at ${start}`, start);
}

/** Reads a numeric literal (integer or decimal; no exponent notation). */
function readNumber(src: string, start: number): { value: string; end: number } {
  let i = start;
  let sawDot = false;
  while (i < src.length) {
    const ch = src[i];
    if (isDigit(ch)) {
      i++;
      continue;
    }
    if (ch === '.' && !sawDot && isDigit(src[i + 1] ?? '')) {
      sawDot = true;
      i++;
      continue;
    }
    break;
  }
  return { value: src.slice(start, i), end: i };
}

/** Reads an identifier (incl. leading `$`). */
function readIdent(src: string, start: number): { value: string; end: number } {
  let i = start + 1;
  while (i < src.length && isIdentPart(src[i])) i++;
  return { value: src.slice(start, i), end: i };
}

/**
 * Tokenize the inside of a `{{ ... }}` expression.
 * Never throws for empty input — returns a single `eof` token in that case.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (isWhitespace(ch)) {
      i++;
      continue;
    }

    // Identifiers (keywords like `true`, `false`, `null`, `undefined` are ordinary idents
    // — the parser interprets them).
    if (isIdentStart(ch)) {
      const { value, end } = readIdent(source, i);
      tokens.push({ type: 'identifier', value, pos: i });
      i = end;
      continue;
    }

    // Numbers
    if (isDigit(ch)) {
      const { value, end } = readNumber(source, i);
      tokens.push({ type: 'number', value, pos: i });
      i = end;
      continue;
    }

    // Strings
    if (ch === '"' || ch === '\'' || ch === '`') {
      const { value, end } = readString(source, i, ch);
      tokens.push({ type: 'string', value, pos: i });
      i = end;
      continue;
    }

    // Single-char punctuation
    if (ch === '.') { tokens.push({ type: 'dot',      value: '.', pos: i }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma',    value: ',', pos: i }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen',   value: '(', pos: i }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen',   value: ')', pos: i }); i++; continue; }
    if (ch === '[') { tokens.push({ type: 'lbracket', value: '[', pos: i }); i++; continue; }
    if (ch === ']') { tokens.push({ type: 'rbracket', value: ']', pos: i }); i++; continue; }
    if (ch === '?') { tokens.push({ type: 'question', value: '?', pos: i }); i++; continue; }
    if (ch === ':') { tokens.push({ type: 'colon',    value: ':', pos: i }); i++; continue; }

    // Operators + comparisons + logical
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '=' && source[i + 1] === '=') {
      const isStrict = source[i + 2] === '=';
      tokens.push({ type: 'cmp', value: isStrict ? '===' : '==', pos: i });
      i += isStrict ? 3 : 2;
      continue;
    }
    if (ch === '!' && source[i + 1] === '=') {
      const isStrict = source[i + 2] === '=';
      tokens.push({ type: 'cmp', value: isStrict ? '!==' : '!=', pos: i });
      i += isStrict ? 3 : 2;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'logical', value: '!', pos: i });
      i++;
      continue;
    }
    if (ch === '<' || ch === '>') {
      const hasEq = source[i + 1] === '=';
      tokens.push({ type: 'cmp', value: hasEq ? `${ch}=` : ch, pos: i });
      i += hasEq ? 2 : 1;
      continue;
    }
    if (ch === '&' && source[i + 1] === '&') {
      tokens.push({ type: 'logical', value: '&&', pos: i });
      i += 2;
      continue;
    }
    if (ch === '|' && source[i + 1] === '|') {
      tokens.push({ type: 'logical', value: '||', pos: i });
      i += 2;
      continue;
    }

    throw new TokenizerError(`unexpected character '${ch}'`, i);
  }

  tokens.push({ type: 'eof', value: '', pos: source.length });
  return tokens;
}
