//! Stop and Error node (`stopAndError`).
//!
//! Terminal node — when executed it deliberately fails the workflow with a
//! user-supplied message.  Mirrors n8n's `n8n-nodes-base.stopAndError`.
//!
//! Implementation maps the failure onto [`NodeError::Halted`], a dedicated
//! variant the engine recognises to short-circuit the run with status
//! `error` and the supplied reason as the failure message.
//!
//! Supported error-types (parity with n8n V1):
//!   - `errorMessage` — plain string message (default).
//!   - `errorObject`  — a JSON object whose `message` field (or the entire
//!     object's JSON form if no `message`) is surfaced as the reason.
//!
//! The node always halts; it never emits items.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct StopAndErrorNode;

#[async_trait]
impl Node for StopAndErrorNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "stopAndError",
            "Stop and Error",
            "Halt the workflow with an error message",
            NodeCategory::Logic,
        )
        .icon("octagon-x")
        .color("#dc2626")
        .properties(vec![
            NodeProperty::new("errorType", "Error Type", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Error Message".into(),
                        value: json!("errorMessage"),
                        description: Some("Fail the workflow with a static string".into()),
                    },
                    NodePropertyOption {
                        name: "Error Object".into(),
                        value: json!("errorObject"),
                        description: Some(
                            "Fail the workflow with a JSON object — `message` is surfaced".into(),
                        ),
                    },
                ])
                .default(json!("errorMessage"))
                .required(),
            NodeProperty::new("errorMessage", "Error Message", NodePropertyType::String)
                .placeholder("Order rejected: insufficient inventory")
                .default(json!("An error occurred!"))
                .show_when("errorType", &["errorMessage"]),
            NodeProperty::new("errorObject", "Error Object", NodePropertyType::Json)
                .default(json!({ "message": "An error occurred!", "code": "WORKFLOW_HALTED" }))
                .show_when("errorType", &["errorObject"])
                .description("JSON object — its `message` field becomes the failure reason."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let error_type = ctx
            .param_str_opt(params, "errorType")
            .unwrap_or_else(|| "errorMessage".to_string());

        let reason = match error_type.as_str() {
            "errorMessage" => {
                let raw = ctx
                    .param_str_opt(params, "errorMessage")
                    .unwrap_or_else(|| "An error occurred!".to_string());
                if raw.trim().is_empty() {
                    "An error occurred!".to_string()
                } else {
                    raw
                }
            }
            "errorObject" => {
                let obj = params
                    .get("errorObject")
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                match &obj {
                    Value::Object(map) => {
                        if let Some(msg) = map.get("message").and_then(|v| v.as_str()) {
                            if msg.trim().is_empty() {
                                obj.to_string()
                            } else {
                                ctx.substitute(msg)
                            }
                        } else {
                            obj.to_string()
                        }
                    }
                    Value::String(s) => {
                        if s.trim().is_empty() {
                            "An error occurred!".to_string()
                        } else {
                            ctx.substitute(s)
                        }
                    }
                    Value::Null => "An error occurred!".to_string(),
                    other => other.to_string(),
                }
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "errorType".into(),
                    reason: format!("unknown errorType: {other}"),
                });
            }
        };

        Err(NodeError::Halted(reason))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "exec_test".into(),
            Arc::new(reqwest::Client::new()),
        )
    }

    #[tokio::test]
    async fn errormessage_default_text_is_used() {
        let node = StopAndErrorNode;
        let mut c = ctx();
        let params = json!({ "errorType": "errorMessage", "errorMessage": "boom" });
        let res = node.execute(&mut c, NodeInput::empty(), &params).await;
        match res {
            Err(NodeError::Halted(reason)) => assert_eq!(reason, "boom"),
            other => panic!("expected Halted, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn errormessage_empty_falls_back_to_default() {
        let node = StopAndErrorNode;
        let mut c = ctx();
        let params = json!({ "errorType": "errorMessage", "errorMessage": "   " });
        let res = node.execute(&mut c, NodeInput::empty(), &params).await;
        match res {
            Err(NodeError::Halted(reason)) => assert_eq!(reason, "An error occurred!"),
            other => panic!("expected Halted, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn errorobject_message_field_surfaces() {
        let node = StopAndErrorNode;
        let mut c = ctx();
        let params = json!({
            "errorType": "errorObject",
            "errorObject": { "message": "rejected", "code": 42 }
        });
        let res = node.execute(&mut c, NodeInput::empty(), &params).await;
        match res {
            Err(NodeError::Halted(reason)) => assert_eq!(reason, "rejected"),
            other => panic!("expected Halted, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn errorobject_without_message_falls_back_to_json() {
        let node = StopAndErrorNode;
        let mut c = ctx();
        let params = json!({
            "errorType": "errorObject",
            "errorObject": { "code": 42 }
        });
        let res = node.execute(&mut c, NodeInput::empty(), &params).await;
        match res {
            Err(NodeError::Halted(reason)) => assert!(reason.contains("\"code\":42")),
            other => panic!("expected Halted, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn unknown_errortype_is_invalid_parameter() {
        let node = StopAndErrorNode;
        let mut c = ctx();
        let params = json!({ "errorType": "shrug" });
        let res = node.execute(&mut c, NodeInput::empty(), &params).await;
        match res {
            Err(NodeError::InvalidParameter { name, .. }) => assert_eq!(name, "errorType"),
            other => panic!("expected InvalidParameter, got: {other:?}"),
        }
    }
}
