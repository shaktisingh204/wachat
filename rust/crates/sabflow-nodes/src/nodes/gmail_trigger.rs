//! Gmail Trigger node.
//!
//! Fires a SabFlow when a Gmail mailbox receives new messages. Gmail does not
//! offer a synchronous webhook — instead, Google publishes change notifications
//! to Google Cloud Pub/Sub, and Pub/Sub then push-delivers a JSON envelope to a
//! configured HTTPS endpoint. SabFlow exposes that endpoint via the same
//! webhook plumbing as the generic `webhook` trigger; the inbound Pub/Sub push
//! payload is handed to the engine through [`ExecutionContext::trigger_data`].
//!
//! This node has two jobs:
//!   1. Declare, via its [`NodeDescriptor`] properties, how the Pub/Sub
//!      subscription and (optionally) Gmail `users.watch` should be set up
//!      (topic, label filter, history-type, JWT verification audience).
//!   2. At execution time, surface the Pub/Sub-delivered payload to downstream
//!      nodes — decoding the `message.data` base64 blob (a Gmail
//!      `historyId` / `emailAddress` JSON envelope) into a structured item.
//!
//! The actual JWT verification of Pub/Sub's `Authorization: Bearer …` header
//! happens upstream in the HTTP receiver (see
//! `src/app/api/sabflow/webhook/[webhookId]/route.ts`); if upstream rejects an
//! unauthenticated request, this node is never invoked. As a defensive
//! fallback, when the request *did* reach us but lacks the `pubsubVerified`
//! marker, we error out with [`NodeError::AuthError`].
//!
//! n8n parity: `n8n-nodes-base.gmailTrigger`.

use async_trait::async_trait;
use base64::Engine;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct GmailTriggerNode;

#[async_trait]
impl Node for GmailTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gmailTrigger",
            "Gmail Trigger",
            "Fire when new Gmail messages arrive (via Pub/Sub push)",
            NodeCategory::Trigger,
        )
        .icon("mail")
        .color("#EA4335")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "gmailOAuth2".into(),
            display_name: "Gmail OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new(
                "event",
                "Trigger On",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Message Received".into(),
                    value: json!("messageReceived"),
                    description: Some(
                        "Fire once per new message arriving in the watched mailbox.".into(),
                    ),
                },
                NodePropertyOption {
                    name: "Label Added".into(),
                    value: json!("labelAdded"),
                    description: Some("Fire when a label is added to a message.".into()),
                },
                NodePropertyOption {
                    name: "Label Removed".into(),
                    value: json!("labelRemoved"),
                    description: Some("Fire when a label is removed from a message.".into()),
                },
            ])
            .default(json!("messageReceived"))
            .required(),
            NodeProperty::new("topicName", "Pub/Sub Topic", NodePropertyType::String)
                .placeholder("projects/PROJECT_ID/topics/TOPIC_ID")
                .description(
                    "Pub/Sub topic to which Gmail will publish history notifications. \
                     The topic must grant `gmail-api-push@system.gserviceaccount.com` the \
                     Publisher role.",
                )
                .required(),
            NodeProperty::new("labelIds", "Label Filter", NodePropertyType::String)
                .default(json!("INBOX"))
                .description(
                    "Comma-separated Gmail label IDs to watch. Default: INBOX. \
                     Use `*` to watch all labels.",
                ),
            NodeProperty::new(
                "labelFilterBehavior",
                "Label Filter Behavior",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Include".into(),
                    value: json!("include"),
                    description: None,
                },
                NodePropertyOption {
                    name: "Exclude".into(),
                    value: json!("exclude"),
                    description: None,
                },
            ])
            .default(json!("include")),
            NodeProperty::new("pubsubAudience", "Pub/Sub Audience", NodePropertyType::String)
                .description(
                    "Expected `aud` claim on the Pub/Sub OIDC Bearer token. \
                     Used by the SabFlow webhook receiver to verify the push.",
                ),
            NodeProperty::new(
                "pubsubServiceAccount",
                "Pub/Sub Service Account",
                NodePropertyType::String,
            )
            .description(
                "Expected `email` claim on the Pub/Sub OIDC token (the service account \
                 you configured on the push subscription).",
            ),
            NodeProperty::new("dropPayload", "Drop Empty Payload", NodePropertyType::Boolean)
                .default(json!(false))
                .description(
                    "When true, do not surface heartbeat / empty Pub/Sub messages downstream.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or(json!({}));

        // The HTTP receiver records whether it accepted the Pub/Sub OIDC Bearer
        // token. We treat a missing marker as untrusted and refuse to fire so
        // an unauthenticated direct POST to the webhook URL can't masquerade as
        // a Pub/Sub push.
        if let Some(marker) = trigger.get("pubsubVerified") {
            if marker.as_bool() != Some(true) {
                return Err(NodeError::AuthError(
                    "Pub/Sub OIDC Bearer token failed verification".into(),
                ));
            }
        } else if trigger.get("manual").and_then(|v| v.as_bool()) != Some(true) {
            // No verification marker and not a manual test → reject.
            return Err(NodeError::AuthError(
                "Gmail trigger requires a verified Pub/Sub push or manual=true trigger".into(),
            ));
        }

        let drop_empty = ctx.param_bool(params, "dropPayload", false);
        let decoded = decode_pubsub_envelope(&trigger);

        if drop_empty && decoded.get("data").map(|d| d.is_null()).unwrap_or(true) {
            return Ok(NodeOutput::single(vec![]));
        }

        let event = ctx
            .param_str_opt(params, "event")
            .unwrap_or_else(|| "messageReceived".to_string());

        let item = json!({
            "event": event,
            "raw": trigger,
            "message": decoded,
        });

        Ok(NodeOutput::single(vec![item]))
    }
}

/// Pub/Sub push envelopes wrap the actual payload as a base64-encoded `data`
/// field inside a `message` object. We decode it best-effort into a structured
/// JSON value so downstream nodes can read it without re-implementing the
/// envelope shape.
fn decode_pubsub_envelope(trigger: &Value) -> Value {
    let message = trigger.get("message").cloned().unwrap_or(Value::Null);
    let data_b64 = message.get("data").and_then(|d| d.as_str()).unwrap_or("");
    if data_b64.is_empty() {
        return json!({
            "messageId": message.get("messageId").cloned().unwrap_or(Value::Null),
            "publishTime": message.get("publishTime").cloned().unwrap_or(Value::Null),
            "attributes": message.get("attributes").cloned().unwrap_or(Value::Null),
            "data": Value::Null,
        });
    }
    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(data_b64)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(data_b64))
        .unwrap_or_default();
    let decoded_str = String::from_utf8_lossy(&decoded_bytes).to_string();
    let parsed: Value =
        serde_json::from_str(&decoded_str).unwrap_or_else(|_| Value::String(decoded_str.clone()));
    json!({
        "messageId": message.get("messageId").cloned().unwrap_or(Value::Null),
        "publishTime": message.get("publishTime").cloned().unwrap_or(Value::Null),
        "attributes": message.get("attributes").cloned().unwrap_or(Value::Null),
        "data": parsed,
    })
}
