/**
 * AST types for the SabFlow executor expression language.
 *
 * The language is a strict JS-expression subset used inside `{{ ... }}`
 * interpolations.  A full template (text outside `{{ ... }}` + zero or more
 * `{{ ... }}` segments) parses to a {@link Template} node whose children are
 * an interleaved sequence of {@link Text} and {@link Expr} nodes.
 *
 * Owner: Track B Phase 4 sub-task #3.  The parser lives in `./parser.ts`;
 * sibling #2 owns the tokenizer (`./tokenizer.ts`) and is the source of the
 * {@link Token} shape consumed here.  We re-declare the structural Token
 * contract in this file so the AST module is self-contained and siblings
 * can converge on a single shape without a circular dep.
 *
 * Forbidden forms (reject at parse time, never represented in the AST):
 *   - `function` declarations or block-body expressions
 *   - `class` declarations
 *   - `new` expressions, except the specific `new Date(...)` call form
 *   - `eval`, `Function` constructor
 *   - `import`, `require`
 *   - assignment operators (`=`, `+=`, `-=`, ...)
 *   - any block / statement form (`{ ... }` as a statement, `;`, `return`, ...)
 *
 * These are surfaced as {@link ParseError}s by the parser.
 */

// ---------------------------------------------------------------------------
//  Shared token contract (sibling-owned tokenizer must produce this shape).
// ---------------------------------------------------------------------------

/**
 * Token kinds emitted by the executor tokenizer.  Kept intentionally broad so
 * the parser can drive an exhaustive switch.  Sibling #2's tokenizer is the
 * canonical producer.
 */
export type TokenKind =
  // structural
  | 'eof'
  | 'text'           // raw text outside `{{ ... }}` (carries verbatim string)
  | 'open'           // `{{`
  | 'close'          // `}}`
  // literals & names
  | 'number'
  | 'string'         // single- or double-quoted
  | 'template'       // backtick-quoted (template string literal)
  | 'identifier'     // bare identifier — keywords come through as 'identifier' too
  | 'dollar'         // identifier whose first character is `$`
  // punctuation
  | 'dot'            // `.`
  | 'optional'       // `?.`
  | 'comma'          // `,`
  | 'colon'          // `:`
  | 'question'       // `?`
  | 'lparen' | 'rparen'
  | 'lbracket' | 'rbracket'
  | 'lbrace' | 'rbrace'
  | 'arrow'          // `=>`
  // operators (value carries the exact lexeme — `+`, `-`, `===`, `??`, etc.)
  | 'op';

export interface Token {
  kind: TokenKind;
  /** Verbatim lexeme for `op`/`identifier`, decoded value for `string`/`number`. */
  value: string;
  /** Inclusive start offset in the original source. */
  start: number;
  /** Exclusive end offset in the original source. */
  end: number;
}

// ---------------------------------------------------------------------------
//  Source span shared by every AST node.
// ---------------------------------------------------------------------------

export interface Span {
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
//  Node union — each node carries `kind`, span fields, and its children.
// ---------------------------------------------------------------------------

export type Node =
  | TemplateNode
  | TextNode
  | ExprNode
  | LiteralNode
  | IdentifierNode
  | DollarIdentNode
  | MemberAccessNode
  | OptionalChainNode
  | IndexNode
  | CallNode
  | UnaryNode
  | BinaryNode
  | LogicalNode
  | TernaryNode
  | ArrayLitNode
  | ObjectLitNode
  | ArrowFnNode
  | TemplateStringNode;

export type Expression =
  | LiteralNode
  | IdentifierNode
  | DollarIdentNode
  | MemberAccessNode
  | OptionalChainNode
  | IndexNode
  | CallNode
  | UnaryNode
  | BinaryNode
  | LogicalNode
  | TernaryNode
  | ArrayLitNode
  | ObjectLitNode
  | ArrowFnNode
  | TemplateStringNode;

/** Root node: a sequence of raw text + `{{ ... }}` expression chunks. */
export interface TemplateNode extends Span {
  kind: 'Template';
  children: Array<TextNode | ExprNode>;
}

/** Verbatim text that appeared outside any `{{ ... }}` block. */
export interface TextNode extends Span {
  kind: 'Text';
  value: string;
}

/** Wrapper for a single `{{ ... }}` block — owns one parsed expression. */
export interface ExprNode extends Span {
  kind: 'Expr';
  expression: Expression;
}

/** Primitive literal: number, string, boolean, null, undefined. */
export interface LiteralNode extends Span {
  kind: 'Literal';
  value: string | number | boolean | null | undefined;
  /** Source-form kind — useful for re-printing & error messages. */
  raw: 'number' | 'string' | 'boolean' | 'null' | 'undefined';
}

/** Bare identifier (no leading `$`). */
export interface IdentifierNode extends Span {
  kind: 'Identifier';
  name: string;
}

/** Identifier starting with `$` (e.g. `$json`, `$node`, `$now`). */
export interface DollarIdentNode extends Span {
  kind: 'DollarIdent';
  name: string;
}

/** `obj.prop` — non-optional dotted access. */
export interface MemberAccessNode extends Span {
  kind: 'MemberAccess';
  object: Expression;
  property: string;
}

/** `obj?.prop` — optional dotted access; short-circuits to undefined. */
export interface OptionalChainNode extends Span {
  kind: 'OptionalChain';
  object: Expression;
  property: string;
}

/** `obj[expr]` — bracketed index access. */
export interface IndexNode extends Span {
  kind: 'Index';
  object: Expression;
  index: Expression;
}

/** Function / method call.  `new Date(...)` is the only `new` form allowed. */
export interface CallNode extends Span {
  kind: 'Call';
  callee: Expression;
  args: Expression[];
  /** True only for the whitelisted `new Date(...)` form. */
  isNew?: boolean;
}

/** Prefix unary: `+x`, `-x`, `!x`, `typeof x`. */
export interface UnaryNode extends Span {
  kind: 'Unary';
  operator: '+' | '-' | '!' | 'typeof';
  argument: Expression;
}

/** Arithmetic / comparison / equality (NOT `&&`, `||`, `??` — see {@link LogicalNode}). */
export interface BinaryNode extends Span {
  kind: 'Binary';
  operator:
    | '+' | '-' | '*' | '/' | '%'
    | '==' | '!=' | '===' | '!=='
    | '<' | '<=' | '>' | '>=';
  left: Expression;
  right: Expression;
}

/** Short-circuiting boolean / nullish operators. */
export interface LogicalNode extends Span {
  kind: 'Logical';
  operator: '&&' | '||' | '??';
  left: Expression;
  right: Expression;
}

/** `cond ? then : else`. */
export interface TernaryNode extends Span {
  kind: 'Ternary';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/** `[a, b, c]` */
export interface ArrayLitNode extends Span {
  kind: 'ArrayLit';
  elements: Expression[];
}

/** `{ key: value, "quoted": value, [expr]: value }` */
export interface ObjectLitNode extends Span {
  kind: 'ObjectLit';
  properties: ObjectProperty[];
}

export interface ObjectProperty extends Span {
  /** Static key form: `key:` or `"key":`. */
  key:
    | { kind: 'static'; name: string }
    | { kind: 'computed'; expression: Expression };
  value: Expression;
}

/** Arrow function — single-expression body only (`(x) => x * 2`). */
export interface ArrowFnNode extends Span {
  kind: 'ArrowFn';
  params: IdentifierNode[];
  body: Expression;
}

/** Backtick template string literal — `` `hello ${name}` ``. */
export interface TemplateStringNode extends Span {
  kind: 'TemplateString';
  /** Alternating literal-string + expression segments. */
  quasis: string[];
  expressions: Expression[];
}

// ---------------------------------------------------------------------------
//  Errors
// ---------------------------------------------------------------------------

/**
 * Thrown by the parser for any unexpected token, forbidden construct, or
 * unterminated form.  Carries the same span shape as AST nodes so callers can
 * highlight the bad range; `caret` is a pre-rendered single-line snippet
 * that downstream sibling #8 (diagnostics) can show verbatim.
 */
export class ParseError extends Error {
  public readonly start: number;
  public readonly end: number;
  public readonly caret: string;

  constructor(message: string, start: number, end: number, caret: string = '') {
    super(message);
    this.name = 'ParseError';
    this.start = start;
    this.end = end;
    this.caret = caret;
  }
}
