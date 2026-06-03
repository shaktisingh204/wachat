//! SabFlow Expression Engine — Rust ↔ TS Parity Suite
//! ---------------------------------------------------
//!
//! Phase C.2 sub-task #4 of `PLAN-sabflow-coverage.md`.
//!
//! This file is the **acceptance criteria** for the Rust expression
//! evaluator that will eventually replace the TypeScript implementation
//! under `src/lib/sabflow/executor/expression/`. The crate
//! `sabflow-executor-expression` is presently a scaffold (see
//! `src/lib.rs`); every test here is therefore marked `#[ignore]` with a
//! reason string so `cargo test` stays green and `cargo test --
//! --ignored` exposes the gap.
//!
//! ## What is being verified
//!
//! Each fixture under `tests/fixtures/<name>/` provides three files:
//!
//!   - `expression.txt`  — the literal n8n-style template the evaluator
//!                          must consume (may include `{{ … }}` braces or
//!                          plain text around them).
//!   - `context.json`    — the root scope, exactly as the host would
//!                          assemble it (`$json`, `$now`, `$execution`,
//!                          `$itemIndex`, `$node`, …). The test driver
//!                          deserialises this as `serde_json::Value` and
//!                          hands it to whatever Rust API the evaluator
//!                          exposes.
//!   - `expected.json`   — either `{ "kind": "value", "value": <any> }`
//!                          or `{ "kind": "error", "errorCode": "…",
//!                          "errorMessageSubstring": "…" }`. Optional
//!                          `notes` field documents the spec hook each
//!                          fixture exercises.
//!
//! ## Source-of-truth references
//!
//!   - `docs/adr/sabflow-expression-syntax.md` — the canonical spec.
//!   - `src/lib/sabflow/executor/expression/grammar.md` — formal EBNF.
//!   - `src/lib/sabflow/executor/expression/__tests__/corpus.json` —
//!     hand-curated 40-entry TS corpus mirroring this directory.
//!   - `docs/adr/sabflow-expression-parity.md` — feature coverage matrix
//!     and gap list this suite enforces.
//!
//! When the Rust evaluator lands, remove the `#[ignore]` attributes and
//! wire each test through the public API (likely
//! `sabflow_executor_expression::eval_template(src, &context)`).

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

/// Directory containing all parity fixtures, relative to the crate root.
fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

/// Strip exactly one terminal `\n` or `\r\n` from `s` if present.
/// Idempotent across multiple calls only if the source had a single
/// trailing newline; that is the documented fixture invariant.
fn strip_one_trailing_newline(s: &str) -> &str {
    if let Some(stripped) = s.strip_suffix("\r\n") {
        return stripped;
    }
    if let Some(stripped) = s.strip_suffix('\n') {
        return stripped;
    }
    s
}

/// Load one fixture's three files into memory. Returns `(expression,
/// context, expected)`. Panics with a clear message if any file is
/// missing or malformed — fixtures are author-owned, not test inputs, so
/// a parse failure is a contributor bug, not a runtime failure.
///
/// Convention: `expression.txt` always has a trailing newline (POSIX
/// text-file rule). The harness strips exactly one terminal `\n` (or
/// `\r\n`) before handing the source to the evaluator so a fixture like
/// `{{ $json.foo }}\n` evaluates to the bare value `$json.foo` rather
/// than `"<value>\n"`. Templates that explicitly want trailing raw text
/// MUST encode it inside the file *before* the final newline.
fn load_fixture(name: &str) -> (String, Value, Value) {
    let dir = fixtures_dir().join(name);
    let raw = fs::read_to_string(dir.join("expression.txt"))
        .unwrap_or_else(|e| panic!("fixture `{name}`: missing expression.txt — {e}"));
    let expression = strip_one_trailing_newline(&raw).to_owned();
    let context_raw = fs::read_to_string(dir.join("context.json"))
        .unwrap_or_else(|e| panic!("fixture `{name}`: missing context.json — {e}"));
    let expected_raw = fs::read_to_string(dir.join("expected.json"))
        .unwrap_or_else(|e| panic!("fixture `{name}`: missing expected.json — {e}"));
    let context: Value = serde_json::from_str(&context_raw)
        .unwrap_or_else(|e| panic!("fixture `{name}`: context.json is not valid JSON — {e}"));
    let expected: Value = serde_json::from_str(&expected_raw)
        .unwrap_or_else(|e| panic!("fixture `{name}`: expected.json is not valid JSON — {e}"));
    (expression, context, expected)
}

/// Hook into the (not-yet-implemented) Rust evaluator. Returns
/// `Ok(value)` on success or `Err(error_code)` on failure. When the
/// evaluator lands, replace the body with a real call.
#[allow(dead_code)]
fn evaluate(_src: &str, _ctx: &Value) -> Result<Value, String> {
    // Placeholder. The real call will resemble:
    //
    //   let scope = sabflow_executor_expression::Scope::from_json(_ctx)?;
    //   sabflow_executor_expression::eval_template(_src, &scope)
    //       .map_err(|e| e.code().to_string())
    //
    // Until then this returns an error so the smoke-asserts below would
    // fire if the `#[ignore]` were removed prematurely.
    Err("E_NOT_IMPLEMENTED".to_string())
}

/// Shared driver: load the fixture, run the evaluator, assert against
/// `expected.json`. Each `#[test]` below is a thin wrapper so the test
/// name shows up in `cargo test` output unambiguously.
#[allow(dead_code)]
fn run_fixture(name: &str) {
    let (expression, context, expected) = load_fixture(name);

    let kind = expected
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("fixture `{name}`: expected.json missing `kind` field"));

    match (kind, evaluate(&expression, &context)) {
        ("value", Ok(actual)) => {
            let want = expected
                .get("value")
                .unwrap_or_else(|| panic!("fixture `{name}`: kind=value but no `value` field"));
            assert_eq!(
                &actual, want,
                "fixture `{name}`: evaluator output mismatch.\n  expression: {expression}\n  got: {actual}\n  want: {want}",
            );
        }
        ("value", Err(code)) => {
            panic!("fixture `{name}`: expected success but evaluator returned error `{code}`")
        }
        ("error", Ok(actual)) => {
            panic!("fixture `{name}`: expected error but evaluator returned value `{actual}`")
        }
        ("error", Err(code)) => {
            let want_code = expected
                .get("errorCode")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture `{name}`: kind=error but no `errorCode`"));
            assert_eq!(
                code, want_code,
                "fixture `{name}`: error code mismatch.\n  expression: {expression}\n  got: {code}\n  want: {want_code}",
            );
        }
        (other, _) => panic!("fixture `{name}`: unknown kind `{other}` in expected.json"),
    }
}

// ---------------------------------------------------------------------
// Non-ignored: fixture integrity check. Always runs. Confirms every
// fixture has the three required files and that the JSON parses. This
// is the one test that fails loudly if a contributor breaks the corpus.
// ---------------------------------------------------------------------

#[test]
fn fixtures_corpus_is_well_formed() {
    let dir = fixtures_dir();
    let entries =
        fs::read_dir(&dir).unwrap_or_else(|e| panic!("missing fixtures dir {dir:?}: {e}"));

    let mut count = 0usize;
    for entry in entries {
        let entry = entry.expect("read_dir entry");
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .expect("fixture dir name")
            .to_owned();
        // load_fixture panics with a clear message on any malformed file.
        let (_expr, _ctx, expected) = load_fixture(&name);
        // Light schema check: every expected.json has a `kind` of "value" or "error".
        let kind = expected
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or_else(|| panic!("fixture `{name}`: expected.json missing `kind`"));
        assert!(
            kind == "value" || kind == "error",
            "fixture `{name}`: unknown kind `{kind}` (must be \"value\" or \"error\")",
        );
        count += 1;
    }
    // Sanity floor: keep the suite from silently emptying out.
    assert!(
        count >= 10,
        "fewer than 10 parity fixtures present ({count}); the suite has regressed",
    );
}

// ---------------------------------------------------------------------
// Parity tests — every one is `#[ignore]` until the Rust evaluator
// lands. The reason string explains WHY at `cargo test -- --ignored`.
// ---------------------------------------------------------------------

const REASON_SCAFFOLD: &str = "sabflow-executor-expression is a scaffold (lib.rs returns a stub string). \
     Tests light up once the evaluator implements `eval_template`. \
     See docs/adr/sabflow-expression-parity.md for the gap list.";

#[test]
#[ignore = "scaffold: see docs/adr/sabflow-expression-parity.md (REASON_SCAFFOLD)"]
fn parity_json_field_access() {
    let _ = REASON_SCAFFOLD;
    run_fixture("json_field_access");
}

#[test]
#[ignore = "scaffold: see docs/adr/sabflow-expression-parity.md (REASON_SCAFFOLD)"]
fn parity_array_indexing() {
    run_fixture("array_indexing");
}

#[test]
#[ignore = "scaffold: see docs/adr/sabflow-expression-parity.md (REASON_SCAFFOLD)"]
fn parity_arithmetic_add() {
    run_fixture("arithmetic_add");
}

#[test]
#[ignore = "scaffold: $now is a context function pinned at run start; not yet wired in Rust"]
fn parity_now_iso_string() {
    run_fixture("now_iso_string");
}

#[test]
#[ignore = "scaffold: $execution context not yet wired in Rust"]
fn parity_execution_id() {
    run_fixture("execution_id");
}

#[test]
#[ignore = "scaffold: spread + Math.max allow-list not yet implemented in Rust"]
fn parity_sandbox_math_max_spread_allowed() {
    run_fixture("math_max_spread");
}

#[test]
#[ignore = "scaffold: `new Date()` is the sole whitelisted constructor (ADR §4); needs parser support"]
fn parity_sandbox_new_date_allowed() {
    run_fixture("new_date_allowed");
}

#[test]
#[ignore = "scaffold: `Function` must be rejected at tokenize time (ADR §4)"]
fn parity_sandbox_new_function_rejected() {
    run_fixture("new_function_rejected");
}

#[test]
#[ignore = "scaffold: `globalThis` must not resolve as an identifier (ADR §2)"]
fn parity_sandbox_global_this_blocked() {
    run_fixture("global_this_blocked");
}

#[test]
#[ignore = "scaffold: optional chaining + nullish coalescing not yet implemented"]
fn parity_optional_chaining_nullish() {
    run_fixture("optional_chaining_nullish");
}

#[test]
#[ignore = "scaffold: expression-bodied arrows + .filter/.map/.reduce chain not yet implemented"]
fn parity_arrow_map_filter() {
    run_fixture("arrow_map_filter");
}

#[test]
#[ignore = "scaffold: mixed text + interpolation template concatenation not yet implemented"]
fn parity_template_string_concatenation() {
    run_fixture("template_string");
}

#[test]
#[ignore = "scaffold: $node['Name'] bracket lookup with spaced names not yet implemented"]
fn parity_node_bracket_lookup() {
    run_fixture("node_bracket_lookup");
}
