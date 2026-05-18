//! GitLab webhook trigger node — `n8n-nodes-base.gitlabTrigger`.
//!
//! GitLab verifies webhooks differently from GitHub/Bitbucket: there is **no
//! HMAC signature**. Instead, GitLab sends the configured secret verbatim in
//! the `X-Gitlab-Token` header. We compare it constant-time-ish against the
//! credential / param secret.
//!
//! Behaviour:
//!   1. Read the configured secret (from credential `gitlabApi.webhookSecret`,
//!      falling back to the param `webhookSecret`).
//!   2. Compare `X-Gitlab-Token` against the secret.
//!   3. Filter on `X-Gitlab-Event` — e.g. `Push Hook`, `Merge Request Hook`,
//!      `Issue Hook`, `Tag Push Hook`, `Pipeline Hook`, `Release Hook`.
//!   4. Emit `{ event, repo, ref, payload }`.

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

pub struct GitlabTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

/// Lowercase-key header lookup against `trigger_data.headers`.
fn header<'a>(td: &'a Value, name: &str) -> Option<&'a str> {
    let headers = td.get("headers")?.as_object()?;
    let needle = name.to_ascii_lowercase();
    for (k, v) in headers.iter() {
        if k.to_ascii_lowercase() == needle {
            return v.as_str();
        }
    }
    None
}

/// Constant-time-ish equality on equal-length byte slices.
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[async_trait]
impl Node for GitlabTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gitlabTrigger",
            "GitLab Trigger",
            "Run a flow on a GitLab webhook event",
            NodeCategory::Trigger,
        )
        .icon("gitlab")
        .color("#FC6D26")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "gitlabApi".into(),
            display_name: "GitLab Webhook".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("GitLab credential holding the `webhookSecret` field"),
            NodeProperty::new("webhookSecret", "Webhook Secret", NodePropertyType::String)
                .description(
                    "Compared against the `X-Gitlab-Token` header. Falls back to the \
                     credential's `webhookSecret` when this is empty.",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::MultiOptions)
                .description("Allow-list of GitLab event names; empty = accept all")
                .options(vec![
                    opt("Push Hook", "Push Hook"),
                    opt("Tag Push Hook", "Tag Push Hook"),
                    opt("Issue Hook", "Issue Hook"),
                    opt("Confidential Issue Hook", "Confidential Issue Hook"),
                    opt("Note Hook", "Note Hook"),
                    opt("Confidential Note Hook", "Confidential Note Hook"),
                    opt("Merge Request Hook", "Merge Request Hook"),
                    opt("Wiki Page Hook", "Wiki Page Hook"),
                    opt("Pipeline Hook", "Pipeline Hook"),
                    opt("Job Hook", "Job Hook"),
                    opt("Deployment Hook", "Deployment Hook"),
                    opt("Feature Flag Hook", "Feature Flag Hook"),
                    opt("Release Hook", "Release Hook"),
                    opt("System Hook", "System Hook"),
                ])
                .default(json!([])),
            NodeProperty::new(
                "skipTokenVerification",
                "Skip Token Verification",
                NodePropertyType::Boolean,
            )
            .description("Disable token verification entirely. Use only for local development.")
            .default(json!(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let td = ctx
            .trigger_data
            .clone()
            .ok_or_else(|| NodeError::Other("gitlabTrigger invoked without trigger_data".into()))?;

        // 1. Resolve secret.
        let skip = ctx.param_bool(params, "skipTokenVerification", false);
        let secret_from_param = ctx.param_str_opt(params, "webhookSecret").unwrap_or_default();
        let secret_from_cred = ctx
            .param_str_opt(params, "credentialId")
            .and_then(|id| ctx.credentials.get(&id).cloned())
            .and_then(|c| c.data.get("webhookSecret").cloned())
            .unwrap_or_default();
        let secret = if !secret_from_cred.is_empty() {
            secret_from_cred
        } else {
            secret_from_param
        };

        // 2. Verify `X-Gitlab-Token`.
        if !skip {
            if secret.is_empty() {
                return Err(NodeError::AuthError(
                    "gitlabTrigger: webhookSecret is required (or set skipTokenVerification)"
                        .into(),
                ));
            }
            let sent = header(&td, "x-gitlab-token").unwrap_or("");
            if !ct_eq(sent.as_bytes(), secret.as_bytes()) {
                return Err(NodeError::AuthError(
                    "GitLab X-Gitlab-Token mismatch".into(),
                ));
            }
        }

        // 3. Event filter.
        let event = header(&td, "x-gitlab-event").unwrap_or("").to_string();
        let allow_list: Vec<String> = params
            .get("events")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        if !allow_list.is_empty() && !allow_list.iter().any(|e| e == &event) {
            return Ok(NodeOutput::single(vec![]));
        }

        // 4. Normalize envelope.
        let body = td.get("body").cloned().unwrap_or(Value::Null);
        // GitLab payloads put repo data under `project` (most events) or
        // `repository.name` for legacy hooks.
        let repo = body
            .get("project")
            .and_then(|p| p.get("path_with_namespace"))
            .and_then(|v| v.as_str())
            .or_else(|| {
                body.get("repository")
                    .and_then(|r| r.get("name"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string())
            .unwrap_or_default();
        let r#ref = body
            .get("ref")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        let envelope = json!({
            "event": event,
            "repo": repo,
            "ref": r#ref,
            "payload": body,
        });

        Ok(NodeOutput::single(vec![envelope]))
    }
}
