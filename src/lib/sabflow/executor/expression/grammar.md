# SabFlow Expression Grammar (n8n-Compatible Subset)

> Formal sketch for the executor-v2 expression layer. Companion to
> `docs/adr/sabflow-expression-syntax.md`. Siblings #2 (tokenizer),
> #3 (parser), #4 (evaluator), #5 (sandbox host) implement against this file.

The notation is **EBNF** with a few PEG-style conveniences:

- `?` optional, `*` zero-or-more, `+` one-or-more.
- `/` ordered choice (first match wins — PEG semantics, no backtracking
  past committed alternatives in #3's parser).
- Terminals are double-quoted (`"+"`); non-terminals are bare names.
- `~` separates rule head from body; `|` is unordered alternation
  (semantically equivalent to `/` here since we hand-write a
  Pratt-style parser).

---

## 1. Template layer (driver — sibling #2 entry point)

```ebnf
Template     ~ Segment*
Segment      ~ Expression / Escape / RawText
Escape       ~ "\\{{"                          (* emits literal "{{" *)
Expression   ~ "{{" Expr "}}"
RawText      ~ (?!"{{") (?!"\\{{") AnyChar     (* up to next {{ or EOF *)
```

The tokenizer streams `RawText` chunks straight through; only `Expression`
bodies feed the parser proper.

---

## 2. Lexical grammar (sibling #2)

```ebnf
(* Whitespace / comments *)
WS          ~ (" " | "\t" | "\r" | "\n")+
Comment     ~ NOT ALLOWED  (* no //, /* */ inside expressions *)

(* Identifiers *)
IdStart     ~ [A-Za-z_$]
IdCont      ~ [A-Za-z0-9_$]
Identifier  ~ IdStart IdCont*

(* Reserved — REJECTED at tokenize time *)
Forbidden   ~ "function" | "class" | "extends" | "new"
            | "import"   | "require" | "eval"  | "Function"
            | "await"    | "async"   | "yield" | "void"
            | "delete"   | "throw"   | "try"   | "catch"
            | "finally"  | "do"      | "while" | "for"
            | "if"       | "else"    | "switch"| "case"
            | "return"   | "var"     | "let"   | "const"
(* "new" is a SPECIAL case: tokenizer emits it, parser allows ONLY
   inside `NewDate ~ "new" "Date" "(" ")"` — anything else → parse error. *)

(* Literals *)
NumberLit   ~ ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e"|"E") ("+"|"-")? [0-9]+)?
StringLit   ~ '"' (NOT '"' / "\\" AnyChar)* '"'
            | "'" (NOT "'" / "\\" AnyChar)* "'"
TemplateLit ~ "`" (TemplateChars | TemplateSub)* "`"
TemplateSub ~ "${" Expr "}"
TemplateChars ~ (NOT "`" / NOT "${" / "\\" AnyChar)+
BoolLit     ~ "true" | "false"
NullLit     ~ "null"
UndefLit    ~ "undefined"

(* Punctuation tokens *)
Punct       ~ "(" | ")" | "[" | "]" | "{" | "}"
            | "." | "?." | "," | ":" | "?" | "..."
            | "=>"
            | "+" | "-" | "*" | "/" | "%" | "**"
            | "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">="
            | "&&" | "||" | "!" | "??"
            | "typeof" | "in"

(* HARD-REJECTED punctuation — tokenize error *)
Banned      ~ "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "**="
            | "++" | "--" | ";" | "&" | "|" | "^" | "~"
            | "<<" | ">>" | ">>>"
            | "/" Regex                          (* regex literal *)
```

Tokenizer error codes (for sibling #2 → #3 contract):

| Code                | Trigger                                         |
|---------------------|-------------------------------------------------|
| `E_FORBIDDEN_KW`    | A `Forbidden` keyword appears                   |
| `E_BANNED_PUNCT`    | A `Banned` token appears                        |
| `E_UNTERMINATED`    | String / template / `{{` not closed             |
| `E_BAD_ESCAPE`      | `\\` followed by invalid escape character       |
| `E_SIZE`            | Source > 64 KB                                  |

---

## 3. Expression grammar (sibling #3 — Pratt parser)

Top-level rule for the body inside `{{ … }}`:

```ebnf
Expr        ~ Conditional

Conditional ~ NullishCoalesce ("?" Expr ":" Expr)?
NullishCoalesce ~ LogicalOr ("??" LogicalOr)*
LogicalOr   ~ LogicalAnd ("||" LogicalAnd)*
LogicalAnd  ~ Equality   ("&&" Equality)*
Equality    ~ Relational (("==" | "!=" | "===" | "!==") Relational)*
Relational  ~ Additive   (("<" | "<=" | ">" | ">=" | "in") Additive)*
Additive    ~ Multiplicative (("+" | "-") Multiplicative)*
Multiplicative ~ Exponent (("*" | "/" | "%") Exponent)*
Exponent    ~ Unary ("**" Exponent)?            (* right-assoc *)
Unary       ~ ("!" | "-" | "+" | "typeof") Unary
            / Postfix
Postfix     ~ Primary Suffix*
Suffix      ~ "." Identifier
            / "?." Identifier
            / "[" Expr "]"
            / "?." "[" Expr "]"
            / Arguments
            / "?." Arguments

Arguments   ~ "(" (Spread / Expr) ("," (Spread / Expr))* ","? ")"
            / "(" ")"
Spread      ~ "..." Expr

Primary     ~ Literal
            / ArrayLit
            / ObjectLit
            / ArrowFn
            / ContextIdent
            / Identifier                         (* must resolve to allow-listed global *)
            / NewDate
            / "(" Expr ")"

NewDate     ~ "new" "Date" "(" Arguments? ")"   (* the ONLY new-form allowed *)

Literal     ~ NumberLit | StringLit | TemplateLit
            | BoolLit | NullLit | UndefLit

ArrayLit    ~ "[" (ArrayElem ("," ArrayElem)*)? ","? "]"
ArrayElem   ~ Spread / Expr

ObjectLit   ~ "{" (ObjectProp ("," ObjectProp)*)? ","? "}"
ObjectProp  ~ Spread
            / PropKey ":" Expr
            / Identifier                         (* shorthand: { x } == { x: x } *)
PropKey     ~ Identifier
            / StringLit
            / NumberLit
            / "[" Expr "]"                       (* computed key *)

ArrowFn     ~ ArrowParams "=>" Expr              (* EXPRESSION BODY ONLY *)
ArrowParams ~ Identifier
            / "(" (Identifier ("," Identifier)*)? ")"

ContextIdent ~ "$json" | "$now"   | "$today"
             | "$workflow" | "$execution"
             | "$itemIndex" | "$prevNode"
             | "$input"    | "$position"
             | "$node"
             | "$" "(" Expr ")"                 (* $('Node Name') *)
```

### 3.1 Parse-time rejections (parser MUST emit a hard error)

| Pattern                       | Error code               |
|-------------------------------|--------------------------|
| `=>` followed by `{`          | `E_BLOCK_ARROW`          |
| `new` not followed by `Date(` | `E_NEW_NONDATE`          |
| `,` as a top-level operator   | `E_COMMA_OP`             |
| Spread outside arg / literal  | `E_SPREAD_POSITION`      |
| Empty `{{ }}` body            | `E_EMPTY_EXPR`           |
| AST node count > 256          | `E_AST_TOO_LARGE`        |

### 3.2 AST node kinds (contract for sibling #4)

```ts
type Node =
  | { kind: "Number";     value: number }
  | { kind: "String";     value: string }
  | { kind: "Template";   quasis: string[]; exprs: Node[] }
  | { kind: "Bool";       value: boolean }
  | { kind: "Null" }
  | { kind: "Undefined" }
  | { kind: "Identifier"; name: string }       // includes $-prefixed context
  | { kind: "Array";      elements: (Node | Spread)[] }
  | { kind: "Object";     props: ObjectProp[] }
  | { kind: "Member";     object: Node; property: Node | string; computed: boolean; optional: boolean }
  | { kind: "Call";       callee: Node; args: (Node | Spread)[]; optional: boolean }
  | { kind: "Unary";      op: "!" | "-" | "+" | "typeof"; arg: Node }
  | { kind: "Binary";     op: BinaryOp; left: Node; right: Node }
  | { kind: "Logical";    op: "&&" | "||" | "??"; left: Node; right: Node }
  | { kind: "Conditional";test: Node; consequent: Node; alternate: Node }
  | { kind: "Arrow";      params: string[]; body: Node }
  | { kind: "NewDate";    args: (Node | Spread)[] }
  | { kind: "DollarCall"; arg: Node };          // $('Node Name')

type Spread     = { kind: "Spread"; arg: Node }
type ObjectProp =
  | { kind: "Prop";      key: Node | string; computed: boolean; value: Node }
  | { kind: "Shorthand"; name: string }
  | Spread;
```

Every node carries `{ loc: { start, end } }` for editor diagnostics; omitted
above for brevity.

---

## 4. Evaluation contract (sibling #4 — informative)

The evaluator walks the AST with a frozen root scope assembled at workflow
run-start:

```ts
type RootScope = {
  $json: unknown;
  $node: Record<string, unknown> & ((name: string) => unknown);
  $now: DateTime;
  $today: DateTime;
  $workflow: { id: string; name: string; active: boolean };
  $execution: { id: string; mode: "manual" | "trigger" | "retry"; resumeUrl?: string };
  $itemIndex: number;
  $prevNode: { name: string; outputIndex: number; runIndex: number };
  $input: { all(): unknown[]; first(): unknown; last(): unknown; item: unknown };
  $position: { x: number; y: number };
  // allow-listed globals (frozen)
  Math: typeof Math; JSON: typeof JSON;
  Number: typeof Number; String: typeof String; Boolean: typeof Boolean;
  Object: { keys; values; entries; fromEntries };
  Array:  { isArray; from; of };
  Date:   DateConstructorSubset;
  DateTime: LuxonLikeStatic;
};
```

Method calls are gated by an allow-list keyed on receiver brand
(see ADR §5). Unknown method → `E_METHOD_NOT_ALLOWED` at runtime.

---

## 5. Worked examples

| Source                                              | Verdict       |
|-----------------------------------------------------|---------------|
| `{{ $json.name }}`                                  | OK            |
| `{{ $json.items.map(i => i.qty).reduce((a,b)=>a+b,0) }}` | OK        |
| `{{ $now.plus({ days: 7 }).toFormat("yyyy-LL-dd") }}` | OK          |
| `{{ DateTime.fromISO($json.ts).toMillis() }}`       | OK            |
| `{{ $node["HTTP Request"].json.id ?? "missing" }}`  | OK            |
| `{{ ({...$json, processed: true}) }}`               | OK            |
| `\\{{ literal }}`                                   | OK → emits `{{ literal }}` |
| `{{ function f(){} }}`                              | `E_FORBIDDEN_KW`         |
| `{{ x = 5 }}`                                       | `E_BANNED_PUNCT`         |
| `{{ (x) => { return x } }}`                         | `E_BLOCK_ARROW`          |
| `{{ new Foo() }}`                                   | `E_NEW_NONDATE`          |
| `{{ eval("1+1") }}`                                 | `E_FORBIDDEN_KW`         |
| `{{ /foo/g.test(x) }}`                              | `E_BANNED_PUNCT`         |
| `{{ a; b }}`                                        | `E_BANNED_PUNCT`         |

---

## 6. Implementation notes for siblings #2–#5

- **#2 tokenizer** — single-pass, emits `Token { kind, value, start, end }`.
  Reject `Forbidden` / `Banned` immediately; do NOT defer to the parser.
- **#3 parser** — Pratt-style; expression-only (no statement entry point).
  Precedence table mirrors §3. Cache AST keyed by `(template, hash)` in an
  LRU shared with the executor — typical workflow re-evaluates the same
  templates thousands of times.
- **#4 evaluator** — recursive walker, no `eval`, no `Function`. Method
  dispatch goes through a registry: `dispatch(receiver, methodName, args)`.
  All built-ins are frozen module-load-time.
- **#5 sandbox host** — provides the `DateTime` shim, freezes globals,
  enforces wall-clock + node-count budgets per ADR §8, and surfaces
  `SabFlowExpressionParseError` / `SabFlowExpressionRuntimeError` to the
  executor's existing error pipeline.

End of grammar.
