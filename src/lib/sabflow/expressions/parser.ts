/**
 * Recursive-descent parser for the SabFlow expression language.
 *
 * Grammar (lowest → highest precedence):
 *
 *   expression       := ternary
 *   ternary          := logicalOr ( "?" expression ":" expression )?
 *   logicalOr        := logicalAnd ( "||" logicalAnd )*
 *   logicalAnd       := equality   ( "&&" equality )*
 *   equality         := comparison ( ("=="|"!="|"==="|"!==") comparison )*
 *   comparison       := additive   ( ("<"|">"|"<="|">=") additive )*
 *   additive         := multiplicative ( ("+"|"-") multiplicative )*
 *   multiplicative   := unary      ( ("*"|"/"|"%") unary )*
 *   unary            := ("!"|"-") unary | accessChain
 *   accessChain      := primary ( "." IDENT | "[" expression "]" | "(" args ")" )*
 *   primary          := NUMBER | STRING | "true" | "false" | "null" | "undefined"
 *                     | IDENT | "(" expression ")"
 *   args             := ( expression ( "," expression )* )?
 */

import type { Token } from './tokenizer';

export type ASTNode =
  | { kind: 'Literal'; value: string | number | boolean | null | undefined }
  | { kind: 'Identifier'; name: string }
  | { kind: 'MemberAccess'; object: ASTNode; property: string; optional: boolean }
  | { kind: 'IndexAccess'; object: ASTNode; index: ASTNode }
  | { kind: 'CallExpression'; callee: ASTNode; args: ASTNode[] }
  | { kind: 'BinaryOp'; op: BinaryOpToken; left: ASTNode; right: ASTNode }
  | { kind: 'UnaryOp'; op: '!' | '-'; argument: ASTNode }
  | { kind: 'Conditional'; test: ASTNode; consequent: ASTNode; alternate: ASTNode };

export type BinaryOpToken =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '===' | '!=='
  | '<' | '>' | '<=' | '>='
  | '&&' | '||';

export class ParseError extends Error {
  public readonly pos: number;
  constructor(message: string, pos: number) {
    super(`Parse error at ${pos}: ${message}`);
    this.name = 'ParseError';
    this.pos = pos;
  }
}

class Parser {
  private readonly tokens: Token[];
  private i: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset: number = 0): Token {
    return this.tokens[this.i + offset];
  }

  private advance(): Token {
    return this.tokens[this.i++];
  }

  private check(type: Token['type'], value?: string): boolean {
    const t = this.peek();
    if (!t || t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  private match(type: Token['type'], value?: string): Token | null {
    if (!this.check(type, value)) return null;
    return this.advance();
  }

  private expect(type: Token['type'], value?: string): Token {
    if (!this.check(type, value)) {
      const t = this.peek();
      const expected = value ? `${type} '${value}'` : type;
      const actual = t ? `${t.type} '${t.value}'` : 'end-of-input';
      throw new ParseError(`expected ${expected}, got ${actual}`, t?.pos ?? -1);
    }
    return this.advance();
  }

  /** Entry point.  Parses the whole token list as a single expression. */
  public parseExpression(): ASTNode {
    const node = this.parseTernary();
    if (!this.check('eof')) {
      const t = this.peek();
      throw new ParseError(`unexpected token '${t.value}'`, t.pos);
    }
    return node;
  }

  // ── Ternary (conditional) ──────────────────────────────
  private parseTernary(): ASTNode {
    const test = this.parseLogicalOr();
    if (this.match('question')) {
      const consequent = this.parseTernary();
      this.expect('colon');
      const alternate = this.parseTernary();
      return { kind: 'Conditional', test, consequent, alternate };
    }
    return test;
  }

  // ── Logical OR ─────────────────────────────────────────
  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    while (this.check('logical', '||')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { kind: 'BinaryOp', op: '||', left, right };
    }
    return left;
  }

  // ── Logical AND ────────────────────────────────────────
  private parseLogicalAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.check('logical', '&&')) {
      this.advance();
      const right = this.parseEquality();
      left = { kind: 'BinaryOp', op: '&&', left, right };
    }
    return left;
  }

  // ── Equality ───────────────────────────────────────────
  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (
      this.check('cmp', '==') ||
      this.check('cmp', '!=') ||
      this.check('cmp', '===') ||
      this.check('cmp', '!==')
    ) {
      const op = this.advance().value as BinaryOpToken;
      const right = this.parseComparison();
      left = { kind: 'BinaryOp', op, left, right };
    }
    return left;
  }

  // ── Comparison ─────────────────────────────────────────
  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    while (
      this.check('cmp', '<') ||
      this.check('cmp', '>') ||
      this.check('cmp', '<=') ||
      this.check('cmp', '>=')
    ) {
      const op = this.advance().value as BinaryOpToken;
      const right = this.parseAdditive();
      left = { kind: 'BinaryOp', op, left, right };
    }
    return left;
  }

  // ── Additive ───────────────────────────────────────────
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (this.check('op', '+') || this.check('op', '-')) {
      const op = this.advance().value as BinaryOpToken;
      const right = this.parseMultiplicative();
      left = { kind: 'BinaryOp', op, left, right };
    }
    return left;
  }

  // ── Multiplicative ─────────────────────────────────────
  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();
    while (
      this.check('op', '*') ||
      this.check('op', '/') ||
      this.check('op', '%')
    ) {
      const op = this.advance().value as BinaryOpToken;
      const right = this.parseUnary();
      left = { kind: 'BinaryOp', op, left, right };
    }
    return left;
  }

  // ── Unary ──────────────────────────────────────────────
  private parseUnary(): ASTNode {
    if (this.check('logical', '!')) {
      this.advance();
      return { kind: 'UnaryOp', op: '!', argument: this.parseUnary() };
    }
    if (this.check('op', '-')) {
      this.advance();
      return { kind: 'UnaryOp', op: '-', argument: this.parseUnary() };
    }
    return this.parseAccessChain();
  }

  // ── Access chain (.prop, [idx], (args)) ────────────────
  private parseAccessChain(): ASTNode {
    let node = this.parsePrimary();
    // Keep chaining access/call suffixes.
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      if (this.match('dot')) {
        const name = this.expect('identifier').value;
        node = { kind: 'MemberAccess', object: node, property: name, optional: false };
        continue;
      }
      if (this.match('lbracket')) {
        const index = this.parseTernary();
        this.expect('rbracket');
        node = { kind: 'IndexAccess', object: node, index };
        continue;
      }
      if (this.match('lparen')) {
        const args: ASTNode[] = [];
        if (!this.check('rparen')) {
          args.push(this.parseTernary());
          while (this.match('comma')) {
            args.push(this.parseTernary());
          }
        }
        this.expect('rparen');
        node = { kind: 'CallExpression', callee: node, args };
        continue;
      }
      break;
    }
    return node;
  }

  // ── Primary ────────────────────────────────────────────
  private parsePrimary(): ASTNode {
    const t = this.peek();
    if (t.type === 'number') {
      this.advance();
      return { kind: 'Literal', value: Number(t.value) };
    }
    if (t.type === 'string') {
      this.advance();
      return { kind: 'Literal', value: t.value };
    }
    if (t.type === 'identifier') {
      this.advance();
      if (t.value === 'true') return { kind: 'Literal', value: true };
      if (t.value === 'false') return { kind: 'Literal', value: false };
      if (t.value === 'null') return { kind: 'Literal', value: null };
      if (t.value === 'undefined') return { kind: 'Literal', value: undefined };
      return { kind: 'Identifier', name: t.value };
    }
    if (t.type === 'lparen') {
      this.advance();
      const inner = this.parseTernary();
      this.expect('rparen');
      return inner;
    }
    throw new ParseError(`unexpected token '${t.value}'`, t.pos);
  }
}

/** Parse a token stream into an AST. */
export function parse(tokens: Token[]): ASTNode {
  return new Parser(tokens).parseExpression();
}
