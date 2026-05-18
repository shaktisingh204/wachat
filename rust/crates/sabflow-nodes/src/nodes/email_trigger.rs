//! Email Trigger (IMAP) node (`n8n-nodes-base.emailTrigger`).
//!
//! In n8n this polls an IMAP mailbox and fires the flow once per new message.
//! SabFlow already has a full IMAP **action** node (`emailReadImap`) that
//! performs the actual fetch + parse against a connected `imap` credential.
//!
//! The trigger variant here exposes the n8n configuration surface (mailbox,
//! poll interval, post-process action) but does **not** maintain its own
//! IMAP connection — instead, on flow activation the upstream scheduler
//! provisions a Vercel Cron tick at the chosen interval, and each tick runs
//! the same IMAP fetch logic. The per-tick result is forged into
//! `ExecutionContext::trigger_data` as `{ messages: [...] }`, which this
//! node simply surfaces.
//!
//! This keeps trigger activation/deactivation entirely declarative and lets us
//! reuse the implemented IMAP client in [`super::email_read_imap`].

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::NodeResult,
    node::Node,
};

pub struct EmailTriggerNode;

#[async_trait]
impl Node for EmailTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailTrigger",
            "Email Trigger (IMAP)",
            "Fire on new messages in an IMAP mailbox",
            NodeCategory::Trigger,
        )
        .icon("mail")
        .color("#f59e0b")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "imap".into(),
            display_name: "IMAP Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("mailbox", "Mailbox", NodePropertyType::String)
                .default(Value::String("INBOX".into()))
                .description("Mailbox folder to poll (e.g. `INBOX`, `INBOX.Receipts`)."),
            NodeProperty::new(
                "pollInterval",
                "Poll Interval (Minutes)",
                NodePropertyType::Number,
            )
            .default(json!(5))
            .description(
                "How often to poll the mailbox. Backed by Vercel Cron — minimum 1 minute.",
            ),
            NodeProperty::new("postProcessAction", "Action After Read", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Mark as Read".into(),
                        value: Value::String("markRead".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Leave Unread".into(),
                        value: Value::String("leaveUnread".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: Value::String("delete".into()),
                        description: None,
                    },
                ])
                .default(Value::String("markRead".into())),
            NodeProperty::new("format", "Output Format", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Simple (parsed)".into(),
                        value: Value::String("simple".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Resolved (with attachments as SabFiles)".into(),
                        value: Value::String("resolved".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Raw (RFC822)".into(),
                        value: Value::String("raw".into()),
                        description: None,
                    },
                ])
                .default(Value::String("simple".into())),
            NodeProperty::new(
                "downloadAttachments",
                "Download Attachments to SabFiles",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false))
            .description(
                "When enabled, attachments are uploaded to the workspace's SabFiles library \
                 (per project policy — never via free-text URLs) and surfaced as SabFile refs.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Each tick forges `{ messages: [...] }` into trigger_data; if absent
        // (manual test run) we yield a single empty-list item so downstream
        // nodes still get an input batch.
        let payload = ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({ "messages": [] }));
        Ok(NodeOutput::single(vec![payload]))
    }
}
