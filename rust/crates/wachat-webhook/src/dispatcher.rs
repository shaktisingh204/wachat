//! Per-`change` dispatch logic.
//!
//! The TS receiver in `src/app/api/webhooks/meta/route.ts` walks
//! `payload.entry[].changes[]` and switches on `change.field`. We keep the
//! same shape — one `match` arm per known field, an `unhandled_field` DLQ
//! sink for known-but-out-of-scope fields (`calls`, `payment_configuration_update`,
//! `feed`), and an `unknown_field` DLQ sink for anything Meta starts sending
//! that we have not seen before.
//!
//! Causality rules (per slice spec):
//! * Within a single `change.value`, processors run **sequentially**:
//!   - `inbound.process` BEFORE `contacts.upsert_from_inbound` BEFORE
//!     `conversations.on_inbound`.
//!   - `status.process` BEFORE `conversations.on_status`.
//! * Across multiple `entry[]` / `changes[]` items, fan out concurrently —
//!   that is owned by `crate::handlers::receive`, not this function.
//!
//! Errors from processors are caught here and routed to DLQ — they are NEVER
//! propagated. Meta retries 5xx aggressively, so amplifying an internal
//! failure with a non-200 response would be catastrophic.

use bytes::Bytes;
use sabnode_common::ApiError;
use tracing::{trace, warn};

use wachat_meta_dto::{Change, ChangeValue};
use wachat_types::Project;

use crate::state::WebhookState;

/// Classification of a `change.field` value. Pure function over the field
/// string — no async, no I/O — so the dispatcher's routing behavior can be
/// unit tested without spinning up Mongo, Redis, or the sibling processors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldKind {
    /// Inbound + status events live under `field == "messages"`.
    Messages,
    /// Any of the `message_template_*_update` fields.
    TemplateEvent,
    /// Any of the account / phone-number / security fields.
    Account,
    /// Known but out-of-scope for wachat Phase 2 (`calls`,
    /// `payment_configuration_update`, `feed`).
    Unhandled,
    /// Field name we have never seen before — DLQ as `unknown_field`.
    Unknown,
}

/// Map a `change.field` string to a [`FieldKind`]. Mirrors the `match`
/// arms in [`dispatch_change`] one-for-one — keep them in sync.
pub fn classify_field(field: &str) -> FieldKind {
    match field {
        "messages" => FieldKind::Messages,
        "message_template_status_update"
        | "message_template_quality_update"
        | "message_template_components_update" => FieldKind::TemplateEvent,
        "account_alerts"
        | "account_update"
        | "account_review_update"
        | "business_capability_update"
        | "phone_number_quality_update"
        | "phone_number_name_update"
        | "security" => FieldKind::Account,
        "calls" | "payment_configuration_update" | "feed" => FieldKind::Unhandled,
        _ => FieldKind::Unknown,
    }
}

/// Reason strings written to the DLQ alongside the original raw payload.
/// Keeping these as `&'static str` constants makes them easy to grep for in
/// dashboards and replay tooling.
mod dlq_reason {
    pub const PROCESSOR_ERROR_INBOUND: &str = "processor_error:inbound";
    pub const PROCESSOR_ERROR_STATUS: &str = "processor_error:status";
    pub const PROCESSOR_ERROR_CONTACTS: &str = "processor_error:contacts";
    pub const PROCESSOR_ERROR_CONVERSATIONS_INBOUND: &str =
        "processor_error:conversations_inbound";
    pub const PROCESSOR_ERROR_CONVERSATIONS_STATUS: &str = "processor_error:conversations_status";
    pub const PROCESSOR_ERROR_ACCOUNT: &str = "processor_error:account";
    pub const PROCESSOR_ERROR_TEMPLATE_EVENTS: &str = "processor_error:template_events";
    pub const UNHANDLED_FIELD: &str = "unhandled_field";
    pub const UNKNOWN_FIELD: &str = "unknown_field";
}

/// Dispatch a single `Change` to its processor(s).
///
/// `raw_payload` is the original signature-verified body; the dispatcher
/// forwards it verbatim to the DLQ on any error. Passing the *full* payload
/// (not just the offending change) is deliberate — replay tooling needs the
/// envelope to re-run signature verification end-to-end.
///
/// Returns `Ok(())` even when individual processors fail. The `Result` type
/// is preserved so future refactors can add fatal-error variants without a
/// breaking signature change; today every error is swallowed → DLQ.
pub async fn dispatch_change(
    state: &WebhookState,
    project: &Project,
    change: &Change,
    raw_payload: &Bytes,
) -> Result<(), ApiError> {
    let field = change.field.as_str();
    let value = &change.value;

    trace!(field = field, project_id = %project.id, "dispatching change");

    match field {
        // ── messages: the heavy hitter ───────────────────────────────
        // One `change.value` can carry inbound `messages[]` AND outbound
        // delivery `statuses[]` in the same payload. Process both;
        // inbound before its dependents, status before its dependents.
        "messages" => {
            dispatch_messages(state, project, value, raw_payload).await;
        }

        // ── template events ──────────────────────────────────────────
        "message_template_status_update"
        | "message_template_quality_update"
        | "message_template_components_update" => {
            if let Err(err) = state
                .template_events
                .process(project, value, field)
                .await
            {
                warn!(
                    error = %err,
                    field = field,
                    project_id = %project.id,
                    "template_events processor failed; routing to DLQ"
                );
                send_to_dlq(state, raw_payload, dlq_reason::PROCESSOR_ERROR_TEMPLATE_EVENTS).await;
            }
        }

        // ── account / phone / security events ───────────────────────
        "account_alerts"
        | "account_update"
        | "account_review_update"
        | "business_capability_update"
        | "phone_number_quality_update"
        | "phone_number_name_update"
        | "security" => {
            if let Err(err) = state.account.process(project, value, field).await {
                warn!(
                    error = %err,
                    field = field,
                    project_id = %project.id,
                    "account processor failed; routing to DLQ"
                );
                send_to_dlq(state, raw_payload, dlq_reason::PROCESSOR_ERROR_ACCOUNT).await;
            }
        }

        // ── known but out-of-scope for wachat Phase 2 ───────────────
        // `calls` is voice-call telemetry (handled by a separate
        // module in Phase N). `payment_configuration_update` belongs
        // to whatsapp-pay. `feed` belongs to Messenger/Comments.
        // We log + sink to DLQ with reason `unhandled_field` so the
        // payload is preserved and replayable when those modules ship.
        "calls" | "payment_configuration_update" | "feed" => {
            trace!(field = field, project_id = %project.id, "unhandled (out-of-scope) field; sinking to DLQ");
            send_to_dlq(state, raw_payload, dlq_reason::UNHANDLED_FIELD).await;
        }

        // ── unknown field — log + DLQ ───────────────────────────────
        unknown => {
            warn!(
                field = unknown,
                project_id = %project.id,
                "unknown webhook field; sinking to DLQ"
            );
            send_to_dlq(state, raw_payload, dlq_reason::UNKNOWN_FIELD).await;
        }
    }

    Ok(())
}

/// Sub-dispatcher for `field == "messages"`. A single `change.value` can
/// carry both inbound user messages and outbound delivery status updates;
/// we run them in independent sequences but in the documented causality
/// order.
async fn dispatch_messages(
    state: &WebhookState,
    project: &Project,
    value: &ChangeValue,
    raw_payload: &Bytes,
) {
    // ── inbound chain: inbound.process → contacts.upsert → conversations.on_inbound ──
    let has_inbound = value.messages.as_ref().is_some_and(|m| !m.is_empty());
    if has_inbound {
        if let Err(err) = state.inbound.process(project, value).await {
            warn!(
                error = %err,
                project_id = %project.id,
                "inbound processor failed; routing to DLQ and skipping dependents"
            );
            send_to_dlq(state, raw_payload, dlq_reason::PROCESSOR_ERROR_INBOUND).await;
        } else {
            // TODO(phase-sabflow): trigger flows after inbound processing.
            // The receiver records inbound messages today; flow-builder
            // execution against the new inbound is owned by a future phase.
            if let Err(err) = state.contacts.upsert_from_inbound(project, value).await {
                warn!(
                    error = %err,
                    project_id = %project.id,
                    "contacts upsert failed; routing to DLQ"
                );
                send_to_dlq(state, raw_payload, dlq_reason::PROCESSOR_ERROR_CONTACTS).await;
            }
            if let Err(err) = state.conversations.on_inbound(project, value).await {
                warn!(
                    error = %err,
                    project_id = %project.id,
                    "conversation tracker (inbound) failed; routing to DLQ"
                );
                send_to_dlq(
                    state,
                    raw_payload,
                    dlq_reason::PROCESSOR_ERROR_CONVERSATIONS_INBOUND,
                )
                .await;
            }
        }
    }

    // ── status chain: status.process → conversations.on_status ──
    let has_statuses = value.statuses.as_ref().is_some_and(|s| !s.is_empty());
    if has_statuses {
        if let Err(err) = state.status.process(project, value).await {
            warn!(
                error = %err,
                project_id = %project.id,
                "status processor failed; routing to DLQ and skipping dependents"
            );
            send_to_dlq(state, raw_payload, dlq_reason::PROCESSOR_ERROR_STATUS).await;
        } else if let Err(err) = state.conversations.on_status(project, value).await {
            warn!(
                error = %err,
                project_id = %project.id,
                "conversation tracker (status) failed; routing to DLQ"
            );
            send_to_dlq(
                state,
                raw_payload,
                dlq_reason::PROCESSOR_ERROR_CONVERSATIONS_STATUS,
            )
            .await;
        }
    }
}

/// Forward the original raw payload to the DLQ with a reason string.
///
/// DLQ writes are themselves fallible (Redis hiccup, queue full, etc.).
/// We log a tracing error if the DLQ write fails — but we **must not**
/// propagate, because the receiver always 200s back to Meta.
async fn send_to_dlq(state: &WebhookState, raw_payload: &Bytes, reason: &str) {
    if let Err(err) = state.dlq.send_to_dlq(raw_payload.clone(), reason).await {
        tracing::error!(
            error = %err,
            reason = reason,
            "DLQ write failed — payload not preserved; manual replay required"
        );
    }
}
