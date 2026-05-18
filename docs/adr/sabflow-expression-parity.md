# ADR: SabFlow Expression Engine — Rust ↔ TS Parity Status

- **Status**: Accepted
- **Date**: 2026-05-18
- **Owners**: SabFlow executor team
- **Track**: C — Phase 2 sub-task #4 (coverage / parity)
- **Companions**:
  - `docs/adr/sabflow-expression-syntax.md` — the canonical spec
  - `src/lib/sabflow/executor/expression/grammar.md` — formal EBNF
  - `rust/crates/sabflow-executor/expression/tests/parity.rs` — the
    acceptance suite this ADR governs

## Summary (≤200 words)

SabFlow's executor lives partly in TypeScript (`src/lib/sabflow/
executor/expression/`) and partly in Rust (`rust/crates/sabflow-
executor/expression/`). The TS side is the **reference implementation**:
tokenizer, parser, AST evaluator, sandbox, and a 40-entry corpus already
ship there. The Rust crate is presently a **scaffold** — `lib.rs`
exports only `placeholder()` returning a literal string. No
tokenization, parsing, evaluation, or sandbox enforcement happens in
Rust today.

To keep parity locked from the moment the Rust evaluator starts, this
ADR ships a fixture-driven test corpus
(`rust/crates/sabflow-executor/expression/tests/fixtures/`) and a Rust
test harness (`parity.rs`). Every parity test is marked `#[ignore]` with
a reason string so `cargo test` stays green while
`cargo test -- --ignored` exposes the exact set of grammar features
still missing from the Rust side. As the Rust evaluator lands feature by
feature, the corresponding `#[ignore]` is removed; once every test
passes, the crate is at TS parity and Rust nodes can stop bouncing
expression evaluation back to the Node sidecar.

## Context

The n8n migration inventory (`docs/N8N_MIGRATION_INVENTORY.md`) and the
SabFlow expression spec (`docs/adr/sabflow-expression-syntax.md`)
together define a restricted JavaScript-ish expression grammar that
appears anywhere a node parameter accepts a string. The TS evaluator
ships in `src/lib/sabflow/executor/expression/`:

| File              | Role                                       |
|-------------------|--------------------------------------------|
| `tokenizer.ts`    | Lex `{{ … }}` and the body inside          |
| `parser.ts`       | Pratt parser per grammar.md                |
| `ast.ts`          | Discriminated-union AST contract           |
| `evaluator.ts`    | Tree-walking interpreter                   |
| `sandbox.ts`      | Wall-clock / depth / global allowlist caps |
| `builtins.ts`     | Allow-listed method registry               |
| `coerce.ts`       | JS-parity type coercion                    |
| `diagnose.ts`     | Editor-facing parse / runtime error shapes |
| `__tests__/`      | `corpus.json` (40 cases) + fuzz tests      |

The Rust executor's expression crate
(`rust/crates/sabflow-executor/expression/`) is the equivalent layer for
the in-process Rust node runtime — it must evaluate the same templates
and reject the same forbidden constructs, so a flow imported from n8n
behaves identically regardless of whether a node was scheduled into the
Rust executor or the Node sidecar.

## Decision

### 1. Single ground truth

The TS evaluator (`src/lib/sabflow/executor/expression/`) is the
**reference**. Disagreements between TS and Rust on any grammar feature
listed in `sabflow-expression-syntax.md` are a Rust-side bug unless the
TS side also fails the corpus entry. The Rust crate MUST be tested
against the same surface.

### 2. Fixture format

Every fixture lives at
`rust/crates/sabflow-executor/expression/tests/fixtures/<slug>/` and
contains exactly three files:

```
fixtures/<slug>/
  expression.txt   — the literal template (may have surrounding text)
  context.json     — root scope as JSON (keys: $json, $now, $execution, …)
  expected.json    — { kind: "value", value: <any> }
                     OR
                     { kind: "error", errorCode: "E_…",
                       errorMessageSubstring: "…" }
```

`expected.json` may also carry a `notes` field tying the fixture back to
a specific ADR clause. Fixtures are author-owned, never generated.

### 3. Test harness

`tests/parity.rs` exposes:

- `fixtures_corpus_is_well_formed` — non-ignored. Iterates the corpus,
  parses each `expected.json`, fails if any fixture is malformed or the
  count drops below 10. This is the only test that runs in default CI.
- `parity_*` — one per fixture. Every one is `#[ignore = "scaffold: …"]`
  with a reason string explaining WHY (parser missing, sandbox not
  wired, etc.). They become unignored as the Rust evaluator gains
  features; each unignored test that fails is a parity regression.

### 4. Coverage matrix

Per-feature status of the Rust evaluator against
`sabflow-expression-syntax.md`. `❌ missing` is the default for every
row today — the Rust crate is a scaffold. When the evaluator lands,
flip rows to `✅ covered` (or `⚠️ partial` with a TODO) and remove the
matching `#[ignore]` in `parity.rs`.

#### Lexical envelope (ADR §1)

| Feature                                  | TS  | Rust         | Fixture                          |
|------------------------------------------|-----|--------------|----------------------------------|
| `{{ … }}` interpolation                  | ✅  | ❌ missing   | `json_field_access`              |
| Mixed text + interpolation               | ✅  | ❌ missing   | `template_string`                |
| `\{{` literal escape                     | ✅  | ❌ missing   | _todo: add fixture once Rust lands_ |
| Balanced-brace enforcement               | ✅  | ❌ missing   | _todo_                           |

#### In-scope identifiers (ADR §2)

| Identifier      | TS  | Rust         | Fixture                          |
|-----------------|-----|--------------|----------------------------------|
| `$json`         | ✅  | ❌ missing   | `json_field_access`              |
| `$node[...]`    | ✅  | ❌ missing   | `node_bracket_lookup`            |
| `$node.Foo`     | ✅  | ❌ missing   | _todo_                           |
| `$('Name')`     | ✅  | ❌ missing   | _todo_                           |
| `$now`          | ✅  | ❌ missing   | `now_iso_string`                 |
| `$today`        | ✅  | ❌ missing   | _todo_                           |
| `$workflow`     | ✅  | ❌ missing   | _todo_                           |
| `$execution`    | ✅  | ❌ missing   | `execution_id`                   |
| `$itemIndex`    | ✅  | ❌ missing   | `template_string`                |
| `$prevNode`     | ✅  | ❌ missing   | _todo_                           |
| `$input`        | ✅  | ❌ missing   | _todo_                           |
| `$position`     | ✅  | ❌ missing   | _todo_                           |
| Frozen `Math`   | ✅  | ❌ missing   | `math_max_spread`                |
| Frozen `JSON`   | ✅  | ❌ missing   | _todo_                           |
| Frozen `Date`   | ✅  | ❌ missing   | `new_date_allowed`               |
| `DateTime`      | ✅  | ❌ missing   | _todo_                           |

#### Permitted syntax (ADR §3)

| Construct                         | TS  | Rust         | Fixture                          |
|-----------------------------------|-----|--------------|----------------------------------|
| Number / string / bool / null     | ✅  | ❌ missing   | _todo (mirror TS corpus)_        |
| Template literal `\`${x}\``       | ✅  | ❌ missing   | _todo_                           |
| Member `a.b`, `a["b"]`            | ✅  | ❌ missing   | `json_field_access`              |
| Array index `a[0]`                | ✅  | ❌ missing   | `array_indexing`                 |
| Optional chaining `a?.b`          | ✅  | ❌ missing   | `optional_chaining_nullish`      |
| Nullish coalescing `??`           | ✅  | ❌ missing   | `optional_chaining_nullish`      |
| Call expressions                  | ✅  | ❌ missing   | `now_iso_string`, others         |
| Arithmetic `+ - * / % **`         | ✅  | ❌ missing   | `arithmetic_add`                 |
| Comparison `== != === !== < >`    | ✅  | ❌ missing   | _todo_                           |
| Logical `&& \|\| !`               | ✅  | ❌ missing   | _todo_                           |
| Ternary `?:`                      | ✅  | ❌ missing   | _todo_                           |
| `typeof`, `in`                    | ✅  | ❌ missing   | _todo_                           |
| Expression-body arrow             | ✅  | ❌ missing   | `arrow_map_filter`               |
| Spread in args / arrays / objects | ✅  | ❌ missing   | `math_max_spread`                |
| `new Date(...)`                   | ✅  | ❌ missing   | `new_date_allowed`               |

#### Forbidden syntax (ADR §4) — must REJECT

| Construct                      | TS rejects | Rust         | Fixture                       |
|--------------------------------|------------|--------------|-------------------------------|
| `function` keyword             | ✅         | ❌ missing   | _todo_                        |
| Block-body arrow `(x)=>{ … }`  | ✅         | ❌ missing   | _todo_                        |
| `class`, `extends`             | ✅         | ❌ missing   | _todo_                        |
| `new X()` (X ≠ `Date`)         | ✅         | ❌ missing   | `new_function_rejected` (also via Function kw) |
| `=`, `+=`, `++`, `--`          | ✅         | ❌ missing   | _todo_                        |
| `;` statement terminator       | ✅         | ❌ missing   | _todo_                        |
| `,` comma operator             | ✅         | ❌ missing   | _todo_                        |
| `eval`, `Function`             | ✅         | ❌ missing   | `new_function_rejected`       |
| `import`, `require`            | ✅         | ❌ missing   | _todo_                        |
| `await`, `async`               | ✅         | ❌ missing   | _todo_                        |
| `void`, `delete`               | ✅         | ❌ missing   | _todo_                        |
| Regex literal `/foo/g`         | ✅         | ❌ missing   | _todo_                        |
| Tagged templates               | ✅         | ❌ missing   | _todo_                        |
| Bitwise `& \| ^ ~ << >> >>>`   | ✅         | ❌ missing   | _todo_                        |
| `globalThis` lookup            | ✅         | ❌ missing   | `global_this_blocked`         |

#### Allow-listed methods (ADR §5)

| Surface             | TS  | Rust         | Notes                                  |
|---------------------|-----|--------------|----------------------------------------|
| String.prototype    | ✅  | ❌ missing   | toUpperCase, replace, split, …         |
| Array.prototype     | ✅  | ❌ missing   | map, filter, reduce, find, includes, … |
| Number.prototype    | ✅  | ❌ missing   | toFixed, toString, toPrecision         |
| Math                | ✅  | ❌ missing   | abs..random, PI, E                     |
| JSON                | ✅  | ❌ missing   | parse, stringify                       |
| Object              | ✅  | ❌ missing   | keys, values, entries, fromEntries     |
| Array (static)      | ✅  | ❌ missing   | isArray, from, of                      |
| Date (instance)     | ✅  | ❌ missing   | read-only getters + new Date()         |
| DateTime (luxon)    | ✅  | ❌ missing   | host shim, not std luxon               |

#### Error model (ADR §7)

| Concern                                  | TS  | Rust         |
|------------------------------------------|-----|--------------|
| `SabFlowExpressionParseError { offset }` | ✅  | ❌ missing   |
| `SabFlowExpressionRuntimeError { path }` | ✅  | ❌ missing   |
| JS-parity coercion (e.g. `"5" + 3`)      | ✅  | ❌ missing   |

#### Performance budget (ADR §8)

| Budget                                   | TS measured | Rust         |
|------------------------------------------|-------------|--------------|
| Parse ≤ 1 ms                             | ✅          | ❌ missing   |
| Eval ≤ 100 µs cold / ≤ 10 µs warm        | ✅          | ❌ missing   |
| 256-AST-node cap                         | ✅          | ❌ missing   |
| 64 KB source cap                         | ✅          | ❌ missing   |

### 5. Major gap summary

- **No tokenizer**: `Forbidden` / `Banned` rejection in
  `grammar.md` §2 is not enforced on the Rust side.
- **No parser**: the Pratt grammar in `grammar.md` §3 is not realised
  in Rust; nothing produces an AST.
- **No evaluator**: the `EvalScope` / built-in dispatch contract
  (`grammar.md` §4) is unimplemented.
- **No sandbox**: `Sandbox.tick`, depth / time / size caps
  (`sandbox.ts`) have no Rust counterpart.
- **No AST cache**: the LRU keyed by `(template, hash)`
  (`grammar.md` §6) does not exist; every Rust node today would re-parse.

Until the gaps close, Rust nodes that need expression evaluation MUST
delegate to the Node sidecar (see `src/lib/sabflow/engine/executeBlock.ts`
+ `engine-client.ts`). The fixtures in this ADR are the contract for
when that delegation can stop.

## Consequences

- **Positive**: TS and Rust now have a single, file-based parity
  contract; new spec features land as new fixtures, and the `#[ignore]`
  reason string makes the gap list legible in `cargo test` output.
- **Negative**: Until the Rust evaluator exists, parity is enforced
  one-way (TS-side corpus is run; Rust-side suite is dormant). A bug
  introduced in the TS evaluator after fixtures are committed would not
  immediately show up on the Rust side.
- **Migration**: Each future Phase B/C sub-task that adds Rust evaluator
  capability MUST remove the matching `#[ignore]` AND add any missing
  fixtures (`_todo` rows above) BEFORE the feature is considered done.

## Out of scope

- Performance benchmarking (Phase B.4 — `sabflow-executor-rust-bench.md`).
- IPC contract between Rust executor and Node sidecar
  (`sabflow-executor-ipc.md`).
- Regex-literal / tagged-template / bitwise support — deferred to v2.1
  per the syntax ADR §4.

## References

- `docs/adr/sabflow-expression-syntax.md`
- `src/lib/sabflow/executor/expression/grammar.md`
- `src/lib/sabflow/executor/expression/__tests__/corpus.json`
- `rust/crates/sabflow-executor/expression/tests/parity.rs`
- `rust/crates/sabflow-executor/expression/tests/fixtures/`
