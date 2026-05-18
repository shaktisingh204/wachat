# ADR: SabFlow Expression Syntax (n8n-Compatible Subset)

- **Status**: Accepted
- **Date**: 2026-05-18
- **Owners**: SabFlow executor team
- **Track**: B — Phase 4, sub-task #1 of 10
- **Companion**: `src/lib/sabflow/executor/expression/grammar.md` (formal grammar for siblings #2–#5)

## Summary (≤200 words)

SabFlow adopts n8n's `{{ ... }}` template-expression model for parity with the
n8n migration inventory (`docs/N8N_MIGRATION_INVENTORY.md`). Anywhere a node
parameter accepts a string, the executor scans for `{{ expr }}` segments,
evaluates each `expr` against the current run context, and splices the result
back into the surrounding template. Outside the braces, text is opaque.

The expression body is a **restricted JavaScript-ish expression** — no
statements, no declarations, no side effects. Permitted: identifiers from a
fixed context set (`$json`, `$node`, `$now`, `$today`, `$workflow`,
`$execution`, `$itemIndex`, `$prevNode`, `$input`, `$position`, `$(...)`),
object/array literals, member access (dot, bracket, optional `?.`), call
expressions on an allow-listed method surface (string/array/number prototypes,
`Math.*`, `JSON.parse/stringify`, `Object.keys`, `Array.isArray`, luxon-style
`DateTime`), arithmetic/comparison/logical/ternary/nullish operators.

Explicitly forbidden and **must be rejected at tokenize/parse time**:
`function`, `class`, block-bodied arrow functions, assignments, `new` (except
`new Date()`), `eval`, `Function`, `import`, `require`, statement
terminators (`;`). This keeps every expression a pure value-producer suitable
for the V8 isolate sandbox without VM-context bridging.

Siblings #2 (tokenizer), #3 (parser), #4 (evaluator), #5 (sandbox host)
implement against the grammar file.

## Context

The n8n migration inventory enumerates ~600 community workflows that rely on
`{{ $json.foo }}`-style interpolation. To re-host them inside SabFlow without
rewriting every parameter, the executor needs a drop-in expression layer.
We already ship a minimal expression evaluator at
`src/lib/sabflow/expressions/`; this ADR is the **executor-side** v2 that
supersedes it for n8n-imported flows and runs inside the upcoming Phase 4
sandbox.

## Decision

### 1. Lexical envelope

- Expressions are wrapped in **`{{` … `}}`** inside any template string.
- The opening `{{` and closing `}}` must be balanced; nested `{{ }}` is not
  permitted (use a sub-expression instead).
- Escapes: `\{{` produces a literal `{{` and is **not** parsed as an
  expression opener.
- An expression body is single-line in spirit but may contain whitespace and
  newlines (treated as insignificant outside string literals).

### 2. In-scope identifiers (context)

The evaluator injects a fixed root scope. No other free identifiers resolve.

| Identifier        | Type                      | Meaning                                  |
|-------------------|---------------------------|------------------------------------------|
| `$json`           | object                    | Current item payload                     |
| `$node["Name"]`   | object                    | Output of another node by display name   |
| `$node.NodeName`  | object                    | Same, dot form (when name is identifier) |
| `$('Node Name')`  | function → object         | Functional form of `$node["Name"]`       |
| `$now`            | `DateTime`                | Luxon-like "now" at run start            |
| `$today`          | `DateTime`                | `$now` floored to local midnight         |
| `$workflow`       | object                    | `{ id, name, active }`                   |
| `$execution`      | object                    | `{ id, mode, resumeUrl }`                |
| `$itemIndex`      | number                    | Zero-based index in current item batch   |
| `$prevNode`       | object                    | `{ name, outputIndex, runIndex }`        |
| `$input`          | object                    | `{ all(), first(), last(), item }`       |
| `$position`       | object                    | `{ x, y }` of the current node           |

The bare globals `Math`, `JSON`, `Number`, `String`, `Boolean`, `Object`,
`Array`, `Date`, `DateTime` are also pre-bound (frozen, allow-listed members
only — see grammar).

### 3. Permitted syntax

- **Literals**: number, string (single/double/template — see §6), boolean,
  `null`, `undefined`, object literal, array literal.
- **Member access**: `a.b`, `a["b"]`, `a?.b`, `a?.["b"]`.
- **Call expressions**: `fn(args)` where `fn` is a member of an allow-listed
  prototype/global, or one of the context functions (`$(...)`, `$input.all()`,
  …).
- **Operators**: `+ - * / % **`, `== != === !== < <= > >=`, `&& || !`, `??`,
  `?:` ternary, `typeof`, `in`.
- **Optional chaining + nullish coalescing**: `a?.b ?? "default"`.
- **Arrow functions** — **expression-bodied only**: `x => x.toUpperCase()`,
  `(a, b) => a + b`. Required for `.map`, `.filter`, `.reduce` callbacks.
- **Spread in argument/literal position**: `Math.max(...arr)`,
  `[...a, ...b]`, `{ ...obj, x: 1 }`.

### 4. Forbidden syntax (parser MUST reject)

| Forbidden                                | Reason                                |
|------------------------------------------|---------------------------------------|
| `function` keyword                       | Statement-like, opens hoisting holes  |
| Block-bodied arrow `(x) => { return x }` | Statements not allowed                |
| `class`, `extends`                       | No prototype mutation in sandbox      |
| `new X(...)` (any X ≠ `Date`)            | Only `new Date()` whitelisted         |
| `=`, `+=`, `-=`, `++`, `--`              | No side effects                       |
| `;` statement terminator                 | Expression must be a single value     |
| `,` comma operator at top level          | Ambiguous with arg lists              |
| `eval`, `Function`                       | Sandbox escape vectors                |
| `import`, `require`, `await`, `async`    | No module / async surface             |
| `void`, `delete`                         | No void/side-effect operators         |
| Labels, `try/catch`, `throw`             | No statements at all                  |
| Regex literals (`/foo/g`)                | Deferred to v2.1                      |
| Tagged templates                         | Deferred to v2.1                      |
| Bitwise (`& | ^ ~ << >> >>>`)            | Deferred — rarely used in n8n flows   |

Rejection happens at **tokenize time** when possible (e.g. `function`,
`class`, `import`, `require`, `eval`, `Function`, `await`, `async`), else at
**parse time** (e.g. block-body arrows, assignments, `new Foo()`).

### 5. Allow-listed method surface

The evaluator (sibling #4) holds an allow-list keyed by receiver kind. The
parser does not need to know the list — it only validates *syntactic* shape.
The evaluator throws `ExpressionError("method not allowed: …")` at runtime
when an unknown method is invoked.

- **String.prototype**: `toUpperCase`, `toLowerCase`, `trim`, `trimStart`,
  `trimEnd`, `replace`, `replaceAll`, `split`, `slice`, `substring`,
  `includes`, `startsWith`, `endsWith`, `indexOf`, `padStart`, `padEnd`,
  `repeat`, `concat`, `match`, `at`, `normalize`.
- **Array.prototype**: `map`, `filter`, `reduce`, `find`, `findIndex`, `some`,
  `every`, `includes`, `indexOf`, `join`, `slice`, `concat`, `flat`,
  `flatMap`, `at`, `sort` (returns copy).
- **Number.prototype**: `toFixed`, `toString`, `toPrecision`.
- **Math**: `abs`, `ceil`, `floor`, `round`, `min`, `max`, `pow`, `sqrt`,
  `random`, `sign`, `trunc`, `log`, `log10`, `log2`, `exp`, `PI`, `E`.
- **JSON**: `parse`, `stringify`.
- **Object**: `keys`, `values`, `entries`, `fromEntries`.
- **Array**: `isArray`, `from`, `of`.
- **Date**: `new Date()`, `Date.now()`, `Date.parse()`, `Date.UTC()`, all
  read-only instance getters (`getFullYear`, `getMonth`, `getDate`,
  `getHours`, `getMinutes`, `getSeconds`, `getDay`, `getTime`, `toISOString`,
  `toJSON`, `toString`).
- **DateTime** (luxon-like, provided by host): `now`, `local`, `utc`,
  `fromISO`, `fromMillis`, `fromObject`, `fromFormat`, and on instances:
  `plus`, `minus`, `set`, `startOf`, `endOf`, `toFormat`, `toISO`,
  `toMillis`, `toISODate`, `toJSDate`, `diff`, `equals`,
  `year`/`month`/`day`/`hour`/`minute`/`second` getters.

### 6. Template strings inside expressions

Backtick template literals are permitted **as values**, e.g.
`{{ \`Hello ${$json.name}\` }}`. Inside `${ … }` the same grammar applies
recursively. No tagged templates.

### 7. Error model

- **Parse error** → `SabFlowExpressionParseError` with `{ message, offset,
  source }`. Surfaces in the node editor as a red squiggle; node fails fast
  at execution start.
- **Runtime error** → `SabFlowExpressionRuntimeError` with `{ message,
  source, path }` where `path` is the dotted access chain at fault. The
  executor's existing retry/continue-on-error policy applies.
- **Type coercion** follows JavaScript semantics (we intentionally keep
  `"5" + 3 === "53"` for n8n parity).

### 8. Performance budget

- Tokenize + parse ≤ 1 ms per expression on a typical workflow.
- Evaluation ≤ 100 µs cold, ≤ 10 µs warm (parsed AST cached per template).
- Hard cap: 256 AST nodes per expression, 64 KB source. Exceeding either is a
  parse error.

## Consequences

- **Positive**: Drop-in n8n compatibility for `{{ }}` templates; no VM context
  bridging needed; predictable static surface for IDE autocomplete.
- **Negative**: Some advanced n8n flows using regex literals or tagged
  templates need a one-time rewrite at import.
- **Migration**: Existing SabFlow expressions under `src/lib/sabflow/
  expressions/` keep working in legacy nodes; only nodes flagged
  `engine: "executor-v2"` go through the new pipeline.

## Out of scope

- Module imports, async/await, top-level `await`.
- Regex literals, tagged templates, bitwise ops (v2.1 candidates).
- Statement-level control flow — by design, expressions are pure.

## References

- `src/lib/sabflow/executor/expression/grammar.md` — formal EBNF.
- `docs/N8N_MIGRATION_INVENTORY.md` — workflow corpus driving requirements.
- `src/lib/sabflow/expressions/` — legacy v1 evaluator (kept for non-migrated
  nodes).
