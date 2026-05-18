//! GitHub webhook trigger node — `n8n-nodes-base.githubTrigger`.
//!
//! The HTTP receiver (Next.js route) hands the request through to the engine
//! as `ExecutionContext::trigger_data` in the canonical webhook shape:
//!
//! ```jsonc
//! {
//!   "body":    <parsed JSON or { "raw": "<text>" }>,
//!   "headers": { "x-github-event": "push", "x-hub-signature-256": "sha256=…", … },
//!   "query":   { … },
//!   "method":  "POST"
//! }
//! ```
//!
//! Behaviour:
//!   1. Look up the configured webhook secret (from credential `githubApi`
//!      under `webhookSecret`, falling back to the optional `webhookSecret`
//!      param so flows without a credential can still validate).
//!   2. Verify `X-Hub-Signature-256` (HMAC-SHA256, hex) against the raw body.
//!      Falls back to `X-Hub-Signature` (HMAC-SHA1) for legacy hooks.
//!   3. Filter on `X-GitHub-Event` — only emit when the incoming event matches
//!      one of the user's configured event names (`events` multi-options).
//!   4. Emit a single normalized envelope `{ event, repo, ref, payload }`.

use async_trait::async_trait;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha1::Sha1;
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

pub struct GithubTriggerNode;

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

/// Re-serialize the body to bytes for HMAC verification.
///
/// The HTTP receiver parses JSON before handing it to the engine, so we lose
/// the original raw text. We re-serialize the parsed JSON deterministically —
/// for GitHub this matches the canonical body in the overwhelming majority of
/// cases. If `body.raw` is present (the non-JSON fallback path), we use it
/// verbatim.
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

/// Verify `X-Hub-Signature-256` / `X-Hub-Signature` against the body.
/// Returns `Ok(())` on success, `Err` with a structured reason otherwise.
fn verify_signature(td: &Value, secret: &str) -> NodeResult<()> {
    let body = body_bytes(td);

    if let Some(sig) = header(td, "x-hub-signature-256") {
        let expected = sig.strip_prefix("sha256=").unwrap_or(sig);
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
            .map_err(|e| NodeError::InvalidParameter {
                name: "webhookSecret".into(),
                reason: format!("invalid HMAC key: {e}"),
            })?;
        mac.update(&body);
        let computed = hex_encode(&mac.finalize().into_bytes());
        if ct_eq(computed.as_bytes(), expected.as_bytes()) {
            return Ok(());
        }
        return Err(NodeError::AuthError(
            "GitHub X-Hub-Signature-256 mismatch".into(),
        ));
    }

    if let Some(sig) = header(td, "x-hub-signature") {
        let expected = sig.strip_prefix("sha1=").unwrap_or(sig);
        let mut mac = <Hmac<Sha1> as Mac>::new_from_slice(secret.as_bytes())
            .map_err(|e| NodeError::InvalidParameter {
                name: "webhookSecret".into(),
                reason: format!("invalid HMAC key: {e}"),
            })?;
        mac.update(&body);
        let computed = hex_encode(&mac.finalize().into_bytes());
        if ct_eq(computed.as_bytes(), expected.as_bytes()) {
            return Ok(());
        }
        return Err(NodeError::AuthError(
            "GitHub X-Hub-Signature (sha1) mismatch".into(),
        ));
    }

    Err(NodeError::AuthError(
        "Missing X-Hub-Signature(-256) header".into(),
    ))
}

#[async_trait]
impl Node for GithubTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "githubTrigger",
            "GitHub Trigger",
            "Run a flow on a GitHub webhook event",
            NodeCategory::Trigger,
        )
        .icon("github")
        .color("#181717")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "githubApi".into(),
            display_name: "GitHub Webhook".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("GitHub credential holding the `webhookSecret` field"),
            NodeProperty::new("webhookSecret", "Webhook Secret", NodePropertyType::String)
                .description(
                    "Falls back to this if no credential is bound. Leave empty to skip \
                     HMAC verification (NOT recommended).",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::MultiOptions)
                .description("Allow-list of GitHub event names; empty = accept all")
                .options(vec![
                    opt("Push", "push"),
                    opt("Pull Request", "pull_request"),
                    opt("Pull Request Review", "pull_request_review"),
                    opt("Pull Request Review Comment", "pull_request_review_comment"),
                    opt("Issues", "issues"),
                    opt("Issue Comment", "issue_comment"),
                    opt("Release", "release"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                    opt("Fork", "fork"),
                    opt("Star", "star"),
                    opt("Watch", "watch"),
                    opt("Workflow Run", "workflow_run"),
                    opt("Workflow Job", "workflow_job"),
                    opt("Check Run", "check_run"),
                    opt("Check Suite", "check_suite"),
                    opt("Deployment", "deployment"),
                    opt("Deployment Status", "deployment_status"),
                    opt("Ping", "ping"),
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
        let td = ctx
            .trigger_data
            .clone()
            .ok_or_else(|| NodeError::Other("githubTrigger invoked without trigger_data".into()))?;

        // 1. Resolve secret (credential takes precedence, then param).
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

        // 2. Verify signature (unless explicitly skipped).
        if !skip {
            if secret.is_empty() {
                return Err(NodeError::AuthError(
                    "githubTrigger: webhookSecret is required (or set skipSignatureVerification)"
                        .into(),
                ));
            }
            verify_signature(&td, &secret)?;
        }

        // 3. Event filter.
        let event = header(&td, "x-github-event").unwrap_or("").to_string();
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
            // Event filtered out — emit no items (downstream nodes get nothing).
            return Ok(NodeOutput::single(vec![]));
        }

        // 4. Normalize envelope.
        let body = td.get("body").cloned().unwrap_or(Value::Null);
        let repo = body
            .get("repository")
            .and_then(|r| r.get("full_name"))
            .and_then(|v| v.as_str())
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
