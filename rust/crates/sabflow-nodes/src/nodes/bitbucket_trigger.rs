//! Bitbucket webhook trigger node — `n8n-nodes-base.bitbucketTrigger`.
//!
//! Bitbucket Cloud signs webhook deliveries with HMAC-SHA256 in the
//! `X-Hub-Signature` header (format: `sha256=<hex>`). When a secret is
//! configured on the hook, all requests carry that header. Bitbucket Server
//! (Data Center) uses `X-Hub-Signature` with `sha256=` likewise.
//!
//! Behaviour:
//!   1. Resolve secret from credential `bitbucketApi.webhookSecret` or the
//!      param `webhookSecret`.
//!   2. Verify HMAC-SHA256 against the re-serialized body.
//!   3. Filter on `X-Event-Key` — e.g. `repo:push`, `pullrequest:created`,
//!      `pullrequest:updated`, `issue:created`, etc.
//!   4. Emit `{ event, repo, ref, payload }`.

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct BitbucketTriggerNode;

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

fn body_bytes(td: &Value) -> Vec<u8> {
    let body = td.get("body").unwrap_or(&Value::Null);
    if let Some(raw) = body.get("raw").and_then(|v| v.as_str()) {
        return raw.as_bytes().to_vec();
    }
    match serde_json::to_vec(body) {
        Ok(b) => b,
        Err(_) => Vec::new(),
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
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

fn verify_signature(td: &Value, secret: &str) -> NodeResult<()> {
    let sig = header(td, "x-hub-signature")
        .ok_or_else(|| NodeError::AuthError("Missing X-Hub-Signature header".into()))?;
    let expected = sig.strip_prefix("sha256=").unwrap_or(sig);

    let body = body_bytes(td);
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).map_err(|e| {
        NodeError::InvalidParameter {
            name: "webhookSecret".into(),
            reason: format!("invalid HMAC key: {e}"),
        }
    })?;
    mac.update(&body);
    let computed = hex_encode(&mac.finalize().into_bytes());

    if ct_eq(computed.as_bytes(), expected.as_bytes()) {
        Ok(())
    } else {
        Err(NodeError::AuthError(
            "Bitbucket X-Hub-Signature mismatch".into(),
        ))
    }
}

#[async_trait]
impl Node for BitbucketTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bitbucketTrigger",
            "Bitbucket Trigger",
            "Run a flow on a Bitbucket webhook event",
            NodeCategory::Trigger,
        )
        .icon("git-branch")
        .color("#0052CC")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "bitbucketApi".into(),
            display_name: "Bitbucket Webhook".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("Bitbucket credential holding the `webhookSecret` field"),
            NodeProperty::new("webhookSecret", "Webhook Secret", NodePropertyType::String)
                .description(
                    "Falls back to this if no credential is bound. Leave empty to skip \
                     HMAC verification (NOT recommended).",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::MultiOptions)
                .description("Allow-list of Bitbucket event keys; empty = accept all")
                .options(vec![
                    opt("Repo: Push", "repo:push"),
                    opt("Repo: Fork", "repo:fork"),
                    opt("Repo: Updated", "repo:updated"),
                    opt("Repo: Commit Comment Created", "repo:commit_comment_created"),
                    opt("Repo: Commit Status Created", "repo:commit_status_created"),
                    opt("Repo: Commit Status Updated", "repo:commit_status_updated"),
                    opt("Pull Request: Created", "pullrequest:created"),
                    opt("Pull Request: Updated", "pullrequest:updated"),
                    opt("Pull Request: Approved", "pullrequest:approved"),
                    opt("Pull Request: Unapproved", "pullrequest:unapproved"),
                    opt("Pull Request: Fulfilled (Merged)", "pullrequest:fulfilled"),
                    opt("Pull Request: Rejected", "pullrequest:rejected"),
                    opt("Pull Request: Comment Created", "pullrequest:comment_created"),
                    opt("Pull Request: Comment Updated", "pullrequest:comment_updated"),
                    opt("Pull Request: Comment Deleted", "pullrequest:comment_deleted"),
                    opt("Issue: Created", "issue:created"),
                    opt("Issue: Updated", "issue:updated"),
                    opt("Issue: Comment Created", "issue:comment_created"),
                ])
                .default(json!([])),
            NodeProperty::new(
                "skipSignatureVerification",
                "Skip Signature Verification",
                NodePropertyType::Boolean,
            )
            .description("Disable HMAC verification entirely. Use only for local development.")
            .default(json!(false)),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let td = ctx.trigger_data.clone().ok_or_else(|| {
            NodeError::Other("bitbucketTrigger invoked without trigger_data".into())
        })?;

        // 1. Resolve secret.
        let skip = ctx.param_bool(params, "skipSignatureVerification", false);
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

        // 2. Verify signature.
        if !skip {
            if secret.is_empty() {
                return Err(NodeError::AuthError(
                    "bitbucketTrigger: webhookSecret is required (or set \
                     skipSignatureVerification)"
                        .into(),
                ));
            }
            verify_signature(&td, &secret)?;
        }

        // 3. Event filter.
        let event = header(&td, "x-event-key").unwrap_or("").to_string();
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
        // Bitbucket Cloud puts repo info under `repository.full_name`.
        let repo = body
            .get("repository")
            .and_then(|r| r.get("full_name"))
            .and_then(|v| v.as_str())
            .or_else(|| {
                body.get("repository")
                    .and_then(|r| r.get("name"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string())
            .unwrap_or_default();
        // For `repo:push`, the ref lives in the first change's `new.name`
        // (e.g. branch name) — `new.type` tells you `branch` vs `tag`.
        let r#ref = body
            .get("push")
            .and_then(|p| p.get("changes"))
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("new"))
            .and_then(|n| n.get("name"))
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
