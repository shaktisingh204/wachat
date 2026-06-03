//! The static SabChat node catalogue published to SabFlow.
//!
//! Six **triggers** + six **actions** — kept in lockstep with the
//! routes mounted by [`crate::router`]. SabFlow's executor reads this
//! list at boot (and the UI re-fetches it on each block picker open),
//! so the contents here are part of the public ABI.
//!
//! ## Why this lives in its own module
//!
//! [`crate::dto`] owns the descriptor *types*; this module owns the
//! actual catalogue. Splitting them keeps the data trivial to scan in
//! review (one block per node) and lets [`crate::handlers`] depend on
//! the catalogue without dragging in the serde derives.
//!
//! Every action descriptor's `action_path` is rooted at
//! `/v1/sabchat/sabflow` — the prefix the orchestrating `api` crate is
//! expected to nest [`crate::router`] under.

use serde_json::json;

use crate::dto::{NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType};

/// Tile color shared by every SabChat node so the picker keeps a
/// consistent visual identity.
const TILE_COLOR: &str = "#7c3aed"; // ZoruUI brand-violet 600.

/// Build the complete published catalogue. Pure — no allocations beyond
/// the returned `Vec`, no I/O.
pub fn descriptors() -> Vec<NodeDescriptor> {
    let mut out = Vec::with_capacity(12);
    out.extend(trigger_descriptors());
    out.extend(action_descriptors());
    out
}

// ===========================================================================
// Triggers
// ===========================================================================

/// The six event-driven entry points. Each `event` value is the
/// canonical name SabFlow's executor uses internally — we keep it
/// equal to the descriptor `name` so executor lookups are trivial.
fn trigger_descriptors() -> Vec<NodeDescriptor> {
    vec![
        NodeDescriptor::trigger(
            "sabchat.conversation.created",
            "Conversation created",
            "Fires when a new SabChat conversation is opened on any inbox.",
            "sabchat.conversation.created",
        )
        .icon("message-square-plus")
        .color(TILE_COLOR)
        .sample(json!({
            "conversationId": "ffffffffffffffffffffffff",
            "inboxId": "eeeeeeeeeeeeeeeeeeeeeeee",
            "contactId": "dddddddddddddddddddddddd",
            "status": "open",
            "priority": "medium",
            "createdAt": "2026-01-01T00:00:00Z"
        })),
        NodeDescriptor::trigger(
            "sabchat.conversation.assigned",
            "Conversation assigned",
            "Fires when a conversation is assigned to (or reassigned between) agents.",
            "sabchat.conversation.assigned",
        )
        .icon("user-cog")
        .color(TILE_COLOR)
        .sample(json!({
            "conversationId": "ffffffffffffffffffffffff",
            "prevAssigneeId": null,
            "newAssigneeId": "aaaaaaaaaaaaaaaaaaaaaaaa",
            "reason": "manual",
            "at": "2026-01-01T00:00:00Z"
        })),
        NodeDescriptor::trigger(
            "sabchat.conversation.resolved",
            "Conversation resolved",
            "Fires when a conversation transitions to `resolved`.",
            "sabchat.conversation.resolved",
        )
        .icon("check-circle-2")
        .color(TILE_COLOR)
        .sample(json!({
            "conversationId": "ffffffffffffffffffffffff",
            "resolvedAt": "2026-01-01T00:00:00Z",
            "resolvedBy": "aaaaaaaaaaaaaaaaaaaaaaaa"
        })),
        NodeDescriptor::trigger(
            "sabchat.message.received",
            "Message received",
            "Fires on every inbound (visitor → us) message. Outbound messages do NOT fire this trigger.",
            "sabchat.message.received",
        )
        .icon("message-circle")
        .color(TILE_COLOR)
        .sample(json!({
            "messageId": "ccccccccccccccccccccccc1",
            "conversationId": "ffffffffffffffffffffffff",
            "inboxId": "eeeeeeeeeeeeeeeeeeeeeeee",
            "contactId": "dddddddddddddddddddddddd",
            "direction": "inbound",
            "content": { "kind": "text", "text": "hello" },
            "createdAt": "2026-01-01T00:00:00Z"
        })),
        NodeDescriptor::trigger(
            "sabchat.sla.breached",
            "SLA breached",
            "Fires when any SLA clock on a conversation (first-response, next-response, resolution) crosses its deadline.",
            "sabchat.sla.breached",
        )
        .icon("alarm-clock-off")
        .color(TILE_COLOR)
        .sample(json!({
            "conversationId": "ffffffffffffffffffffffff",
            "clock": "first_response",
            "dueAt": "2026-01-01T00:05:00Z",
            "breachedAt": "2026-01-01T00:06:00Z"
        })),
        NodeDescriptor::trigger(
            "sabchat.csat.submitted",
            "CSAT submitted",
            "Fires when a contact submits a CSAT rating after a conversation.",
            "sabchat.csat.submitted",
        )
        .icon("smile")
        .color(TILE_COLOR)
        .sample(json!({
            "conversationId": "ffffffffffffffffffffffff",
            "contactId": "dddddddddddddddddddddddd",
            "score": 5,
            "comment": "Great help, thanks!",
            "submittedAt": "2026-01-01T00:10:00Z"
        })),
    ]
}

// ===========================================================================
// Actions
// ===========================================================================

/// The six imperative action nodes. Each descriptor's `action_path`
/// must match the corresponding route in [`crate::router`].
fn action_descriptors() -> Vec<NodeDescriptor> {
    vec![
        NodeDescriptor::action(
            "sabchat.action.send_message",
            "Send SabChat message",
            "Append a bot/agent message to a SabChat conversation.",
            "POST",
            "/v1/sabchat/sabflow/actions/send-message",
        )
        .icon("send")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required()
                .description("Hex ObjectId of the target conversation."),
            NodeProperty::new("text", "Message text", NodePropertyType::Text)
                .required()
                .placeholder("Hi {{contact.name}}, just checking in…"),
            NodeProperty::new("private", "Private note", NodePropertyType::Boolean)
                .description("If on, the message is recorded as a private note (agents only)."),
        ]),
        NodeDescriptor::action(
            "sabchat.action.add_label",
            "Add SabChat label",
            "Attach a label to a SabChat conversation (idempotent).",
            "POST",
            "/v1/sabchat/sabflow/actions/add-label",
        )
        .icon("tag")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required(),
            NodeProperty::new("label", "Label", NodePropertyType::String)
                .required()
                .placeholder("vip"),
        ]),
        NodeDescriptor::action(
            "sabchat.action.set_status",
            "Set SabChat status",
            "Move a SabChat conversation between lifecycle states.",
            "POST",
            "/v1/sabchat/sabflow/actions/set-status",
        )
        .icon("activity")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required(),
            NodeProperty::new("status", "Status", NodePropertyType::Options)
                .required()
                .options(vec![
                    NodePropertyOption::new("open", "Open"),
                    NodePropertyOption::new("pending", "Pending"),
                    NodePropertyOption::new("resolved", "Resolved"),
                    NodePropertyOption::new("snoozed", "Snoozed"),
                ]),
        ]),
        NodeDescriptor::action(
            "sabchat.action.set_priority",
            "Set SabChat priority",
            "Update the priority on a SabChat conversation.",
            "POST",
            "/v1/sabchat/sabflow/actions/set-priority",
        )
        .icon("flag")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required(),
            NodeProperty::new("priority", "Priority", NodePropertyType::Options)
                .required()
                .options(vec![
                    NodePropertyOption::new("low", "Low"),
                    NodePropertyOption::new("medium", "Medium"),
                    NodePropertyOption::new("high", "High"),
                    NodePropertyOption::new("urgent", "Urgent"),
                ]),
        ]),
        NodeDescriptor::action(
            "sabchat.action.set_assignee",
            "Set SabChat assignee",
            "Assign a SabChat conversation to a specific agent (or clear the assignment).",
            "POST",
            "/v1/sabchat/sabflow/actions/set-assignee",
        )
        .icon("user-plus")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required(),
            NodeProperty::new("assigneeId", "Assignee ID", NodePropertyType::Id)
                .description("Hex ObjectId of the agent. Leave empty to clear the assignment."),
        ]),
        NodeDescriptor::action(
            "sabchat.action.run_macro",
            "Run SabChat macro",
            "Apply a pre-defined SabChat macro to a conversation.",
            "POST",
            "/v1/sabchat/sabflow/actions/run-macro",
        )
        .icon("zap")
        .color(TILE_COLOR)
        .properties(vec![
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::Id)
                .required(),
            NodeProperty::new("macroId", "Macro ID", NodePropertyType::Id).required(),
            NodeProperty::new("vars", "Variables", NodePropertyType::Json)
                .description("Optional JSON object — merged on top of the conversation's customAttrs at run time."),
        ]),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::NodeCategory;

    #[test]
    fn catalogue_has_six_triggers_and_six_actions() {
        let all = descriptors();
        let triggers = all
            .iter()
            .filter(|d| d.category == NodeCategory::Trigger)
            .count();
        let actions = all
            .iter()
            .filter(|d| d.category == NodeCategory::Action)
            .count();
        assert_eq!(triggers, 6, "expected six trigger descriptors");
        assert_eq!(actions, 6, "expected six action descriptors");
    }

    #[test]
    fn every_action_carries_method_and_path() {
        for d in descriptors()
            .into_iter()
            .filter(|d| d.category == NodeCategory::Action)
        {
            assert!(
                d.action_method.is_some() && d.action_path.is_some(),
                "action `{}` missing method/path",
                d.name,
            );
            // Action paths must all share the `/v1/sabchat/sabflow/`
            // prefix so the orchestrating crate can nest us correctly.
            let p = d.action_path.unwrap();
            assert!(
                p.starts_with("/v1/sabchat/sabflow/actions/"),
                "unexpected action path: {p}",
            );
        }
    }

    #[test]
    fn every_trigger_carries_event_and_is_marked_trigger() {
        for d in descriptors()
            .into_iter()
            .filter(|d| d.category == NodeCategory::Trigger)
        {
            assert!(d.is_trigger, "trigger `{}` not flagged is_trigger", d.name);
            assert!(d.event.is_some(), "trigger `{}` missing event", d.name);
        }
    }

    #[test]
    fn descriptor_names_are_unique() {
        let mut names: Vec<String> = descriptors().into_iter().map(|d| d.name).collect();
        names.sort();
        let mut deduped = names.clone();
        deduped.dedup();
        assert_eq!(names, deduped, "duplicate descriptor name(s)");
    }
}
