//! Telegram trigger node (`n8n-nodes-base.telegramTrigger`).
//!
//! Telegram delivers bot updates by POSTing a JSON `Update` object to the
//! webhook URL configured with `setWebhook`. Unlike Discord, Telegram does
//! not sign the payload — security is achieved by:
//!   1. Keeping the webhook URL secret (it contains the bot token).
//!   2. Optionally setting a `secret_token` at `setWebhook` time which
//!      Telegram echoes back via the `X-Telegram-Bot-Api-Secret-Token`
//!      header on each request.
//!
//! Trigger-data shape we expect from the receiver:
//! ```json
//! {
//!   "headers": { "x-telegram-bot-api-secret-token": "..." },
//!   "body":    { /* Telegram Update object */ },
//!   "query":   { /* query string parameters */ }
//! }
//! ```
//!
//! The node surfaces a normalized item describing which update kind was
//! delivered (message / edited_message / callback_query / inline_query /
//! channel_post / my_chat_member), along with the raw `update` payload so
//! downstream nodes can dig into specific fields.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct TelegramTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for TelegramTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "telegramTrigger",
            "Telegram Trigger",
            "Fires when a Telegram bot receives an update (message, callback, etc.)",
            NodeCategory::Trigger,
        )
        .icon("send")
        .color("#0088CC")
        .trigger()
        .properties(vec![
            NodeProperty::new("updates", "Updates", NodePropertyType::MultiOptions)
                .options(vec![
                    opt("Message", "message"),
                    opt("Edited Message", "edited_message"),
                    opt("Channel Post", "channel_post"),
                    opt("Edited Channel Post", "edited_channel_post"),
                    opt("Callback Query", "callback_query"),
                    opt("Inline Query", "inline_query"),
                    opt("Chosen Inline Result", "chosen_inline_result"),
                    opt("My Chat Member", "my_chat_member"),
                    opt("Chat Member", "chat_member"),
                    opt("Chat Join Request", "chat_join_request"),
                    opt("Pre-Checkout Query", "pre_checkout_query"),
                    opt("Shipping Query", "shipping_query"),
                ])
                .default(json!(["message"]))
                .description("Telegram update types to react to."),
            NodeProperty::new("secretToken", "Secret Token", NodePropertyType::String)
                .placeholder("Optional secret used when registering the webhook")
                .description(
                    "If set, requests whose `X-Telegram-Bot-Api-Secret-Token` header does not \
                     match this value are rejected.",
                ),
            NodeProperty::new(
                "downloadFiles",
                "Download Files",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description(
                "When true, downstream Telegram nodes are expected to dereference \
                 `file_id` values using getFile.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));

        // Secret token check.
        let expected_secret = ctx.param_str_opt(params, "secretToken").unwrap_or_default();
        let provided_secret = trigger
            .get("headers")
            .and_then(|h| h.get("x-telegram-bot-api-secret-token"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let (secret_ok, secret_note) = if expected_secret.is_empty() {
            (true, "No secret token configured".to_string())
        } else if expected_secret == provided_secret {
            (true, "Secret token matched".to_string())
        } else {
            (false, "Secret token mismatch".to_string())
        };

        // The Telegram Update object is either at `body` or directly on the trigger.
        let update = trigger
            .get("body")
            .cloned()
            .unwrap_or_else(|| trigger.clone());

        // Detect which update field is populated (telegram updates carry
        // exactly one of these per-payload).
        let update_kinds = [
            "message",
            "edited_message",
            "channel_post",
            "edited_channel_post",
            "callback_query",
            "inline_query",
            "chosen_inline_result",
            "my_chat_member",
            "chat_member",
            "chat_join_request",
            "pre_checkout_query",
            "shipping_query",
        ];
        let kind = update_kinds
            .iter()
            .find(|k| update.get(**k).is_some())
            .copied()
            .unwrap_or("unknown")
            .to_string();

        let mut out = Map::new();
        out.insert(
            "updateId".into(),
            update.get("update_id").cloned().unwrap_or(Value::Null),
        );
        out.insert("kind".into(), Value::String(kind));
        out.insert("update".into(), update);
        out.insert("secretVerified".into(), Value::Bool(secret_ok));
        out.insert("secretNote".into(), Value::String(secret_note));

        Ok(NodeOutput::single(vec![Value::Object(out)]))
    }
}
