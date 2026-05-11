//! Publish-time validation for Telegram flows.
//!
//! Lightweight static checks — we do NOT execute the flow here. The rules
//! mirror the spec: a flow must have at least one trigger node and contain no
//! dangling edges (every edge endpoint must reference a known node id).

use std::collections::HashSet;

use crate::dto::{FlowEdge, FlowNode, FlowTrigger, ValidationError};

const TRIGGER_KINDS: &[&str] = &[
    "incoming_message",
    "command",
    "callback_query",
    "schedule",
    "business_connection",
];

const KNOWN_NODE_TYPES: &[&str] = &[
    "send_message",
    "send_media",
    "send_keyboard",
    "wait_for_reply",
    "branch_by_text",
    "branch_by_callback",
    "assign_agent",
    "tag_contact",
    "set_variable",
    "http_request",
    "run_subflow",
    "end",
    // Trigger-as-node alias for visual editors that surface the trigger as a
    // first-class graph node.
    "trigger",
];

/// Validate a flow's graph + trigger. Returns an empty vec when the flow is
/// publishable; otherwise a list of `{field, code, message}` records suitable
/// for the API to bubble straight back to the client.
pub fn validate_flow(
    trigger: &FlowTrigger,
    nodes: &[FlowNode],
    edges: &[FlowEdge],
) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    // ── Trigger ────────────────────────────────────────────────────────────
    if trigger.kind.is_empty() {
        errors.push(ValidationError {
            field: "trigger.kind".to_owned(),
            code: "TRIGGER_REQUIRED".to_owned(),
            message: "Flow must have a trigger.".to_owned(),
        });
    } else if !TRIGGER_KINDS.contains(&trigger.kind.as_str()) {
        errors.push(ValidationError {
            field: "trigger.kind".to_owned(),
            code: "TRIGGER_UNKNOWN".to_owned(),
            message: format!("Unknown trigger kind '{}'.", trigger.kind),
        });
    } else {
        match trigger.kind.as_str() {
            "command" => {
                if trigger.command.as_deref().unwrap_or("").trim().is_empty() {
                    errors.push(ValidationError {
                        field: "trigger.command".to_owned(),
                        code: "TRIGGER_COMMAND_REQUIRED".to_owned(),
                        message: "Command trigger needs a command name.".to_owned(),
                    });
                }
            }
            "schedule" => {
                if trigger.cron.as_deref().unwrap_or("").trim().is_empty() {
                    errors.push(ValidationError {
                        field: "trigger.cron".to_owned(),
                        code: "TRIGGER_CRON_REQUIRED".to_owned(),
                        message: "Schedule trigger needs a cron expression.".to_owned(),
                    });
                }
            }
            _ => {}
        }
    }

    // ── Nodes — must have at least one trigger node, or at least one action
    //   node when the trigger itself is the entry point.
    if nodes.is_empty() {
        errors.push(ValidationError {
            field: "nodes".to_owned(),
            code: "NO_NODES".to_owned(),
            message: "Flow must contain at least one node.".to_owned(),
        });
    }

    let node_ids: HashSet<&str> = nodes.iter().map(|n| n.id.as_str()).collect();
    if node_ids.len() != nodes.len() {
        errors.push(ValidationError {
            field: "nodes".to_owned(),
            code: "DUPLICATE_NODE_ID".to_owned(),
            message: "Two or more nodes share the same id.".to_owned(),
        });
    }

    for n in nodes {
        if n.id.trim().is_empty() {
            errors.push(ValidationError {
                field: "nodes".to_owned(),
                code: "NODE_ID_EMPTY".to_owned(),
                message: "A node is missing its id.".to_owned(),
            });
        }
        if !KNOWN_NODE_TYPES.contains(&n.kind.as_str()) {
            errors.push(ValidationError {
                field: format!("nodes.{}.type", n.id),
                code: "NODE_TYPE_UNKNOWN".to_owned(),
                message: format!("Unknown node type '{}'.", n.kind),
            });
        }
    }

    // ── Edges — no dangling endpoints, no duplicate ids.
    let mut edge_ids: HashSet<&str> = HashSet::new();
    for e in edges {
        if !edge_ids.insert(e.id.as_str()) {
            errors.push(ValidationError {
                field: format!("edges.{}", e.id),
                code: "DUPLICATE_EDGE_ID".to_owned(),
                message: "Two or more edges share the same id.".to_owned(),
            });
        }
        if !node_ids.contains(e.source.as_str()) {
            errors.push(ValidationError {
                field: format!("edges.{}.source", e.id),
                code: "EDGE_DANGLING_SOURCE".to_owned(),
                message: format!("Edge '{}' source '{}' does not exist.", e.id, e.source),
            });
        }
        if !node_ids.contains(e.target.as_str()) {
            errors.push(ValidationError {
                field: format!("edges.{}.target", e.id),
                code: "EDGE_DANGLING_TARGET".to_owned(),
                message: format!("Edge '{}' target '{}' does not exist.", e.id, e.target),
            });
        }
    }

    errors
}
