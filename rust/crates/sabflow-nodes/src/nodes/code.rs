//! Code node — `n8n-nodes-base.code`.
//!
//! Phase C.3.4 canonical Code-node implementation.
//!
//! n8n's `Code` node runs arbitrary user-supplied JavaScript (or Python via
//! Pyodide) against the incoming items. Embedding a JS/Python runtime inside
//! the sabflow worker is **out of scope** for this phase — we keep the binary
//! small, the surface safe, and the execution model deterministic.
//!
//! Behaviour:
//!   - `language = "javascript"` → typed error
//!     [`NodeError::ExpressionError`] with body `function.js_not_yet_supported`,
//!     so the engine surfaces a structured, recognisable failure mode rather
//!     than silently downgrading.
//!   - `language = "python"` → same typed error
//!     (`function.python_not_yet_supported`).
//!   - `language = "expression"` (default) → the tiny in-house template DSL
//!     described below. This is the only mode that succeeds today.
//!
//! Expression DSL:
//!   - The source is treated as a template that may contain `{{ ... }}`
//!     substitution tokens.
//!   - Inside a token you can reference:
//!       * `$json`               — the current item (object)
//!       * `$json.path.to.field` — deep field on the current item
//!       * `$node.<name>`        — first item of another node's first branch
//!       * `$node.<name>.field`  — deep field within that item
//!       * `varName`             — flow variable
//!   - After substitution we attempt `serde_json::from_str` on the result.
//!     If it parses, that's the emitted value. Otherwise we wrap the raw
//!     string as `{ "value": "<rendered>" }`.
//!
//! Failure handling honours `continueOnFail` (n8n parity): when set, per-item
//! evaluation failures emit `{ error: "..." }` items rather than aborting.
//!
//! TODO(sabflow-sandbox): integrate `boa_engine` or a QuickJS binding behind
//!   a feature flag so `language = "javascript"` can actually execute JS in a
//!   sandbox. Same story for Pyodide / RustPython once that lands. Until then
//!   the typed `function.js_not_yet_supported` error is the contract callers
//!   should branch on.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{value_at_path, value_to_string, ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct CodeNode;

/// Typed error body for JS code that the worker cannot execute yet.
pub const JS_NOT_YET_SUPPORTED: &str = "function.js_not_yet_supported";
/// Typed error body for Python code that the worker cannot execute yet.
pub const PYTHON_NOT_YET_SUPPORTED: &str = "function.python_not_yet_supported";

#[async_trait]
impl Node for CodeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "code",
            "Code",
            "Run JavaScript, Python, or an expression DSL against incoming items",
            NodeCategory::Developer,
        )
        .icon("code")
        .color("#f97316")
        .properties(vec![
            NodeProperty::new("language", "Language", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Expression".into(),
                        value: json!("expression"),
                        description: Some(
                            "Safe expression DSL with {{ $json.field }} substitution".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "JavaScript".into(),
                        value: json!("javascript"),
                        description: Some(
                            "Run arbitrary JavaScript (not yet supported — returns a typed \
                             function.js_not_yet_supported error)."
                                .into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Python".into(),
                        value: json!("python"),
                        description: Some(
                            "Run arbitrary Python (not yet supported — returns a typed \
                             function.python_not_yet_supported error)."
                                .into(),
                        ),
                    },
                ])
                .default(json!("expression"))
                .description(
                    "Choose the source language. JavaScript and Python are reserved for \
                     a future sandbox release and currently return a typed error.",
                ),
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Run Once for All Items".into(),
                        value: json!("runOnceForAllItems"),
                        description: Some(
                            "Evaluate a single time using the first input item as $json. \
                             Emits one output item."
                                .into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Run Once for Each Item".into(),
                        value: json!("runOnceForEachItem"),
                        description: Some(
                            "Evaluate once per input item. Emits one output item per input."
                                .into(),
                        ),
                    },
                ])
                .default(json!("runOnceForAllItems")),
            NodeProperty::new("jsCode", "JavaScript Code", NodePropertyType::Code)
                .default(json!("// return items.map(i => i.json);"))
                .show_when("language", &["javascript"])
                .description(
                    "JavaScript source. Not yet executable — selecting JavaScript will \
                     return a typed function.js_not_yet_supported error.",
                ),
            NodeProperty::new("pythonCode", "Python Code", NodePropertyType::Code)
                .default(json!("# return [i['json'] for i in items]"))
                .show_when("language", &["python"])
                .description(
                    "Python source. Not yet executable — selecting Python will return a \
                     typed function.python_not_yet_supported error.",
                ),
            NodeProperty::new("code", "Expression", NodePropertyType::Code)
                .default(json!("{{ $json }}"))
                .show_when("language", &["expression"])
                .description(
                    "Expression source. Use {{ $json.field }} for the current item, \
                     {{ $node.<name>.field }} for outputs from other nodes, and \
                     {{ varName }} for flow variables. The rendered result is parsed \
                     as JSON when possible, otherwise wrapped as { \"value\": \"...\" }.",
                ),
            NodeProperty::new("continueOnFail", "Continue on Fail", NodePropertyType::Boolean)
                .default(json!(false))
                .description(
                    "When enabled, per-item evaluation failures emit { error: \"...\" } \
                     items rather than aborting the workflow.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let language = ctx
            .param_str_opt(params, "language")
            .unwrap_or_else(|| "expression".to_string());

        // JS/Python paths: typed not-yet-supported error. This is the contract
        // the engine + UI branch on — DO NOT silently downgrade to expression.
        match language.as_str() {
            "javascript" => {
                return Err(NodeError::ExpressionError(JS_NOT_YET_SUPPORTED.to_string()));
            }
            "python" => {
                return Err(NodeError::ExpressionError(
                    PYTHON_NOT_YET_SUPPORTED.to_string(),
                ));
            }
            _ => {}
        }

        let mode = ctx
            .param_str_opt(params, "mode")
            .unwrap_or_else(|| "runOnceForAllItems".to_string());
        let continue_on_fail = ctx.param_bool(params, "continueOnFail", false);

        // Pull the raw code source. We DO NOT use ctx.param_str here because
        // that would substitute against `trigger_data` rather than the current
        // input item — we want to substitute ourselves with the per-item view.
        let raw_code = params
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let items_in = input.items;

        match mode.as_str() {
            "runOnceForEachItem" => {
                let mut out = Vec::with_capacity(items_in.len());
                for item in &items_in {
                    out.push(try_with_continue_on_fail(continue_on_fail, || {
                        Ok(evaluate(ctx, &raw_code, item))
                    })?);
                }
                Ok(NodeOutput::single(out))
            }
            // "runOnceForAllItems" and any unknown value fall through to a
            // single evaluation using the first item as $json.
            _ => {
                let first = items_in.first().cloned().unwrap_or(Value::Null);
                let value = try_with_continue_on_fail(continue_on_fail, || {
                    Ok(evaluate(ctx, &raw_code, &first))
                })?;
                Ok(NodeOutput::single(vec![value]))
            }
        }
    }
}

/// Tiny inline `try_with_continue_on_fail` shim — when `continue_on_fail` is
/// set, a failure from `f` becomes an `{ error }` item instead of bubbling up.
/// Stand-in for the `item_helpers::try_with_continue_on_fail` helper called
/// out in the C.3.4 spec until that module lands.
fn try_with_continue_on_fail<F>(continue_on_fail: bool, f: F) -> NodeResult<Value>
where
    F: FnOnce() -> NodeResult<Value>,
{
    match f() {
        Ok(v) => Ok(v),
        Err(e) if continue_on_fail => Ok(json!({ "error": e.to_string() })),
        Err(e) => Err(e),
    }
}

/// Substitute `{{ ... }}` tokens in `code` using `item` as `$json`, then try
/// to parse the rendered string as JSON. On parse failure, wrap as
/// `{ "value": "<rendered>" }`.
fn evaluate(ctx: &ExecutionContext, code: &str, item: &Value) -> Value {
    let rendered = render(ctx, code, item);
    let trimmed = rendered.trim();
    if trimmed.is_empty() {
        return json!({ "value": "" });
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(v) => v,
        Err(_) => json!({ "value": rendered }),
    }
}

/// Walk `raw` and replace `{{ token }}` spans with resolved values. Uses
/// `item` as the binding for `$json`. Falls back to flow variables and node
/// outputs for everything else.
fn render(ctx: &ExecutionContext, raw: &str, item: &Value) -> String {
    let mut out = String::with_capacity(raw.len());
    let bytes = raw.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
            if let Some(end) = raw[i + 2..].find("}}") {
                let tok = raw[i + 2..i + 2 + end].trim();
                out.push_str(&resolve_token(ctx, tok, item));
                i = i + 2 + end + 2;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

/// Resolve a single token. Supported forms:
///   - `$json`               → current item, serialised as JSON
///   - `$json.a.b.c`         → deep field on current item
///   - `$trigger[.path]`     → execution trigger payload (legacy alias)
///   - `$node.<name>[.path]` → first item of another node's first branch
///   - `<varName>`           → flow variable
fn resolve_token(ctx: &ExecutionContext, tok: &str, item: &Value) -> String {
    if tok == "$json" {
        return value_to_string(item);
    }
    if let Some(rest) = tok.strip_prefix("$json.") {
        return value_at_path(item, rest)
            .map(value_to_string)
            .unwrap_or_default();
    }
    if tok == "$trigger" {
        if let Some(td) = &ctx.trigger_data {
            return value_to_string(td);
        }
        return String::new();
    }
    if let Some(rest) = tok.strip_prefix("$trigger.") {
        if let Some(td) = &ctx.trigger_data {
            return value_at_path(td, rest)
                .map(value_to_string)
                .unwrap_or_default();
        }
        return String::new();
    }
    if let Some(rest) = tok.strip_prefix("$node.") {
        let (name, path) = match rest.split_once('.') {
            Some((n, p)) => (n, p),
            None => (rest, ""),
        };
        if let Some(node_out) = ctx.node_outputs.get(name) {
            let first_item = node_out
                .branches
                .first()
                .and_then(|b| b.items.first())
                .cloned()
                .unwrap_or(Value::Null);
            if path.is_empty() {
                return value_to_string(&first_item);
            }
            return value_at_path(&first_item, path)
                .map(value_to_string)
                .unwrap_or_default();
        }
        return String::new();
    }
    // Plain variable name.
    if let Some(v) = ctx.variables.get(tok) {
        return value_to_string(v);
    }
    String::new()
}
