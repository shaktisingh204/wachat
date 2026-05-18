//! Google Drive Trigger node.
//!
//! Fires a SabFlow when files in a Google Drive change. Google Drive supports
//! two notification mechanisms, both of which this trigger declares
//! support for:
//!
//!   1. **`files.watch` push channel** (Pub/Sub-style HTTPS push). Drive POSTs
//!      a notification envelope to a SabFlow webhook URL when a watched
//!      resource changes. Authentication is via the `X-Goog-Channel-Token`
//!      header and an OIDC Bearer token if the channel was configured with
//!      one — verification happens in the HTTP receiver, which sets
//!      `pubsubVerified=true` on the trigger payload when it accepts the
//!      push. (Drive also includes `X-Goog-Resource-State`,
//!      `X-Goog-Channel-Id`, etc., which the receiver normalises into the
//!      `headers` object on `trigger_data`.)
//!
//!   2. **Polling**. For resources `files.watch` doesn't cover (e.g. specific
//!      shared-drive folders), the descriptor advertises a `pollInterval` and
//!      the upstream scheduler polls the Drive `changes.list` API on cadence.
//!
//! n8n parity: `n8n-nodes-base.googleDriveTrigger`.

use async_trait::async_trait;
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

pub struct GoogleDriveTriggerNode;

#[async_trait]
impl Node for GoogleDriveTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleDriveTrigger",
            "Google Drive Trigger",
            "Fire when files in Google Drive change (watch-push or poll)",
            NodeCategory::Trigger,
        )
        .icon("hard-drive")
        .color("#4285F4")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "googleDriveOAuth2".into(),
            display_name: "Google Drive OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new(
                "deliveryMode",
                "Delivery Mode",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Push (files.watch)".into(),
                    value: json!("watch"),
                    description: Some(
                        "Use Drive's files.watch channel to receive HTTPS pushes.".into(),
                    ),
                },
                NodePropertyOption {
                    name: "Poll".into(),
                    value: json!("poll"),
                    description: Some(
                        "Periodically call changes.list — useful for resources \
                         files.watch doesn't cover.".into(),
                    ),
                },
            ])
            .default(json!("watch"))
            .required(),
            NodeProperty::new("event", "Trigger On", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "File Created".into(),
                        value: json!("fileCreated"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "File Updated".into(),
                        value: json!("fileUpdated"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "File Deleted / Trashed".into(),
                        value: json!("fileDeleted"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Any Change".into(),
                        value: json!("any"),
                        description: None,
                    },
                ])
                .default(json!("any"))
                .required(),
            NodeProperty::new("scope", "Watch Scope", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Entire Drive".into(),
                        value: json!("drive"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Specific Folder".into(),
                        value: json!("folder"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Specific File".into(),
                        value: json!("file"),
                        description: None,
                    },
                ])
                .default(json!("drive")),
            NodeProperty::new("folderId", "Folder ID", NodePropertyType::String)
                .show_when("scope", &["folder"])
                .description("The Drive folder ID to watch."),
            NodeProperty::new("fileId", "File ID", NodePropertyType::String)
                .show_when("scope", &["file"])
                .description("The Drive file ID to watch."),
            NodeProperty::new("driveId", "Shared Drive ID", NodePropertyType::String)
                .description("Optional shared-drive ID. Leave blank for the user's My Drive."),
            NodeProperty::new("mimeTypeFilter", "MIME Type Filter", NodePropertyType::String)
                .description(
                    "Optional comma-separated list of MIME types to include \
                     (e.g. application/pdf,image/png).",
                ),
            NodeProperty::new(
                "channelToken",
                "Channel Token",
                NodePropertyType::String,
            )
            .description(
                "Expected value of the `X-Goog-Channel-Token` header on push notifications. \
                 The SabFlow receiver compares this to the inbound header.",
            ),
            NodeProperty::new(
                "pubsubAudience",
                "OIDC Audience",
                NodePropertyType::String,
            )
            .description(
                "If you configured the watch channel with an OIDC Bearer token, the expected \
                 `aud` claim. Verified by the SabFlow webhook receiver.",
            ),
            NodeProperty::new("pollInterval", "Poll Interval", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Every Minute".into(),
                        value: json!("minute"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every 5 Minutes".into(),
                        value: json!("minute5"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every 15 Minutes".into(),
                        value: json!("minute15"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Hour".into(),
                        value: json!("hour"),
                        description: None,
                    },
                ])
                .default(json!("minute5"))
                .show_when("deliveryMode", &["poll"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or(json!({}));

        let delivery_mode = ctx
            .param_str_opt(params, "deliveryMode")
            .unwrap_or_else(|| "watch".to_string());
        let is_manual = trigger.get("manual").and_then(|v| v.as_bool()) == Some(true);

        if delivery_mode == "watch" && !is_manual {
            // For push deliveries, require the receiver to have verified the
            // channel token (and, if configured, the OIDC Bearer audience).
            let verified = trigger
                .get("pubsubVerified")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let channel_ok = trigger
                .get("channelTokenVerified")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !verified && !channel_ok {
                return Err(NodeError::AuthError(
                    "Google Drive watch push missing verified channel token / Bearer".into(),
                ));
            }
        }

        let event = ctx
            .param_str_opt(params, "event")
            .unwrap_or_else(|| "any".to_string());

        let item = match delivery_mode.as_str() {
            "poll" => normalize_poll_payload(&trigger, &event),
            _ => normalize_watch_payload(&trigger, &event),
        };

        match item {
            Some(values) => Ok(NodeOutput::single(values)),
            None => Ok(NodeOutput::single(vec![])),
        }
    }
}

/// Drive `files.watch` push notifications come as a small JSON body plus a
/// bag of `X-Goog-*` HTTP headers that the SabFlow receiver normalises onto
/// `trigger_data.headers`. We surface them as a single structured item.
fn normalize_watch_payload(trigger: &Value, event: &str) -> Option<Vec<Value>> {
    let headers = trigger.get("headers").cloned().unwrap_or(Value::Null);
    let resource_state = headers
        .get("x-goog-resource-state")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Skip sync handshake notifications — they confirm channel setup but
    // contain no payload to surface downstream.
    if resource_state.as_deref() == Some("sync") {
        return Some(vec![]);
    }

    let item = json!({
        "event": event,
        "deliveryMode": "watch",
        "channelId": headers.get("x-goog-channel-id").cloned().unwrap_or(Value::Null),
        "resourceId": headers.get("x-goog-resource-id").cloned().unwrap_or(Value::Null),
        "resourceState": resource_state,
        "resourceUri": headers.get("x-goog-resource-uri").cloned().unwrap_or(Value::Null),
        "messageNumber": headers.get("x-goog-message-number").cloned().unwrap_or(Value::Null),
        "changed": headers.get("x-goog-changed").cloned().unwrap_or(Value::Null),
        "body": trigger.get("body").cloned().unwrap_or(Value::Null),
    });
    Some(vec![item])
}

/// Poll-mode payloads come from the upstream scheduler with a `changes` array
/// (or a single `file` object for legacy callers). We emit one item per change.
fn normalize_poll_payload(trigger: &Value, event: &str) -> Option<Vec<Value>> {
    if let Some(Value::Array(changes)) = trigger.get("changes") {
        let mut items = Vec::with_capacity(changes.len());
        for change in changes {
            items.push(json!({
                "event": event,
                "deliveryMode": "poll",
                "change": change,
            }));
        }
        return Some(items);
    }
    if let Some(file) = trigger.get("file") {
        return Some(vec![json!({
            "event": event,
            "deliveryMode": "poll",
            "file": file,
        })]);
    }
    Some(vec![json!({
        "event": event,
        "deliveryMode": "poll",
        "raw": trigger,
    })])
}
