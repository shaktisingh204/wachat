//! Form Trigger node (`n8n-nodes-base.formTrigger`).
//!
//! Fires a flow when a public, hosted form is submitted. The actual form is
//! served by the Next.js side (under `/sabflow/forms/[formId]`); when a
//! submission is received, the engine is invoked with the parsed form fields
//! and any uploaded file references in `ExecutionContext::trigger_data`.
//!
//! Activation contract (consumed by the upstream scheduler / activator):
//!   - On flow activation, an `httpEndpoint` resource is provisioned at the
//!     auto-generated `formPath`. Submissions POST JSON shaped as
//!     `{ formData: Record<string, unknown>, files: Array<SabFileRef> }`.
//!   - File uploads are routed through SabFiles (per project CLAUDE.md — no
//!     external URL pastes); the trigger payload only carries SabFile refs.
//!
//! This node's `execute` simply surfaces the submission payload (or an empty
//! object if invoked without trigger data, e.g. a manual test run).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::NodeResult,
    node::Node,
};

pub struct FormTriggerNode;

#[async_trait]
impl Node for FormTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "formTrigger",
            "Form Trigger",
            "Fire when a hosted form is submitted",
            NodeCategory::Trigger,
        )
        .icon("clipboard-list")
        .color("#10b981")
        .trigger()
        .properties(vec![
            NodeProperty::new("formTitle", "Form Title", NodePropertyType::String)
                .default(Value::String("My Form".into()))
                .description("Heading shown at the top of the hosted form page."),
            NodeProperty::new(
                "formDescription",
                "Form Description",
                NodePropertyType::String,
            )
            .default(Value::String(String::new()))
            .description("Short paragraph shown below the title."),
            NodeProperty::new("formPath", "Form Path", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Auto-generated if empty; the actual public URL is finalised at activation \
                     time and lives under `/sabflow/forms/<formPath>`.",
                ),
            NodeProperty::new("formFields", "Form Fields", NodePropertyType::Json)
                .default(json!([
                    { "name": "email", "label": "Email", "type": "email", "required": true }
                ]))
                .description(
                    "Schema for the rendered form fields. Each entry needs `name`, `label`, \
                     and `type` (`text`, `email`, `number`, `textarea`, `select`, `file`).",
                ),
            NodeProperty::new("responseMode", "Response Mode", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Show Confirmation Message".into(),
                        value: Value::String("onReceived".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "When Last Node Finishes".into(),
                        value: Value::String("lastNode".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Redirect URL".into(),
                        value: Value::String("redirect".into()),
                        description: None,
                    },
                ])
                .default(Value::String("onReceived".into())),
            NodeProperty::new(
                "confirmationMessage",
                "Confirmation Message",
                NodePropertyType::String,
            )
            .default(Value::String("Thanks for your submission!".into()))
            .show_when("responseMode", &["onReceived"]),
            NodeProperty::new("redirectUrl", "Redirect URL", NodePropertyType::String)
                .default(Value::String(String::new()))
                .show_when("responseMode", &["redirect"]),
            NodeProperty::new(
                "authentication",
                "Authentication",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "None (Public)".into(),
                    value: Value::String("none".into()),
                    description: None,
                },
                NodePropertyOption {
                    name: "Basic Auth".into(),
                    value: Value::String("basicAuth".into()),
                    description: None,
                },
                NodePropertyOption {
                    name: "Workspace Members Only".into(),
                    value: Value::String("workspaceMembers".into()),
                    description: None,
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
        // Trigger data shape: { formData: {...}, files: [SabFileRef, ...] }
        Ok(NodeOutput::single(vec![
            ctx.trigger_data
                .clone()
                .unwrap_or(json!({ "formData": {}, "files": [] })),
        ]))
    }
}
