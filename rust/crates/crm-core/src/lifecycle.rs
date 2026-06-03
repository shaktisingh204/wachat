//! `status`, `priority`, `archived`, `deletedAt` — per-document
//! lifecycle state.
//!
//! `Status` is intentionally a transparent string newtype so each entity
//! type can define its own state machine without churning this crate
//! (e.g. invoice statuses ≠ ticket statuses ≠ lead statuses). `Priority`
//! is a closed enum because the four-bucket vocabulary is universal.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    #[default]
    Medium,
    High,
    Critical,
}

/// Free-form status string. Entity-specific state machines pick their
/// own vocabulary and document the legal transitions in their own crate.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Status(pub String);

impl Status {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: Into<String>> From<S> for Status {
    fn from(s: S) -> Self {
        Self(s.into())
    }
}

/// Soft-delete fragment. Hard deletes never occur in the CRM — every
/// "delete" UI sets `archived = true`; an admin "purge" job stamps
/// `deletedAt` and a sweeper later removes the row.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDelete {
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub deleted_at: Option<DateTime<Utc>>,
}

fn is_false(b: &bool) -> bool {
    !*b
}

/// Composite lifecycle fragment: status + priority + soft-delete.
/// Each is optional so an entity can opt in granularly via flatten —
/// e.g. a Ticket flattens the whole `Lifecycle`, but a Tag (which has
/// no priority) can opt to flatten only `SoftDelete`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lifecycle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(flatten)]
    pub soft_delete: SoftDelete,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_serializes_lowercase() {
        let json = serde_json::to_string(&Priority::Critical).unwrap();
        assert_eq!(json, "\"critical\"");
    }

    #[test]
    fn soft_delete_skips_default_archived() {
        let s = SoftDelete::default();
        let json = serde_json::to_value(&s).unwrap();
        assert!(json.get("archived").is_none());
        assert!(json.get("deletedAt").is_none());
    }

    #[test]
    fn lifecycle_round_trips_status_string() {
        let l = Lifecycle {
            status: Some(Status::new("draft")),
            priority: Some(Priority::High),
            soft_delete: SoftDelete::default(),
        };
        let json = serde_json::to_value(&l).unwrap();
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("draft"));
        assert_eq!(json.get("priority").and_then(|v| v.as_str()), Some("high"));
    }
}
