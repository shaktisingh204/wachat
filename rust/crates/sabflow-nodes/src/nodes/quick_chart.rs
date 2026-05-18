//! QuickChart node.
//!
//! Render Chart.js-style charts via the QuickChart REST API
//! (https://quickchart.io). The public service requires no auth for short
//! configs (encoded into the GET URL); for long configs the node posts to
//! `/chart/create` to obtain a stable short URL.
//!
//! Optionally accepts a `quickChartApi` credential (`apiKey` field) so paid
//! plans / self-hosted installs work the same way. The rendered chart is
//! always returned as a URL reference inside `mediaRef` — the node never
//! inlines image bytes.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct QuickChartNode;

const QUICKCHART_BASE: &str = "https://quickchart.io";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for QuickChartNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "quickChart",
            "QuickChart",
            "Render charts as image URLs using QuickChart",
            NodeCategory::Analytics,
        )
        .icon("bar-chart-3")
        .color("#6366F1")
        .credentials(vec![CredentialBinding {
            name: "quickChartApi".into(),
            display_name: "QuickChart API Key (optional)".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential (optional)", NodePropertyType::Credential),
            NodeProperty::new("mode", "Mode", NodePropertyType::Options)
                .options(vec![
                    opt("Inline URL", "url"),
                    opt("Short URL", "short"),
                ])
                .default(json!("url"))
                .required()
                .description("`Inline URL` encodes the config in the link; `Short URL` POSTs to /chart/create"),
            NodeProperty::new("chart", "Chart Config", NodePropertyType::Json)
                .required()
                .description("Chart.js configuration object — { type, data, options }"),
            NodeProperty::new("width", "Width", NodePropertyType::Number).default(json!(500)),
            NodeProperty::new("height", "Height", NodePropertyType::Number).default(json!(300)),
            NodeProperty::new("backgroundColor", "Background Color", NodePropertyType::String)
                .placeholder("transparent"),
            NodeProperty::new("format", "Format", NodePropertyType::Options)
                .options(vec![
                    opt("PNG", "png"),
                    opt("SVG", "svg"),
                    opt("PDF", "pdf"),
                    opt("WebP", "webp"),
                ])
                .default(json!("png")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Credential is optional — pick up `apiKey` if a credential id was supplied.
        let api_key = match ctx.param_str_opt(params, "credentialId") {
            Some(id) if !id.is_empty() => ctx
                .credential(&id)
                .ok()
                .and_then(|c| c.data.get("apiKey").cloned()),
            _ => None,
        };

        let mode = ctx
            .param_str_opt(params, "mode")
            .unwrap_or_else(|| "url".to_string());
        let chart = parse_json_param(ctx, params, "chart")
            .ok_or_else(|| NodeError::MissingParameter("chart".into()))?;
        let width = ctx.param_f64(params, "width").unwrap_or(500.0) as i64;
        let height = ctx.param_f64(params, "height").unwrap_or(300.0) as i64;
        let format = ctx
            .param_str_opt(params, "format")
            .unwrap_or_else(|| "png".to_string());
        let bg = ctx.param_str_opt(params, "backgroundColor");

        let mime = match format.as_str() {
            "svg" => "image/svg+xml",
            "pdf" => "application/pdf",
            "webp" => "image/webp",
            _ => "image/png",
        };

        let result = match mode.as_str() {
            "url" => {
                // Encode chart config into the GET URL — fast path, no API call.
                let chart_str = serde_json::to_string(&chart)?;
                let mut url = format!(
                    "{QUICKCHART_BASE}/chart?w={width}&h={height}&f={format}&c={}",
                    urlencoding::encode(&chart_str)
                );
                if let Some(b) = bg.as_ref() {
                    if !b.trim().is_empty() {
                        url.push_str(&format!("&bkg={}", urlencoding::encode(b)));
                    }
                }
                if let Some(k) = api_key.as_ref() {
                    if !k.trim().is_empty() {
                        url.push_str(&format!("&key={}", urlencoding::encode(k)));
                    }
                }
                json!({
                    "mode": "url",
                    "mediaRef": { "kind": "url", "mimeType": mime, "url": url },
                })
            }
            "short" => {
                // POST the chart config; receive a stable shortUrl back.
                let mut payload = Map::new();
                payload.insert("chart".into(), chart);
                payload.insert("width".into(), json!(width));
                payload.insert("height".into(), json!(height));
                payload.insert("format".into(), json!(format));
                if let Some(b) = bg.as_ref() {
                    if !b.trim().is_empty() {
                        payload.insert("backgroundColor".into(), json!(b));
                    }
                }
                if let Some(k) = api_key.as_ref() {
                    if !k.trim().is_empty() {
                        payload.insert("key".into(), json!(k));
                    }
                }
                let url = format!("{QUICKCHART_BASE}/chart/create");
                let res = ctx.http.post(&url).json(&payload).send().await?;
                let status = res.status();
                let body: Value = res.json().await.unwrap_or(Value::Null);
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: body.to_string(),
                    });
                }
                let short_url = body.get("url").cloned().unwrap_or(Value::Null);
                json!({
                    "mode": "short",
                    "mediaRef": { "kind": "url", "mimeType": mime, "url": short_url },
                    "raw": body,
                })
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "mode".into(),
                    reason: format!("unknown mode: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![result]))
    }
}

fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}
