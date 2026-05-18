//! Bluesky node — AT Protocol microblogging.
//!
//! Creates posts on Bluesky via the AT Protocol XRPC endpoints:
//!   1. `com.atproto.server.createSession` to exchange an app password
//!      for a JWT access token.
//!   2. `com.atproto.repo.createRecord` to publish an `app.bsky.feed.post`
//!      record in the user's repository.
//!
//! Credential schema: `identifier` (handle or email) + `appPassword`.
//! Optionally `service` overrides the PDS base URL (defaults to
//! `https://bsky.social`).
//!
//! Quality bar: C.5 typed-stub-with-descriptor — `createPost` is wired.

use async_trait::async_trait;
use chrono::SecondsFormat;
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

pub struct BlueskyNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for BlueskyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bluesky",
            "Bluesky",
            "Publish posts to Bluesky via the AT Protocol",
            NodeCategory::Communication,
        )
        .icon("cloud")
        .color("#0085FF")
        .credentials(vec![CredentialBinding {
            name: "blueskyApi".into(),
            display_name: "Bluesky Identifier + App Password".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Post", "post")])
                .default(json!("post"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create")])
                .default(json!("create"))
                .show_when("resource", &["post"])
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello Bluesky!")
                .description("Post text (max 300 characters)")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("langs", "Languages", NodePropertyType::String)
                .placeholder("en")
                .description("Comma-separated BCP-47 language tags, e.g. en,fr")
                .show_when("operation", &["create"]),
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
        let identifier = cred
            .data
            .get("identifier")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("identifier".into()))?
            .to_string();
        let app_password = cred
            .data
            .get("appPassword")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("appPassword".into()))?
            .to_string();
        let service = cred
            .data
            .get("service")
            .and_then(|v| v.as_str())
            .unwrap_or("https://bsky.social")
            .trim_end_matches('/')
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "post".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "create".to_string());

        match (resource.as_str(), operation.as_str()) {
            ("post", "create") => {
                let text = ctx.param_str(params, "text")?;
                let langs_raw = ctx.param_str_opt(params, "langs");

                // 1. createSession
                let session_url =
                    format!("{service}/xrpc/com.atproto.server.createSession");
                let session_res = ctx
                    .http
                    .post(&session_url)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .json(&json!({
                        "identifier": identifier,
                        "password": app_password,
                    }))
                    .send()
                    .await?;
                let session_status = session_res.status();
                let session_text = session_res.text().await.unwrap_or_default();
                let session_json: Value = serde_json::from_str(&session_text)
                    .unwrap_or(Value::String(session_text.clone()));
                if !session_status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: session_status.as_u16(),
                        body: session_json.to_string(),
                    });
                }
                let access_jwt = session_json
                    .get("accessJwt")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| NodeError::UpstreamError {
                        status: 0,
                        body: "createSession response missing accessJwt".into(),
                    })?
                    .to_string();
                let did = session_json
                    .get("did")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| NodeError::UpstreamError {
                        status: 0,
                        body: "createSession response missing did".into(),
                    })?
                    .to_string();

                // 2. createRecord
                let now =
                    chrono::Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);

                let mut record = serde_json::Map::new();
                record.insert("$type".into(), json!("app.bsky.feed.post"));
                record.insert("text".into(), json!(text));
                record.insert("createdAt".into(), json!(now));
                if let Some(langs) = langs_raw.filter(|s| !s.trim().is_empty()) {
                    let arr: Vec<String> = langs
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    record.insert("langs".into(), json!(arr));
                }

                let create_url =
                    format!("{service}/xrpc/com.atproto.repo.createRecord");
                let create_res = ctx
                    .http
                    .post(&create_url)
                    .bearer_auth(&access_jwt)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .json(&json!({
                        "repo": did,
                        "collection": "app.bsky.feed.post",
                        "record": Value::Object(record),
                    }))
                    .send()
                    .await?;
                let create_status = create_res.status();
                let create_text = create_res.text().await.unwrap_or_default();
                let create_json: Value = serde_json::from_str(&create_text)
                    .unwrap_or(Value::String(create_text.clone()));
                if !create_status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: create_status.as_u16(),
                        body: create_json.to_string(),
                    });
                }
                Ok(NodeOutput::single(vec![create_json]))
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported bluesky {res} operation: {op}"),
            }),
        }
    }
}
