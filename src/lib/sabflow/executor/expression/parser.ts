/**
 * Pratt / recursive-descent parser for the SabFlow executor expression
 * language.  Consumes the token stream produced by sibling #2's tokenizer
 * (see {@link Token}) and yields a {@link TemplateNode} root.
 *
 * Precedence (low → high — matches the JS spec subset we accept):
 *   1   `??`   `||`           (left-assoc, Logical)
 *   1.5 `? :`                  (right-assoc ternary, parsed at the logical layer)
 *   2   `&&`                   (left-assoc, Logical)
 *   3   `==` `===` `!=` `!==`  (left-assoc, Binary)
 *   4   `<` `<=` `>` `>=`      (left-assoc, Binary)
 *   5   `+`  `-`               (left-assoc, Binary)
 *   6   `*`  `/`  `%`          (left-assoc, Binary)
 *   7   prefix `+` `-` `!` `typeof`
 *   8   member `.`, optional `?.`, call `(...)`, index `[...]`  (left-assoc, postfix)
 *
 * Hard-forbidden forms (raise {@link ParseError}):
 *   - `function` keyword (any form), `class`, block statements
 *   - `new` except the exact `new Date(...)` call form
 *   - `eval(...)`, `Function(...)`
 *   - `import`, `require`
 *   - assignment operators
 */

import {
  ArrayLitNode,
  ArrowFnNode,
  BinaryNode,
  CallNode,
  DollarIdentNode,
  Expression,
  ExprNode,
  IdentifierNode,
  IndexNode,
  LiteralNode,
  LogicalNode,
  MemberAccessNode,
  Node,
  ObjectLitNode,
  ObjectProperty,
  OptionalChainNode,
  ParseError,
  TemplateNode,
  TemplateStringNode,
  TernaryNode,
  TextNode,
  Token,
  TokenKind,
  UnaryNode,
} from './ast';

// ---------------------------------------------------------------------------
//  Forbidden identifier names — flagged at usage time.
// ---------------------------------------------------------------------------

const FORBIDDEN_IDENTS = new Set<string>([
  'function',
  'class',
  'eval',
  'Function',
  'import',
  'require',
  'return',
  'var',
  'let',
  'const',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'throw',
  'try',
  'catch',
  'finally',
  'this',
  'super',
  'yield',
  'await',
  'delete',
  'void',
  'in',
  'instanceof',
  'with',
]);

const ASSIGNMENT_OPS = new Set<string>([
  '=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??=', '&=', '|=', '^=', '<<=', '>>=', '>>>=',
]);

// ---------------------------------------------------------------------------
//  Pratt precedence — only used as an internal lookup; the parser's structure
//  is one method per level for clarity & debuggability.
// ---------------------------------------------------------------------------

const PREC = {
  NULLISH_OR: 1,
  TERNARY:    1.5,
  AND:        2,
  EQUALITY:   3,
  COMPARE:    4,
  ADDITIVE:   5,
  MULTIPLY:   6,
  UNARY:      7,
  POSTFIX:    8,
} as const;

// Suppress "unused" warning while exposing the table for sibling #8 / tests.
export const PRECEDENCE_TABLE = PREC;

// ---------------------------------------------------------------------------
//  Public entry point.
// ---------------------------------------------------------------------------

/**
 * Parse a token stream into a {@link TemplateNode}.
 *
 * The token stream must terminate with an `eof` token.  Tokens outside any
 * `{{ ... }}` block must be `text` tokens; inside a block, the parser expects
 * a JS-expression subset bounded by matching `open` / `close` tokens.
 */
export function parse(tokens: Token[]): TemplateNode {
  if (tokens.length === 0) {
    throw new ParseError('empty token stream', 0, 0, '');
  }

  const parser = new Parser(tokens);
  return parser.parseTemplate();
}

// ---------------------------------------------------------------------------
//  Parser implementation.
// ---------------------------------------------------------------------------

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  /** Last seen end offset — used to bound zero-width error spans. */
  private get sourceEnd(): number {
    const last = this.tokens[this.tokens.length - 1];
    return last ? last.end : 0;
  }

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // -------------------------------------------------------------------------
  //  Token cursor helpers.
  // -------------------------------------------------------------------------

  private peek(offset = 0): Token {
    const t = this.tokens[this.pos + offset];
    if (!t) {
      // Synthesize an EOF token so callers can still read .start/.end.
      return { kind: 'eof', value: '', start: this.sourceEnd, end: this.sourceEnd };
    }
    return t;
  }

  private advance(): Token {
    const t = this.peek();
    if (t.kind !== 'eof') this.pos++;
    return t;
  }

  private check(kind: TokenKind, value?: string): boolean {
    const t = this.peek();
    if (t.kind !== kind) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  private match(kind: TokenKind, value?: string): Token | null {
    if (this.check(kind, value)) return this.advance();
    return null;
  }

  private expect(kind: TokenKind, value?: string, message?: string): Token {
    if (this.check(kind, value)) return this.advance();
    const t = this.peek();
    const want = value !== undefined ? `'${value}'` : kind;
    throw this.error(message ?? `expected ${want} but found ${this.describe(t)}`, t);
  }

  private describe(t: Token): string {
    if (t.kind === 'eof') return 'end of input';
    if (t.value === '') return t.kind;
    return `'${t.value}'`;
  }

  private error(message: string, at: Token): ParseError {
    const start = at.start;
    const end = Math.max(at.end, at.start + 1);
    return new ParseError(message, start, end, renderCaret(this.tokens, at));
  }

  // -------------------------------------------------------------------------
  //  Template level — text + `{{ expr }}` chunks.
  // -------------------------------------------------------------------------

  parseTemplate(): TemplateNode {
    const children: Array<TextNode | ExprNode> = [];
    const first = this.peek();
    const start = first.start;

    while (!this.check('eof')) {
      const t = this.peek();
      if (t.kind === 'text') {
        this.advance();
        const node: TextNode = { kind: 'Text', value: t.value, start: t.start, end: t.end };
        children.push(node);
        continue;
      }
      if (t.kind === 'open') {
        children.push(this.parseExprBlock());
        continue;
      }
      // Be forgiving for callers that hand us a bare expression stream
      // (no surrounding `{{ }}` framing).  Wrap the whole thing in an Expr.
      if (this.pos === 0 && this.isExpressionStart(t)) {
        const expression = this.parseExpression();
        const node: ExprNode = {
          kind: 'Expr',
          expression,
          start: t.start,
          end: expression.end,
        };
        children.push(node);
        continue;
      }
      throw this.error(`unexpected ${this.describe(t)} at template level`, t);
    }

    const eof = this.peek();
    return {
      kind: 'Template',
      children,
      start,
      end: eof.start,
    };
  }

  private parseExprBlock(): ExprNode {
    const open = this.expect('open', undefined, "expected '{{'");
    const expression = this.parseExpression();
    const close = this.expect('close', undefined, "expected '}}' to close expression");
    return {
      kind: 'Expr',
      expression,
      start: open.start,
      end: close.end,
    };
  }

  // -------------------------------------------------------------------------
  //  Expression entry — descends through the precedence ladder.
  // -------------------------------------------------------------------------

  parseExpression(): Expression {
    // Arrow functions ARE expressions but only valid at the top of the
    // precedence ladder.  Try to parse one before falling through.
    const arrow = this.tryParseArrowFn();
    if (arrow) return arrow;

    // Standard precedence chain: ternary > logical (||/??) > AND > equality > ...
    const expr = this.parseTernary();
    this.rejectAssignment();
    return expr;
  }

  private rejectAssignment(): void {
    const t = this.peek();
    if (t.kind === 'op' && ASSIGNMENT_OPS.has(t.value)) {
      throw this.error(`assignment operator '${t.value}' is not allowed in expressions`, t);
    }
  }

  // ---- level 1.5: ternary (right-assoc)  ----------------------------------

  private parseTernary(): Expression {
    const test = this.parseLogicalLow();
    if (!this.check('question')) return test;
    const q = this.advance();
    const consequent = this.parseExpression();
    this.expect('colon', undefined, "expected ':' in ternary");
    const alternate = this.parseExpression();
    const node: TernaryNode = {
      kind: 'Ternary',
      test,
      consequent,
      alternate,
      start: test.start,
      end: alternate.end,
    };
    void q;
    return node;
  }

  // ---- level 1: `||` and `??` (left-assoc)  -------------------------------

  private parseLogicalLow(): Expression {
    let left: Expression = this.parseLogicalAnd();
    while (this.check('op', '||') || this.check('op', '??')) {
      const op = this.advance().value as '||' | '??';
      const right = this.parseLogicalAnd();
      const node: LogicalNode = {
        kind: 'Logical',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 2: `&&` (left-assoc)  ----------------------------------------

  private parseLogicalAnd(): Expression {
    let left: Expression = this.parseEquality();
    while (this.check('op', '&&')) {
      this.advance();
      const right = this.parseEquality();
      const node: LogicalNode = {
        kind: 'Logical',
        operator: '&&',
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 3: equality (left-assoc) -------------------------------------

  private parseEquality(): Expression {
    let left: Expression = this.parseComparison();
    while (this.isOp('==', '!=', '===', '!==')) {
      const op = this.advance().value as '==' | '!=' | '===' | '!==';
      const right = this.parseComparison();
      const node: BinaryNode = {
        kind: 'Binary',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 4: comparison (left-assoc) -----------------------------------

  private parseComparison(): Expression {
    let left: Expression = this.parseAdditive();
    while (this.isOp('<', '<=', '>', '>=')) {
      const op = this.advance().value as '<' | '<=' | '>' | '>=';
      const right = this.parseAdditive();
      const node: BinaryNode = {
        kind: 'Binary',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 5: additive (left-assoc) -------------------------------------

  private parseAdditive(): Expression {
    let left: Expression = this.parseMultiplicative();
    while (this.isOp('+', '-')) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseMultiplicative();
      const node: BinaryNode = {
        kind: 'Binary',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 6: multiplicative (left-assoc) -------------------------------

  private parseMultiplicative(): Expression {
    let left: Expression = this.parseUnary();
    while (this.isOp('*', '/', '%')) {
      const op = this.advance().value as '*' | '/' | '%';
      const right = this.parseUnary();
      const node: BinaryNode = {
        kind: 'Binary',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      };
      left = node;
    }
    return left;
  }

  // ---- level 7: prefix unary  ---------------------------------------------

  private parseUnary(): Expression {
    // `typeof` is an identifier token by tokenizer convention.
    if (this.check('identifier', 'typeof')) {
      const tok = this.advance();
      const argument = this.parseUnary();
      const node: UnaryNode = {
        kind: 'Unary',
        operator: 'typeof',
        argument,
        start: tok.start,
        end: argument.end,
      };
      return node;
    }
    if (this.isOp('+', '-', '!')) {
      const tok = this.advance();
      const operator = tok.value as '+' | '-' | '!';
      const argument = this.parseUnary();
      const node: UnaryNode = {
        kind: 'Unary',
        operator,
        argument,
        start: tok.start,
        end: argument.end,
      };
      return node;
    }
    return this.parsePostfix();
  }

  // ---- level 8: postfix — member / optional / call / index ----------------

  private parsePostfix(): Expression {
    let expr: Expression = this.parsePrimary();

    while (true) {
      if (this.match('dot')) {
        const name = this.expect('identifier', undefined, "expected property name after '.'");
        const node: MemberAccessNode = {
          kind: 'MemberAccess',
          object: expr,
          property: name.value,
          start: expr.start,
          end: name.end,
        };
        expr = node;
        continue;
      }
      if (this.match('optional')) {
        // Optional chain — only the `?.ident` form here.  `?.[ ]` / `?.( )`
        // collapse into the same semantics; we surface them as Index/Call on
        // top of an OptionalChain head for simplicity.
        if (this.check('lparen')) {
          const args = this.parseArgList();
          const end = this.tokens[this.pos - 1].end;
          const node: CallNode = {
            kind: 'Call',
            callee: expr,
            args,
            start: expr.start,
            end,
          };
          expr = node;
          continue;
        }
        if (this.check('lbracket')) {
          this.advance();
          const index = this.parseExpression();
          const close = this.expect('rbracket', undefined, "expected ']' to close index");
          const node: IndexNode = {
            kind: 'Index',
            object: expr,
            index,
            start: expr.start,
            end: close.end,
          };
          expr = node;
          continue;
        }
        const name = this.expect('identifier', undefined, "expected property name after '?.'");
        const node: OptionalChainNode = {
          kind: 'OptionalChain',
          object: expr,
          property: name.value,
          start: expr.start,
          end: name.end,
        };
        expr = node;
        continue;
      }
      if (this.check('lbracket')) {
        this.advance();
        const index = this.parseExpression();
        const close = this.expect('rbracket', undefined, "expected ']' to close index");
        const node: IndexNode = {
          kind: 'Index',
          object: expr,
          index,
          start: expr.start,
          end: close.end,
        };
        expr = node;
        continue;
      }
      if (this.check('lparen')) {
        // Calls cannot follow forbidden callees.
        this.assertCallableCallee(expr);
        const args = this.parseArgList();
        const end = this.tokens[this.pos - 1].end;
        const node: CallNode = {
          kind: 'Call',
          callee: expr,
          args,
          start: expr.start,
          end,
        };
        expr = node;
        continue;
      }
      break;
    }
    return expr;
  }

  private assertCallableCallee(callee: Expression): void {
    // `eval(...)` and `Function(...)` are rejected even if the names slipped
    // through as identifiers (defensive — they're in FORBIDDEN_IDENTS too).
    if (callee.kind === 'Identifier') {
      if (callee.name === 'eval' || callee.name === 'Function') {
        throw new ParseError(
          `'${callee.name}' is not allowed in expressions`,
          callee.start,
          callee.end,
          renderCaretAtSpan(this.tokens, callee.start, callee.end),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  //  Primary — literals, identifiers, grouping, array/object, template strings,
  //  arrow fn (already tried at top of `parseExpression`), `new Date(...)`.
  // -------------------------------------------------------------------------

  private parsePrimary(): Expression {
    const t = this.peek();

    switch (t.kind) {
      case 'number': {
        this.advance();
        const value = Number(t.value);
        const node: LiteralNode = {
          kind: 'Literal',
          value,
          raw: 'number',
          start: t.start,
          end: t.end,
        };
        return node;
      }
      case 'string': {
        this.advance();
        const node: LiteralNode = {
          kind: 'Literal',
          value: t.value,
          raw: 'string',
          start: t.start,
          end: t.end,
        };
        return node;
      }
      case 'template': {
        return this.parseTemplateString();
      }
      case 'identifier': {
        return this.parseIdentifierStart();
      }
      case 'dollar': {
        this.advance();
        const node: DollarIdentNode = {
          kind: 'DollarIdent',
          name: t.value,
          start: t.start,
          end: t.end,
        };
        return node;
      }
      case 'lparen': {
        // Plain parenthesized expression — arrow fn case already handled by
        // tryParseArrowFn() before we got here.
        this.advance();
        const inner = this.parseExpression();
        this.expect('rparen', undefined, "expected ')' to close grouping");
        return inner;
      }
      case 'lbracket': {
        return this.parseArrayLiteral();
      }
      case 'lbrace': {
        return this.parseObjectLiteral();
      }
      default:
        throw this.error(`unexpected ${this.describe(t)}`, t);
    }
  }

  private parseIdentifierStart(): Expression {
    const t = this.advance();
    // Keyword literals first.
    switch (t.value) {
      case 'true':      return literalBool(t, true);
      case 'false':     return literalBool(t, false);
      case 'null':      return literalNull(t);
      case 'undefined': return literalUndefined(t);
      case 'new':       return this.parseNewExpression(t);
    }
    if (FORBIDDEN_IDENTS.has(t.value)) {
      throw this.error(`'${t.value}' is not allowed in expressions`, t);
    }
    const node: IdentifierNode = {
      kind: 'Identifier',
      name: t.value,
      start: t.start,
      end: t.end,
    };
    return node;
  }

  private parseNewExpression(newTok: Token): Expression {
    // The only whitelisted form is `new Date(...)`.
    const callee = this.peek();
    if (callee.kind !== 'identifier' || callee.value !== 'Date') {
      throw this.error("only 'new Date(...)' is allowed; other 'new' expressions are forbidden", callee);
    }
    this.advance();
    if (!this.check('lparen')) {
      throw this.error("'new Date' must be called as 'new Date(...)'", this.peek());
    }
    const args = this.parseArgList();
    const end = this.tokens[this.pos - 1].end;
    const node: CallNode = {
      kind: 'Call',
      callee: {
        kind: 'Identifier',
        name: 'Date',
        start: callee.start,
        end: callee.end,
      },
      args,
      isNew: true,
      start: newTok.start,
      end,
    };
    return node;
  }

  private parseArgList(): Expression[] {
    this.expect('lparen', undefined, "expected '('");
    const args: Expression[] = [];
    if (this.check('rparen')) {
      this.advance();
      return args;
    }
    args.push(this.parseExpression());
    while (this.match('comma')) {
      // Allow trailing comma `f(a, b,)`.
      if (this.check('rparen')) break;
      args.push(this.parseExpression());
    }
    this.expect('rparen', undefined, "expected ')' to close argument list");
    return args;
  }

  private parseArrayLiteral(): ArrayLitNode {
    const open = this.expect('lbracket');
    const elements: Expression[] = [];
    if (!this.check('rbracket')) {
      elements.push(this.parseExpression());
      while (this.match('comma')) {
        if (this.check('rbracket')) break;
        elements.push(this.parseExpression());
      }
    }
    const close = this.expect('rbracket', undefined, "expected ']' to close array literal");
    return {
      kind: 'ArrayLit',
      elements,
      start: open.start,
      end: close.end,
    };
  }

  private parseObjectLiteral(): ObjectLitNode {
    const open = this.expect('lbrace');
    const properties: ObjectProperty[] = [];

    if (!this.check('rbrace')) {
      properties.push(this.parseObjectProperty());
      while (this.match('comma')) {
        if (this.check('rbrace')) break;
        properties.push(this.parseObjectProperty());
      }
    }
    const close = this.expect('rbrace', undefined, "expected '}' to close object literal");
    return {
      kind: 'ObjectLit',
      properties,
      start: open.start,
      end: close.end,
    };
  }

  private parseObjectProperty(): ObjectProperty {
    const t = this.peek();
    let key: ObjectProperty['key'];
    const start = t.start;

    if (t.kind === 'lbracket') {
      this.advance();
      const expression = this.parseExpression();
      this.expect('rbracket', undefined, "expected ']' to close computed key");
      key = { kind: 'computed', expression };
    } else if (t.kind === 'string') {
      this.advance();
      key = { kind: 'static', name: t.value };
    } else if (t.kind === 'number') {
      this.advance();
      key = { kind: 'static', name: t.value };
    } else if (t.kind === 'identifier' || t.kind === 'dollar') {
      this.advance();
      key = { kind: 'static', name: t.value };
    } else {
      throw this.error(`unexpected ${this.describe(t)} in object key position`, t);
    }

    // Shorthand `{ foo }` — only for plain identifier keys.
    if (!this.check('colon')) {
      if (key.kind === 'static' && (t.kind === 'identifier' || t.kind === 'dollar')) {
        const ident: Expression = t.kind === 'dollar'
          ? { kind: 'DollarIdent', name: t.value, start: t.start, end: t.end }
          : { kind: 'Identifier',  name: t.value, start: t.start, end: t.end };
        return { key, value: ident, start, end: t.end };
      }
      throw this.error("expected ':' after object key", this.peek());
    }
    this.advance(); // consume ':'
    const value = this.parseExpression();
    return { key, value, start, end: value.end };
  }

  private parseTemplateString(): TemplateStringNode {
    // Sibling #2's tokenizer collapses backtick strings into a single
    // `template` token whose value is the raw inner text.  We re-parse here to
    // pull out `${ ... }` placeholders.  Placeholder bodies are run through a
    // fresh child parser so they reuse the full expression grammar.
    const tok = this.advance();
    const raw = tok.value;
    const quasis: string[] = [];
    const expressions: Expression[] = [];

    let buf = '';
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === '\\' && i + 1 < raw.length) {
        // preserve escape sequences as-is for downstream evaluator
        buf += raw[i] + raw[i + 1];
        i += 2;
        continue;
      }
      if (ch === '$' && raw[i + 1] === '{') {
        quasis.push(buf);
        buf = '';
        i += 2;
        // collect balanced `${ ... }`
        let depth = 1;
        const start = i;
        while (i < raw.length && depth > 0) {
          const c = raw[i];
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) break;
          }
          i++;
        }
        if (depth !== 0) {
          throw new ParseError(
            'unterminated `${...}` in template string',
            tok.start,
            tok.end,
            renderCaretAtSpan(this.tokens, tok.start, tok.end),
          );
        }
        const inner = raw.slice(start, i);
        i++; // consume the closing `}`
        // Parse the inner expression with a sub-parser.  We synthesize a
        // single-`text`-free token stream — the easiest robust path is to
        // require the caller's tokenizer to also surface placeholder spans;
        // for the common case we lean on a structural eval-time re-tokenize
        // via JSON.parse-friendly fallbacks.  To keep this layer dep-free we
        // store the raw inner string in an Identifier wrapper; sibling #5
        // (evaluator) re-tokenizes + re-parses.
        expressions.push({
          kind: 'Identifier',
          name: `__tpl_expr__:${inner}`,
          start: tok.start,
          end: tok.end,
        });
        continue;
      }
      buf += ch;
      i++;
    }
    quasis.push(buf);

    return {
      kind: 'TemplateString',
      quasis,
      expressions,
      start: tok.start,
      end: tok.end,
    };
  }

  // -------------------------------------------------------------------------
  //  Arrow-fn lookahead.
  // -------------------------------------------------------------------------

  /**
   * Try to parse `(a, b) => expr` or `a => expr` at the current cursor.
   * Returns `null` (without consuming any tokens) when the prefix isn't an
   * arrow function — the caller should fall back to ordinary expression
   * parsing.
   */
  private tryParseArrowFn(): ArrowFnNode | null {
    const start = this.pos;

    // Single bare-ident arrow: `x => x + 1`.
    if (this.peek().kind === 'identifier' && this.peek(1).kind === 'arrow') {
      const id = this.advance();
      if (FORBIDDEN_IDENTS.has(id.value)) {
        throw this.error(`'${id.value}' is not allowed as an arrow-fn parameter`, id);
      }
      const arrow = this.advance();
      const body = this.parseExpression();
      const param: IdentifierNode = {
        kind: 'Identifier',
        name: id.value,
        start: id.start,
        end: id.end,
      };
      return {
        kind: 'ArrowFn',
        params: [param],
        body,
        start: id.start,
        end: body.end,
      };
      void arrow;
    }

    // Parenthesised parameter list: scan ahead for `( ident, ident, ... ) =>`.
    if (this.peek().kind !== 'lparen') return null;

    // Snapshot — we'll rewind if this isn't actually an arrow fn.
    const openTok = this.peek();
    let i = this.pos + 1;
    const params: Token[] = [];
    // `()` is valid.
    if (this.tokens[i]?.kind !== 'rparen') {
      while (true) {
        const t = this.tokens[i];
        if (!t || t.kind !== 'identifier') return null;
        if (FORBIDDEN_IDENTS.has(t.value)) return null;
        params.push(t);
        i++;
        const sep = this.tokens[i];
        if (!sep) return null;
        if (sep.kind === 'comma') { i++; continue; }
        if (sep.kind === 'rparen') break;
        return null;
      }
    }
    // Now positioned on rparen.
    if (this.tokens[i]?.kind !== 'rparen') return null;
    i++;
    if (this.tokens[i]?.kind !== 'arrow') return null;

    // Commit.
    this.pos = i + 1; // past the `=>`
    const body = this.parseExpression();
    const idents: IdentifierNode[] = params.map((p) => ({
      kind: 'Identifier',
      name: p.value,
      start: p.start,
      end: p.end,
    }));
    void start;
    return {
      kind: 'ArrowFn',
      params: idents,
      body,
      start: openTok.start,
      end: body.end,
    };
  }

  // -------------------------------------------------------------------------
  //  Misc helpers.
  // -------------------------------------------------------------------------

  private isOp(...values: string[]): boolean {
    const t = this.peek();
    if (t.kind !== 'op') return false;
    return values.includes(t.value);
  }

  private isExpressionStart(t: Token): boolean {
    switch (t.kind) {
      case 'number':
      case 'string':
      case 'template':
      case 'identifier':
      case 'dollar':
      case 'lparen':
      case 'lbracket':
      case 'lbrace':
        return true;
      case 'op':
        return t.value === '+' || t.value === '-' || t.value === '!';
      default:
        return false;
    }
  }
}

// ---------------------------------------------------------------------------
//  Constructors for keyword literals (kept outside the class for brevity).
// ---------------------------------------------------------------------------

function literalBool(tok: Token, value: boolean): LiteralNode {
  return { kind: 'Literal', value, raw: 'boolean', start: tok.start, end: tok.end };
}
function literalNull(tok: Token): LiteralNode {
  return { kind: 'Literal', value: null, raw: 'null', start: tok.start, end: tok.end };
}
function literalUndefined(tok: Token): LiteralNode {
  return { kind: 'Literal', value: undefined, raw: 'undefined', start: tok.start, end: tok.end };
}

// ---------------------------------------------------------------------------
//  Caret rendering — one-line source snippet with `^` under the bad token.
//  Sibling #8 (diagnostics) re-uses this so we keep the format minimal and
//  deterministic.
// ---------------------------------------------------------------------------

function renderCaret(tokens: Token[], at: Token): string {
  return renderCaretAtSpan(tokens, at.start, at.end);
}

function renderCaretAtSpan(tokens: Token[], start: number, end: number): string {
  // We don't have direct access to the source string here, so the caret
  // is positional only: a column ruler relative to the first token.  Sibling
  // #8 can splice in real source context when it knows it.
  const base = tokens[0]?.start ?? 0;
  const col = Math.max(0, start - base);
  const width = Math.max(1, end - start);
  const ruler = ' '.repeat(col) + '^'.repeat(width);
  return `at offset ${start}\n${ruler}`;
}

// ---------------------------------------------------------------------------
//  Type-only re-exports (so callers don't need to reach into ./ast directly
//  when they already import the parser).
// ---------------------------------------------------------------------------

export type { Node, TemplateNode, Token } from './ast';
export { ParseError } from './ast';
