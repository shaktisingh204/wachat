//! YOURLS node.
//!
//! Self-hosted URL shortener — talks to the user's YOURLS install's
//! `yourls-api.php` endpoint. Authenticates by API signature
//! (`signature` field) or username/password supplied via the `yourlsApi`
//! credential (fields: `apiUrl`, `signature` and/or `username`+`password`).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct YourlsNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for YourlsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "yourls",
            "YOURLS",
            "Self-hosted URL shortener",
            NodeCategory::Marketing,
        )
        .icon("link")
        .color("#22C55E")
        .credentials(vec![CredentialBinding {
            name: "yourlsApi".into(),
            display_name: "YOURLS API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Shorten URL", "shorturl"),
                    opt("Expand URL", "expand"),
                    opt("URL Stats", "urlStats"),
                    opt("Database Stats", "dbStats"),
                ])
                .default(json!("shorturl"))
                .required(),
            NodeProperty::new("url", "Long URL", NodePropertyType::String)
                .placeholder("https://example.com/article/123")
                .show_when("operation", &["shorturl"])
                .required(),
            NodeProperty::new("keyword", "Custom Keyword", NodePropertyType::String)
                .placeholder("article-123")
                .show_when("operation", &["shorturl"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["shorturl"]),
            NodeProperty::new("shorturl", "Short URL or Keyword", NodePropertyType::String)
                .placeholder("https://sho.rt/abc or abc")
                .show_when("operation", &["expand", "urlStats"])
                .required(),
            NodeProperty::new("filter", "Stats Filter", NodePropertyType::Options)
                .options(vec![
                    opt("Top", "top"),
                    opt("Bottom", "bottom"),
                    opt("Rand", "rand"),
                    opt("Last", "last"),
                ])
                .default(json!("top"))
                .show_when("operation", &["dbStats"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["dbStats"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let api_url = cred
            .data
            .get("apiUrl")
            .ok_or_else(|| NodeError::MissingParameter("apiUrl".into()))?
            .trim()
            .trim_end_matches('/')
            .to_string();

        let operation = ctx.param_str(params, "operation")?;

        // Build the canonical YOURLS form body — JSON output, auth, then op
        // params. Auth supports either signature or username/password.
        let mut form: Vec<(String, String)> = vec![("format".into(), "json".into())];
        if let Some(sig) = cred.data.get("signature") {
            if !sig.trim().is_empty() {
                form.push(("signature".into(), sig.clone()));
            }
        }
        if let Some(user) = cred.data.get("username") {
            if !user.trim().is_empty() {
                form.push(("username".into(), user.clone()));
            }
        }
        if let Some(pass) = cred.data.get("password") {
            if !pass.trim().is_empty() {
                form.push(("password".into(), pass.clone()));
            }
        }
        form.push(("action".into(), operation.clone()));

        match operation.as_str() {
            "shorturl" => {
                let url = ctx.param_str(params, "url")?;
                form.push(("url".into(), url));
                if let Some(kw) = ctx.param_str_opt(params, "keyword") {
                    if !kw.trim().is_empty() {
                        form.push(("keyword".into(), kw));
                    }
                }
                if let Some(title) = ctx.param_str_opt(params, "title") {
                    if !title.trim().is_empty() {
                        form.push(("title".into(), title));
                    }
                }
            }
            "expand" | "urlStats" | "url-stats" => {
                let shorturl = ctx.param_str(params, "shorturl")?;
                form.push(("shorturl".into(), shorturl));
                // Map our camelCase op to YOURLS hyphenated alias when needed.
                if operation == "urlStats" {
                    rename_action(&mut form, "url-stats");
                }
            }
            "dbStats" | "db-stats" => {
                if operation == "dbStats" {
                    rename_action(&mut form, "db-stats");
                }
                if let Some(filter) = ctx.param_str_opt(params, "filter") {
                    form.push(("filter".into(), filter));
                }
                if let Some(limit) = ctx.param_f64(params, "limit") {
                    form.push(("limit".into(), (limit as i64).to_string()));
                }
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        }

        let res = ctx.http.post(&api_url).form(&form).send().await?;
        let status = res.status();
        let body: Value = res.json().await.unwrap_or(Value::Null);
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body.to_string(),
            });
        }
        // YOURLS sometimes returns an HTTP 200 with `status: fail` — surface
        // that as an UpstreamError so flows treat it like an error.
        if let Some(s) = body.get("status").and_then(|v| v.as_str()) {
            if s == "fail" {
                return Err(NodeError::UpstreamError {
                    status: body
                        .get("statusCode")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(400) as u16,
                    body: body.to_string(),
                });
            }
        }
        Ok(NodeOutput::single(vec![body]))
    }
}

/// Rewrite the `action` form entry to `new_action`. No-op if no such entry.
fn rename_action(form: &mut Vec<(String, String)>, new_action: &str) {
    for entry in form.iter_mut() {
        if entry.0 == "action" {
            entry.1 = new_action.to_string();
            return;
        }
    }
}
