//! Jira Trigger node (`n8n-nodes-base.jiraTrigger`).
//!
//! Unlike Notion / Airtable, Jira Cloud exposes first-class outbound
//! webhooks: an administrator (or the Jira REST API
//! `POST /rest/api/3/webhook`) can register a callback URL plus a list of
//! `jql` filters and event names. Jira then POSTs an `application/json`
//! payload to that URL whenever a matching issue event occurs.
//!
//! SabFlow's activation contract for this trigger:
//!   - On flow activation we POST `/rest/api/3/webhook` against the
//!     credential's Jira Cloud instance with the configured `events` + `jql`
//!     and a SabFlow-side callback URL (`/api/sabflow/triggers/jira/:flowId`).
//!     The returned webhook ID is stored on the trigger state so we can
//!     `DELETE /rest/api/3/webhook/{id}` on deactivation.
//!   - The inbound HTTP receiver lives outside the engine (Next.js route)
//!     and, on every Jira POST, validates the payload and invokes the
//!     engine with the parsed event in `ExecutionContext::trigger_data`.
//!
//! This node's `execute` simply surfaces that trigger payload — no polling,
//! no long-lived connection, no new top-level deps.

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

pub struct JiraTriggerNode;

#[async_trait]
impl Node for JiraTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jiraTrigger",
            "Jira Trigger",
            "Fire on Jira Cloud issue / comment events (webhook-backed)",
            NodeCategory::Developer,
        )
        .icon("layers")
        .color("#0052CC")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "jiraApi".into(),
            display_name: "Jira API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("events", "Events", NodePropertyType::Json)
                .default(json!([
                    "jira:issue_created",
                    "jira:issue_updated"
                ]))
                .required()
                .description(
                    "JSON array of Jira webhook event names. Common values: \
                     `jira:issue_created`, `jira:issue_updated`, `jira:issue_deleted`, \
                     `comment_created`, `comment_updated`, `comment_deleted`, \
                     `jira:worklog_updated`, `sprint_started`, `sprint_closed`.",
                ),
            NodeProperty::new("jqlFilter", "JQL Filter", NodePropertyType::String)
                .placeholder("project = PROJ AND status != Done")
                .description(
                    "Optional JQL used by Jira to filter which issues fire the webhook. \
                     Leave blank to receive every event for the configured types.",
                ),
            NodeProperty::new(
                "includeFields",
                "Include Fields",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Default".into(),
                    value: Value::String("default".into()),
                    description: Some("Whatever Jira sends in the webhook body.".into()),
                },
                NodePropertyOption {
                    name: "All (re-fetch issue)".into(),
                    value: Value::String("all".into()),
                    description: Some(
                        "After the webhook fires, re-fetch the full issue via the REST API \
                         and merge it into the payload."
                            .into(),
                    ),
                },
                NodePropertyOption {
                    name: "Minimal (id, key, summary)".into(),
                    value: Value::String("minimal".into()),
                    description: None,
                },
            ])
            .default(Value::String("default".into())),
            NodeProperty::new(
                "excludeBodyFields",
                "Exclude Body Fields",
                NodePropertyType::Json,
            )
            .default(json!([]))
            .description(
                "Optional list of top-level keys to strip from the webhook body before the \
                 flow sees it (e.g. `[\"user\", \"changelog\"]`).",
            ),
            NodeProperty::new("authentication", "Authentication", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "None".into(),
                        value: Value::String("none".into()),
                        description: Some(
                            "Anyone with the callback URL can fire this trigger.".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Shared Secret (Header)".into(),
                        value: Value::String("headerSecret".into()),
                        description: Some(
                            "Require an `X-SabFlow-Secret` header on each Jira request \
                             (stored on the trigger state at activation time)."
                                .into(),
                        ),
                    },
                ])
                .default(Value::String("none".into())),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // The inbound HTTP receiver forges the parsed Jira event body into
        // trigger_data; a manual test run gets an empty object so downstream
        // nodes still receive an input item.
        let payload = ctx.trigger_data.clone().unwrap_or(json!({}));
        Ok(NodeOutput::single(vec![payload]))
    }
}
