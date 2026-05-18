//! Function (legacy) node.
//!
//! n8n's old `Function` node ran a JavaScript snippet against the entire
//! input batch — `items` was bound to the input array and the snippet
//! returned a new array. We don't ship a JS sandbox today (see
//! `code_node.rs` for the rationale), so this node downgrades transparently
//! to the same safe expression DSL:
//!
//!   - The full source is treated as a template.
//!   - `{{ $json }}`, `{{ $json.path }}`, `{{ $node.<name>[.path] }}`, and
//!     plain `{{ varName }}` tokens are substituted.
//!   - For `Function (legacy)`, `$json` binds to the **first input item** —
//!     run-once-for-all-items semantics, matching the historic behaviour
//!     where the snippet ran once with the whole `items` array in scope.
//!
//! The rendered string is parsed as JSON when possible. If the result is a
//! JSON array, every element becomes an output item. Otherwise the rendered
//! value is wrapped as a single item (`{ "value": ... }` when non-object).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput, value_at_path, value_to_string},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct FunctionNode;

#[async_trait]
impl Node for FunctionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "function",
            "Function (legacy)",
            "Legacy code node — downgrades to the safe expression DSL",
            NodeCategory::Logic,
        )
        .icon("braces")
        .color("#f97316")
        .properties(vec![
            NodeProperty::new("functionCode", "Function Code", NodePropertyType::Code)
                .default(json!("{{ $json }}"))
                .description(
                    "Legacy JS source. Today this is evaluated as the safe expression DSL: \
                     {{ $json[.path] }}, {{ $node.<name>[.path] }}, and {{ varName }}. \
                     If the rendered result is a JSON array, each element becomes an output item.",
                )
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let raw_code = params
            .get("functionCode")
            .or_else(|| params.get("code"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Bind $json to the first input item to mirror legacy `items[0]` access.
        // The snippet has no way to enumerate the full input array under the DSL —
        // users wanting per-item behaviour should switch to `functionItem`.
        let first = input.items.first().cloned().unwrap_or(Value::Null);

        let rendered = render(ctx, &raw_code, &first);
        let trimmed = rendered.trim();

        if trimmed.is_empty() {
            return Ok(NodeOutput::single(vec![json!({ "value": "" })]));
        }

        match serde_json::from_str::<Value>(trimmed) {
            Ok(Value::Array(arr)) => Ok(NodeOutput::single(arr)),
            Ok(v) => Ok(NodeOutput::single(vec![v])),
            Err(_) => Ok(NodeOutput::single(vec![json!({ "value": rendered })])),
        }
    }
}

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

fn resolve_token(ctx: &ExecutionContext, tok: &str, item: &Value) -> String {
    if tok == "$json" {
        return value_to_string(item);
    }
    if let Some(rest) = tok.strip_prefix("$json.") {
        return value_at_path(item, rest)
            .map(value_to_string)
            .unwrap_or_default();
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
    if let Some(v) = ctx.variables.get(tok) {
        return value_to_string(v);
    }
    String::new()
}
