//! Macro executor.
//!
//! Walks a stored macro's `steps` array against a target conversation,
//! applying the writes inline (no sister-crate imports per the slice
//! contract). Each step is best-effort: a failure is recorded in
//! [`RunResult::errors`] and the walk continues. The executor only
//! short-circuits on **fatal** failures (the conversation disappears
//! out from under us, the wall-clock for a snooze cannot be parsed at
//! all, …) — see the per-step branches for the exact policy.
//!
//! ## Why inline writes
//!
//! `sabchat-conversations` and `sabchat-messages` already own these
//! collections; importing them would create a cycle (and the slice
//! contract forbids it). The writes here mirror the structure those
//! crates use — see e.g. `sabchat_conversations::handlers` — so the
//! resulting documents are indistinguishable from those produced by a
//! direct REST call.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabchat_types::{ContentBlock, ConversationPriority, ConversationStatus};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::{Map, Value};

use crate::dto::{MacroStep, RunStepError};
use crate::template::interpolate;

/// Collection name constants — kept in lockstep with the sibling
/// SabChat router crates.
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const AUDIT_COLL: &str = "sabchat_audit_log";

/// Upper bound on `wait` step duration so a buggy macro cannot pin a
/// request thread for an unbounded amount of time. 30s matches the
/// outer HTTP timeout the platform terminates idle requests at.
const MAX_WAIT_SECONDS: u32 = 30;

/// Outcome of [`execute_macro`].
#[derive(Debug, Clone, Default)]
pub(crate) struct RunResult {
    /// Number of steps that completed without recording an error.
    pub steps_ran: u32,
    /// Per-step failure log. Empty on a clean run.
    pub errors: Vec<RunStepError>,
}

/// Walk every step in `steps`, applying it to `conversation_id` under
/// `tenant_id`. `actor_id` is the JWT subject (used as the actor on
/// `message_sent` audit rows). `vars` carries the request-time
/// substitution bag — the executor merges the conversation's
/// `customAttrs` underneath it before each interpolation.
pub(crate) async fn execute_macro(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    actor_id: Option<ObjectId>,
    conversation_id_hex: &str,
    steps: &[MacroStep],
    vars: Value,
) -> RunResult {
    let mut result = RunResult::default();

    // ---- resolve conversation (fatal if missing) -----------------------
    let conversation_oid = match oid_from_str(conversation_id_hex) {
        Ok(o) => o,
        Err(_) => {
            result.errors.push(RunStepError {
                step: 0,
                kind: "_init".to_owned(),
                message: "conversationId is not a valid ObjectId".to_owned(),
            });
            return result;
        }
    };

    let convs = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let conversation = match convs
        .find_one(doc! { "_id": conversation_oid, "tenantId": tenant_id })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            result.errors.push(RunStepError {
                step: 0,
                kind: "_init".to_owned(),
                message: "conversation not found".to_owned(),
            });
            return result;
        }
        Err(e) => {
            result.errors.push(RunStepError {
                step: 0,
                kind: "_init".to_owned(),
                message: format!("conversation lookup failed: {e}"),
            });
            return result;
        }
    };
    let inbox_oid = conversation.get_object_id("inboxId").ok();
    let contact_oid = conversation.get_object_id("contactId").ok();
    let custom_attrs = bson_to_serde_value(conversation.get("customAttrs"));

    // Effective interpolation bag = customAttrs overlayed by `vars`.
    let bag = merge_vars(custom_attrs, vars);

    // ---- walk steps ---------------------------------------------------
    for (idx, step) in steps.iter().enumerate() {
        let step_no = idx as u32;
        let outcome = match step {
            MacroStep::SendMessage { content, private } => {
                send_message_step(
                    mongo,
                    tenant_id,
                    actor_id,
                    conversation_oid,
                    inbox_oid,
                    contact_oid,
                    content,
                    *private,
                    &bag,
                )
                .await
            }
            MacroStep::AddLabel { label } => {
                add_label_step(mongo, tenant_id, conversation_oid, label).await
            }
            MacroStep::RemoveLabel { label } => {
                remove_label_step(mongo, tenant_id, conversation_oid, label).await
            }
            MacroStep::SetStatus { status } => {
                set_status_step(mongo, tenant_id, conversation_oid, *status).await
            }
            MacroStep::SetPriority { priority } => {
                set_priority_step(mongo, tenant_id, conversation_oid, *priority).await
            }
            MacroStep::SetAssignee { assignee_id } => {
                set_assignee_step(
                    mongo,
                    tenant_id,
                    conversation_oid,
                    assignee_id.as_deref(),
                )
                .await
            }
            MacroStep::Wait { seconds } => wait_step(*seconds).await,
            MacroStep::Snooze { until_iso } => {
                snooze_step(mongo, tenant_id, conversation_oid, until_iso).await
            }
            MacroStep::Resolve => {
                set_status_step(
                    mongo,
                    tenant_id,
                    conversation_oid,
                    ConversationStatus::Resolved,
                )
                .await
            }
        };

        match outcome {
            Ok(()) => result.steps_ran += 1,
            Err(msg) => result.errors.push(RunStepError {
                step: step_no,
                kind: step_kind(step).to_owned(),
                message: msg,
            }),
        }
    }

    result
}

// ===========================================================================
// Per-step helpers
// ===========================================================================

#[allow(clippy::too_many_arguments)]
async fn send_message_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    actor_id: Option<ObjectId>,
    conversation_oid: ObjectId,
    inbox_oid: Option<ObjectId>,
    contact_oid: Option<ObjectId>,
    content: &ContentBlock,
    private: bool,
    bag: &Value,
) -> Result<(), String> {
    // Re-serialize the block, interpolate every string leaf, then
    // re-deserialize. This keeps the executor agnostic of which
    // `ContentBlock` variants carry textual fields — every string
    // anywhere in the tree gets the same `{{var}}` pass.
    let mut content_json = serde_json::to_value(content)
        .map_err(|e| format!("content serialize: {e}"))?;
    interpolate_value(&mut content_json, bag);

    let content_bson: Bson =
        Bson::try_from(content_json).map_err(|e| format!("content -> bson: {e}"))?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let msg_oid = ObjectId::new();
    let sender_id: Bson = actor_id.map(Bson::ObjectId).unwrap_or(Bson::Null);
    let inbox_bson: Bson = inbox_oid.map(Bson::ObjectId).unwrap_or(Bson::Null);
    let contact_bson: Bson = contact_oid.map(Bson::ObjectId).unwrap_or(Bson::Null);

    let msg_doc = doc! {
        "_id": msg_oid,
        "tenantId": tenant_id,
        "conversationId": conversation_oid,
        "inboxId": inbox_bson.clone(),
        "contactId": contact_bson.clone(),
        "senderType": if private { "system" } else { "agent" },
        "senderId": sender_id.clone(),
        "direction": "outbound",
        "content": content_bson.clone(),
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": Bson::Document(Document::new()),
        "private": private,
        "createdAt": now_bson,
    };

    mongo
        .collection::<Document>(MESSAGES_COLL)
        .insert_one(msg_doc)
        .await
        .map_err(|e| format!("sabchat_messages.insert_one: {e}"))?;

    // Reflect on the parent conversation so the inbox row stays fresh.
    // Private notes do not bump `lastMessageAt` / preview — they're
    // agent-only and would mislead the visitor-facing UI.
    if !private {
        let preview = preview_for(&content_bson);
        let _ = mongo
            .collection::<Document>(CONVERSATIONS_COLL)
            .update_one(
                doc! { "_id": conversation_oid, "tenantId": tenant_id },
                doc! {
                    "$set": {
                        "lastMessageAt": now_bson,
                        "lastMessagePreview": preview,
                        "updatedAt": now_bson,
                    },
                },
            )
            .await;
    }

    // Audit: `message_sent` is part of the contract.
    let _ = mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "tenantId": tenant_id,
            "conversationId": conversation_oid,
            "inboxId": inbox_bson,
            "contactId": contact_bson,
            "action": "message_sent",
            "actorType": if private { "system" } else { "agent" },
            "actorId": sender_id,
            "before": Bson::Null,
            "after": doc! {
                "messageId": msg_oid,
                "private": private,
            },
            "createdAt": now_bson,
        })
        .await;

    Ok(())
}

async fn add_label_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    label: &str,
) -> Result<(), String> {
    if label.trim().is_empty() {
        return Err("label is empty".to_owned());
    }
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! {
                "$addToSet": { "labels": label },
                "$set": { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| format!("update_one(add_label): {e}"))?;
    Ok(())
}

async fn remove_label_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    label: &str,
) -> Result<(), String> {
    if label.trim().is_empty() {
        return Err("label is empty".to_owned());
    }
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! {
                "$pull": { "labels": label },
                "$set": { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| format!("update_one(remove_label): {e}"))?;
    Ok(())
}

async fn set_status_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    status: ConversationStatus,
) -> Result<(), String> {
    let s = status_to_str(status);
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": s,
        "updatedAt": now,
    };
    match status {
        ConversationStatus::Resolved => {
            set.insert("resolvedAt", now);
        }
        ConversationStatus::Open => {
            // Reopening clears both the resolved stamp and any pending
            // snooze timer — mirrors `sabchat-conversations`.
            set.insert("resolvedAt", Bson::Null);
            set.insert("snoozeUntil", Bson::Null);
        }
        _ => {}
    }
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| format!("update_one(set_status): {e}"))?;
    Ok(())
}

async fn set_priority_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    priority: ConversationPriority,
) -> Result<(), String> {
    let p = priority_to_str(priority);
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! { "$set": { "priority": p, "updatedAt": now } },
        )
        .await
        .map_err(|e| format!("update_one(set_priority): {e}"))?;
    Ok(())
}

async fn set_assignee_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    assignee_id: Option<&str>,
) -> Result<(), String> {
    let assignee: Bson = match assignee_id.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Bson::ObjectId(
            oid_from_str(s).map_err(|_| "assigneeId is not a valid ObjectId".to_owned())?,
        ),
        None => Bson::Null,
    };
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! { "$set": { "assigneeId": assignee, "updatedAt": now } },
        )
        .await
        .map_err(|e| format!("update_one(set_assignee): {e}"))?;
    Ok(())
}

async fn wait_step(seconds: u32) -> Result<(), String> {
    let capped = seconds.min(MAX_WAIT_SECONDS);
    tokio::time::sleep(std::time::Duration::from_secs(capped as u64)).await;
    Ok(())
}

async fn snooze_step(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    conversation_oid: ObjectId,
    until_iso: &str,
) -> Result<(), String> {
    let until: DateTime<Utc> = DateTime::parse_from_rfc3339(until_iso)
        .map_err(|e| format!("invalid untilIso (RFC3339): {e}"))?
        .with_timezone(&Utc);
    let until_bson = bson::DateTime::from_chrono(until);
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_id },
            doc! {
                "$set": {
                    "status": "snoozed",
                    "snoozeUntil": until_bson,
                    "updatedAt": now,
                },
            },
        )
        .await
        .map_err(|e| format!("update_one(snooze): {e}"))?;
    Ok(())
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Walk `value` recursively, replacing every string leaf with the
/// interpolated result. Numbers / bools / nulls are untouched.
fn interpolate_value(value: &mut Value, vars: &Value) {
    match value {
        Value::String(s) => {
            let rendered = interpolate(s, vars);
            *s = rendered;
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                interpolate_value(v, vars);
            }
        }
        Value::Object(map) => {
            for (_k, v) in map.iter_mut() {
                interpolate_value(v, vars);
            }
        }
        _ => {}
    }
}

/// Merge `top` over `base` — `top` keys win. Both are coerced to
/// objects (anything else becomes an empty object) so the resulting
/// bag is always navigable by [`crate::template::interpolate`].
fn merge_vars(base: Value, top: Value) -> Value {
    let mut out: Map<String, Value> = match base {
        Value::Object(m) => m,
        _ => Map::new(),
    };
    if let Value::Object(m) = top {
        for (k, v) in m {
            out.insert(k, v);
        }
    }
    Value::Object(out)
}

/// Best-effort `Option<&Bson>` → `Value`. Used to lift
/// `conversation.customAttrs` into the interpolation bag.
fn bson_to_serde_value(b: Option<&Bson>) -> Value {
    match b {
        Some(v) => serde_json::to_value(v).unwrap_or(Value::Null),
        None => Value::Null,
    }
}

/// Best-effort preview string for the inbox row. Mirrors the policy
/// used by `sabchat-messages` — `Text { text }` flows through verbatim,
/// everything else falls back to its `kind`.
fn preview_for(content: &Bson) -> Bson {
    if let Bson::Document(d) = content {
        if let Ok(text) = d.get_str("text") {
            let trimmed: String = text.chars().take(180).collect();
            return Bson::String(trimmed);
        }
        if let Ok(kind) = d.get_str("kind") {
            return Bson::String(format!("[{kind}]"));
        }
    }
    Bson::Null
}

/// Mirror the serde discriminants used by
/// [`sabchat_types::ConversationStatus`] in BSON-stored documents.
fn status_to_str(s: ConversationStatus) -> &'static str {
    match s {
        ConversationStatus::Open => "open",
        ConversationStatus::Pending => "pending",
        ConversationStatus::Resolved => "resolved",
        ConversationStatus::Snoozed => "snoozed",
    }
}

/// Mirror the serde discriminants used by
/// [`sabchat_types::ConversationPriority`] in BSON-stored documents.
fn priority_to_str(p: ConversationPriority) -> &'static str {
    match p {
        ConversationPriority::Low => "low",
        ConversationPriority::Medium => "medium",
        ConversationPriority::High => "high",
        ConversationPriority::Urgent => "urgent",
    }
}

/// String discriminant for [`MacroStep`] — used in error reports.
fn step_kind(s: &MacroStep) -> &'static str {
    match s {
        MacroStep::SendMessage { .. } => "send_message",
        MacroStep::AddLabel { .. } => "add_label",
        MacroStep::RemoveLabel { .. } => "remove_label",
        MacroStep::SetStatus { .. } => "set_status",
        MacroStep::SetPriority { .. } => "set_priority",
        MacroStep::SetAssignee { .. } => "set_assignee",
        MacroStep::Wait { .. } => "wait",
        MacroStep::Snooze { .. } => "snooze",
        MacroStep::Resolve => "resolve",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merge_vars_top_overrides_base() {
        let base = json!({ "a": 1, "b": 2 });
        let top = json!({ "b": 99, "c": 3 });
        let merged = merge_vars(base, top);
        assert_eq!(merged, json!({ "a": 1, "b": 99, "c": 3 }));
    }

    #[test]
    fn merge_vars_handles_non_objects() {
        let merged = merge_vars(Value::Null, json!({ "x": 1 }));
        assert_eq!(merged, json!({ "x": 1 }));
        let merged = merge_vars(json!({ "x": 1 }), Value::Null);
        assert_eq!(merged, json!({ "x": 1 }));
    }

    #[test]
    fn interpolate_value_walks_arrays_and_objects() {
        let vars = json!({ "name": "Z" });
        let mut v = json!({
            "text": "Hi {{name}}",
            "list": ["a", "{{name}}", { "nested": "{{name}}!" }],
        });
        interpolate_value(&mut v, &vars);
        assert_eq!(
            v,
            json!({
                "text": "Hi Z",
                "list": ["a", "Z", { "nested": "Z!" }],
            }),
        );
    }

    #[test]
    fn status_and_priority_to_str_round_trip_discriminants() {
        assert_eq!(status_to_str(ConversationStatus::Open), "open");
        assert_eq!(status_to_str(ConversationStatus::Resolved), "resolved");
        assert_eq!(priority_to_str(ConversationPriority::Urgent), "urgent");
    }
}
