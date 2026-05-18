//! Hunter node.
//!
//! Implements email-finder operations against the Hunter v2 API
//! (`https://api.hunter.io/v2`). Authenticates with the `api_key` query
//! parameter.

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

pub struct HunterNode;

const HUNTER_BASE: &str = "https://api.hunter.io/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for HunterNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "hunter",
            "Hunter",
            "Find, verify, and enrich email addresses via Hunter.io",
            NodeCategory::Marketing,
        )
        .icon("search")
        .color("#FF6F61")
        .credentials(vec![CredentialBinding {
            name: "hunterApi".into(),
            display_name: "Hunter API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Domain Search", "domainSearch"),
                    opt("Email Finder", "emailFinder"),
                    opt("Email Verifier", "emailVerifier"),
                    opt("Email Count", "emailCount"),
                    opt("Account Info", "account"),
                ])
                .default(json!("domainSearch"))
                .required(),
            // domainSearch + emailFinder + emailCount share domain
            NodeProperty::new("domain", "Domain", NodePropertyType::String)
                .placeholder("example.com")
                .show_when("operation", &["domainSearch", "emailFinder", "emailCount"])
                .required(),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["domainSearch"])
                .description("Maximum number of email addresses to return (1-100)"),
            // emailFinder
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("operation", &["emailFinder"])
                .required(),
            NodeProperty::new("lastName", "Last Name", NodePropertyType::String)
                .show_when("operation", &["emailFinder"])
                .required(),
            // emailVerifier
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["emailVerifier"])
                .required(),
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "domainSearch" => {
                let domain = ctx.param_str(params, "domain")?;
                let limit = ctx.param_f64(params, "limit").map(|n| n as i64).unwrap_or(10);
                let url = format!(
                    "{HUNTER_BASE}/domain-search?domain={domain}&limit={limit}&api_key={api_key}"
                );
                send_get(ctx, &url).await?
            }
            "emailFinder" => {
                let domain = ctx.param_str(params, "domain")?;
                let first = ctx.param_str(params, "firstName")?;
                let last = ctx.param_str(params, "lastName")?;
                let url = format!(
                    "{HUNTER_BASE}/email-finder?domain={domain}&first_name={first}&last_name={last}&api_key={api_key}"
                );
                send_get(ctx, &url).await?
            }
            "emailVerifier" => {
                let email = ctx.param_str(params, "email")?;
                let url = format!("{HUNTER_BASE}/email-verifier?email={email}&api_key={api_key}");
                send_get(ctx, &url).await?
            }
            "emailCount" => {
                let domain = ctx.param_str(params, "domain")?;
                // email-count is unauthenticated, but Hunter still accepts the key.
                let url = format!("{HUNTER_BASE}/email-count?domain={domain}");
                send_get(ctx, &url).await?
            }
            "account" => {
                let url = format!("{HUNTER_BASE}/account?api_key={api_key}");
                send_get(ctx, &url).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn send_get(ctx: &ExecutionContext, url: &str) -> NodeResult<Value> {
    let req = ctx.http.get(url).header("Accept", "application/json");
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
}

