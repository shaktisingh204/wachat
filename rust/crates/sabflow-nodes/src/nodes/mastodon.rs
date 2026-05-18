//! Mastodon node — fediverse microblogging.
//!
//! Posts statuses (toots) via the Mastodon REST API
//! (`POST /api/v1/statuses`). Auth uses a bearer OAuth2 access token.
//! The instance is supplied as part of the credential (`instanceUrl`) so
//! the same node works against any Mastodon instance.
//!
//! Quality bar: C.5 typed-stub-with-descriptor — `postStatus` and
//! `verifyCredentials` are wired.

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

pub struct MastodonNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MastodonNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mastodon",
            "Mastodon",
            "Post statuses to a Mastodon (fediverse) instance",
            NodeCategory::Communication,
        )
        .icon("at-sign")
        .color("#6364FF")
        .credentials(vec![CredentialBinding {
            name: "mastodonApi".into(),
            display_name: "Mastodon Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Status", "status"),
                    opt("Account", "account"),
                ])
                .default(json!("status"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Post", "post")])
                .default(json!("post"))
                .show_when("resource", &["status"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Verify Credentials", "verify")])
                .default(json!("verify"))
                .show_when("resource", &["account"])
                .required(),
            NodeProperty::new("status", "Status Text", NodePropertyType::String)
                .placeholder("Hello fediverse!")
                .description("Content of the status (max 500 chars on most instances)")
                .show_when("operation", &["post"])
                .required(),
            NodeProperty::new("visibility", "Visibility", NodePropertyType::Options)
                .options(vec![
                    opt("Public", "public"),
                    opt("Unlisted", "unlisted"),
                    opt("Followers Only", "private"),
                    opt("Direct", "direct"),
                ])
                .default(json!("public"))
                .show_when("operation", &["post"]),
            NodeProperty::new("spoilerText", "Content Warning", NodePropertyType::String)
                .description("Optional content warning shown above the status")
                .show_when("operation", &["post"]),
            NodeProperty::new("sensitive", "Sensitive Media", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["post"]),
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
        let token = cred
            .data
            .get("accessToken")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .to_string();
        let instance_url = cred
            .data
            .get("instanceUrl")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("instanceUrl".into()))?
            .trim_end_matches('/')
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "status".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "post".to_string());

        match (resource.as_str(), operation.as_str()) {
            ("status", "post") => {
                let status_text = ctx.param_str(params, "status")?;
                let visibility = ctx
                    .param_str_opt(params, "visibility")
                    .unwrap_or_else(|| "public".to_string());
                let sensitive = ctx.param_bool(params, "sensitive", false);
                let spoiler = ctx.param_str_opt(params, "spoilerText");

                let mut payload = Map::new();
                payload.insert("status".into(), json!(status_text));
                payload.insert("visibility".into(), json!(visibility));
                payload.insert("sensitive".into(), json!(sensitive));
                if let Some(s) = spoiler.filter(|s| !s.is_empty()) {
                    payload.insert("spoiler_text".into(), json!(s));
                }

                let url = format!("{instance_url}/api/v1/statuses");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .json(&Value::Object(payload))
                    .send()
                    .await?;
                finalize(res).await
            }
            ("account", "verify") => {
                let url = format!("{instance_url}/api/v1/accounts/verify_credentials");
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .header("Accept", "application/json")
                    .send()
                    .await?;
                finalize(res).await
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported mastodon {res} operation: {op}"),
            }),
        }
    }
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text_body = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text_body).unwrap_or(Value::String(text_body.clone()));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}
