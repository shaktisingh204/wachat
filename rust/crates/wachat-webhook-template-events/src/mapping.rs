//! Pure mapping: Meta `event` strings → `TemplateStatus` enum.
//!
//! Meta's `message_template_status_update.event` is one of
//! `APPROVED | REJECTED | PENDING | DISABLED | PAUSED | FLAGGED`.
//! Our `TemplateStatus` enum has no `Flagged` variant — flagged templates
//! are *paused* on Meta's side and the SabNode UI surfaces the flag via a
//! separate `flagged: true` field stored on the template document. The
//! processor sets that field whenever this function maps `FLAGGED → Paused`.
//!
//! Returning `Option<TemplateStatus>` (rather than defaulting to `Pending`)
//! keeps the unknown-event path explicit: the processor logs a warning and
//! still writes to the `template_events` audit collection so we don't lose
//! visibility on a Meta enum we haven't seen yet.

use wachat_types::template::TemplateStatus;

/// Map a Meta event string (case-insensitive) to a [`TemplateStatus`].
///
/// Returns `None` for unknown values so the caller can decide between
/// audit-only logging and a hard error. `FLAGGED` maps to
/// [`TemplateStatus::Paused`] because Meta pauses flagged templates from
/// being sent — the `flagged: true` flag is set separately by the processor.
pub fn meta_event_to_status(event: &str) -> Option<TemplateStatus> {
    match event.trim().to_ascii_uppercase().as_str() {
        "APPROVED" => Some(TemplateStatus::Approved),
        "REJECTED" => Some(TemplateStatus::Rejected),
        "PENDING" => Some(TemplateStatus::Pending),
        "DISABLED" => Some(TemplateStatus::Disabled),
        "PAUSED" => Some(TemplateStatus::Paused),
        // FLAGGED has no dedicated variant — Meta pauses flagged templates,
        // and the processor records the flag in a separate `flagged` field.
        "FLAGGED" => Some(TemplateStatus::Paused),
        _ => None,
    }
}

/// Returns `true` if a `FLAGGED` event should additionally set the
/// `flagged: true` field. Kept as a tiny helper so the processor doesn't
/// need to re-uppercase the string.
pub fn is_flagged_event(event: &str) -> bool {
    event.trim().eq_ignore_ascii_case("FLAGGED")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_all_five_known_statuses() {
        assert_eq!(
            meta_event_to_status("APPROVED"),
            Some(TemplateStatus::Approved)
        );
        assert_eq!(
            meta_event_to_status("REJECTED"),
            Some(TemplateStatus::Rejected)
        );
        assert_eq!(
            meta_event_to_status("PENDING"),
            Some(TemplateStatus::Pending)
        );
        assert_eq!(
            meta_event_to_status("DISABLED"),
            Some(TemplateStatus::Disabled)
        );
        assert_eq!(meta_event_to_status("PAUSED"), Some(TemplateStatus::Paused));
    }

    #[test]
    fn flagged_maps_to_paused() {
        assert_eq!(
            meta_event_to_status("FLAGGED"),
            Some(TemplateStatus::Paused)
        );
        assert!(is_flagged_event("FLAGGED"));
        assert!(is_flagged_event("flagged"));
        assert!(!is_flagged_event("PAUSED"));
    }

    #[test]
    fn case_insensitive_and_trim() {
        assert_eq!(
            meta_event_to_status("approved"),
            Some(TemplateStatus::Approved)
        );
        assert_eq!(
            meta_event_to_status("  Rejected  "),
            Some(TemplateStatus::Rejected)
        );
    }

    #[test]
    fn unknown_event_returns_none() {
        assert_eq!(meta_event_to_status("REVIEW_PENDING"), None);
        assert_eq!(meta_event_to_status(""), None);
        assert_eq!(meta_event_to_status("APPROVED_BUT_NEW"), None);
    }
}
