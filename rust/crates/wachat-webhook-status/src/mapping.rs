//! Meta status string ⇄ domain enum mapping, plus the legal status
//! transition table used to make updates idempotent.
//!
//! Meta sends one of four lifecycle strings on a status update:
//! `"sent" | "delivered" | "read" | "failed"`. The TS stores those values
//! verbatim on the message document (`status: status.status`); we map to
//! the typed [`MessageStatus`] enum here so callers don't pass raw
//! strings around.
//!
//! ## Why a transition table?
//!
//! Webhooks are unordered and retried. Without guarding the update we'd
//! happily clobber `read` back to `delivered` if a delayed `delivered`
//! event arrived after a `read`. The TS handles this for the broadcast
//! collection (see the `statusHierarchy` map at line ~1761 of
//! `webhook-processor.ts`) but **not** for `outgoing_messages` — its
//! bulk update is unconditional. We tighten that here without changing
//! the wire fields, by adding a `status: { $in: [<allowed-prev>] }`
//! clause to the filter. If no document matches, the update is a no-op.

use wachat_types::message::MessageStatus;

/// Lossless mapping from Meta's wire status string to our domain enum.
///
/// Returns `None` for unknown values so the caller can `tracing::warn!`
/// and skip the update — Meta has historically added new lifecycle states
/// (e.g. `deleted`) without prior notice and we don't want a typo to fail
/// the whole batch.
pub fn meta_status_to_domain(s: &str) -> Option<MessageStatus> {
    // ASCII-fold so a future Meta sender that uppercases a value still
    // routes correctly (`SENT`, `Delivered`, etc.). Their docs specify
    // lowercase but we've seen mixed-case in the wild on edge events.
    match s.to_ascii_lowercase().as_str() {
        "sent" => Some(MessageStatus::Sent),
        "delivered" => Some(MessageStatus::Delivered),
        "read" => Some(MessageStatus::Read),
        "failed" => Some(MessageStatus::Failed),
        // `pending` only ever exists as our own internal pre-send state;
        // Meta will never send it, so we deliberately do not map it here.
        _ => None,
    }
}

/// Allowed status transitions for the conditional update.
///
/// Read as: "if the **incoming** status is `entry.0`, the **current**
/// status on the document must be one of `entry.1` for the update to apply."
///
/// The TS broadcast hierarchy (PENDING < SENT < DELIVERED < READ; FAILED
/// is terminal) is the same model we encode here. `pending` is the only
/// state that accepts every transition — it's our seed state.
///
/// Rationale per row:
/// - `sent`     ← only from `pending` (Meta-acked the send for the first time).
/// - `delivered`← from `pending` or `sent` (catch up if `sent` was missed).
/// - `read`     ← from `pending`, `sent`, or `delivered` (catch up if missed).
/// - `failed`   ← from `pending` or `sent`. We do **not** allow a delivered
///                /read message to flip to failed — Meta has been observed to
///                send late `failed` events for already-delivered messages
///                during outage post-mortems and clobbering would mislead
///                the chat UI.
pub const VALID_STATUS_TRANSITIONS: &[(&str, &[&str])] = &[
    ("sent", &["pending"]),
    ("delivered", &["pending", "sent"]),
    ("read", &["pending", "sent", "delivered"]),
    ("failed", &["pending", "sent"]),
];

/// Look up the allowed previous statuses for an incoming `new_status`.
/// Returns an empty slice for unknown statuses (caller should already have
/// rejected those via [`meta_status_to_domain`]).
pub fn allowed_previous_statuses(new_status: &str) -> &'static [&'static str] {
    let needle = new_status.to_ascii_lowercase();
    for (k, v) in VALID_STATUS_TRANSITIONS {
        if *k == needle.as_str() {
            return v;
        }
    }
    &[]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_statuses() {
        assert_eq!(meta_status_to_domain("sent"), Some(MessageStatus::Sent));
        assert_eq!(
            meta_status_to_domain("delivered"),
            Some(MessageStatus::Delivered)
        );
        assert_eq!(meta_status_to_domain("read"), Some(MessageStatus::Read));
        assert_eq!(meta_status_to_domain("failed"), Some(MessageStatus::Failed));
    }

    #[test]
    fn case_insensitive() {
        assert_eq!(meta_status_to_domain("SENT"), Some(MessageStatus::Sent));
        assert_eq!(meta_status_to_domain("Read"), Some(MessageStatus::Read));
    }

    #[test]
    fn rejects_unknown() {
        assert_eq!(meta_status_to_domain("pending"), None);
        assert_eq!(meta_status_to_domain("deleted"), None);
        assert_eq!(meta_status_to_domain(""), None);
    }

    #[test]
    fn transitions_cover_all_meta_statuses() {
        for s in ["sent", "delivered", "read", "failed"] {
            assert!(
                !allowed_previous_statuses(s).is_empty(),
                "no transition row for `{s}`"
            );
        }
    }
}
