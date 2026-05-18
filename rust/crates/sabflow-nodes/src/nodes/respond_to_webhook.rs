//! Respond to Webhook node — `n8n-nodes-base.respondToWebhook` parity.
//!
//! Terminal node. Builds a synthetic webhook-response object and stashes it
//! in `ctx.variables["$webhookResponse"]`. The engine runtime is responsible
//! for reading that variable after execution and publishing it on the Redis
//! pub/sub channel `sabflow:webhook-response:{execution_id}` so the public
//! webhook receiver can reply to the original caller.
//!
//! Body modes (mirrors the n8n V1 dropdown):
//!
//! - `json`              → arbitrary JSON body, with `{{var}}` substitution
//!                          on string leaves
//! - `firstIncomingItem` → use the first item flowing into this node as the
//!                          response body (the most common pattern for
//!                          "echo what the flow produced")
//! - `text`              → plain text body (substituted)
//! - `noData`            → empty body, only status + headers
//!
//! Headers are an optional object of `name → value` pairs. Status defaults
//! to `200`.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct RespondToWebhookNode;

fn opt_desc(name: &str, value: &str, desc: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: Some(desc.to_string()),
    }
}

#[async_trait]
impl Node for RespondToWebhookNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "respondToWebhook",
            "Respond to Webhook",
            "Reply to the inbound webhook caller",
            NodeCategory::Action,
        )
        .icon("reply")
        .color("#fde68a")
        .properties(vec![
            NodeProperty::new("respondWith", "Respond With", NodePropertyType::Options)
                .options(vec![
                    opt_desc("JSON", "json", "Reply with a JSON body"),
                    opt_desc(
                        "First Incoming Item",
                        "firstIncomingItem",
                        "Echo the first item that flowed into this node",
                    ),
                    opt_desc("Text", "text", "Reply with a plain text body"),
                    opt_desc("No Data", "noData", "Reply with only status and headers"),
                ])
                .default(json!("json"))
                .required(),
            NodeProperty::new("responseCode", "Response Code", NodePropertyType::Number)
                .description("HTTP status code to return")
                .default(json!(200)),
            NodeProperty::new("responseBody", "Response Body", NodePropertyType::Json)
                .description("JSON to return to the caller")
                .show_when("respondWith", &["json"]),
            NodeProperty::new("responseText", "Response Text", NodePropertyType::String)
                .description("Plain text body to return")
                .show_when("respondWith", &["text"]),
            NodeProperty::new("responseHeaders", "Response Headers", NodePropertyType::Json)
                .description("Object of name → value HTTP header pairs"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let respond_with = ctx
            .param_str_opt(params, "respondWith")
            .unwrap_or_else(|| "json".to_string());

        let response_code = ctx
            .param_f64(params, "responseCode")
            .map(|n| n as i64)
            .unwrap_or(200);

        // Headers: an optional JSON object. String values get substitution.
        let response_headers = build_headers(ctx, params.get("responseHeaders"));

        // Body, dispatched on respondWith.
        let body_value = match respond_with.as_str() {
            "text" => {
                let text = ctx
                    .param_str_opt(params, "responseText")
                    .unwrap_or_default();
                Value::String(text)
            }
            "noData" => Value::Null,
            "firstIncomingItem" => input
                .items
                .first()
                .cloned()
                .unwrap_or(Value::Object(Map::new())),
            // default to JSON for "json" and any unknown value
            _ => {
                let raw = params.get("responseBody").cloned().unwrap_or(Value::Null);
                substitute_value(ctx, raw)
            }
        };

        let response = json!({
            "statusCode": response_code,
            "headers": response_headers,
            "body": body_value,
        });

        ctx.variables
            .insert("$webhookResponse".to_string(), response.clone());

        Ok(NodeOutput::single(vec![response]))
    }
}

/// Normalise the `responseHeaders` param into a JSON object, applying
/// `ctx.substitute` to any string values.  Accepts:
///   - a JSON object → used directly (with substitution on string values)
///   - a JSON string → parsed as JSON if possible, else treated as empty
///   - anything else → empty object
fn build_headers(ctx: &ExecutionContext, raw: Option<&Value>) -> Value {
    let Some(raw) = raw else {
        return Value::Object(Map::new());
    };

    let obj = match raw {
        Value::Object(map) => map.clone(),
        Value::String(s) => {
            let substituted = ctx.substitute(s);
            match serde_json::from_str::<Value>(&substituted) {
                Ok(Value::Object(map)) => map,
                _ => return Value::Object(Map::new()),
            }
        }
        _ => return Value::Object(Map::new()),
    };

    let mut out = Map::with_capacity(obj.len());
    for (k, v) in obj.into_iter() {
        let v = match v {
            Value::String(s) => Value::String(ctx.substitute(&s)),
            other => other,
        };
        out.insert(k, v);
    }
    Value::Object(out)
}

/// Recursively walk a JSON value, running `ctx.substitute` on every string
/// leaf so `{{var}}` and `{{$json.field}}` tokens in the response body get
/// expanded.  Object keys are left alone.
fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(
            arr.into_iter()
                .map(|item| substitute_value(ctx, item))
                .collect(),
        ),
        Value::Object(map) => {
            let mut out = Map::with_capacity(map.len());
            for (k, child) in map.into_iter() {
                out.insert(k, substitute_value(ctx, child));
            }
            Value::Object(out)
        }
        other => other,
    }
}
