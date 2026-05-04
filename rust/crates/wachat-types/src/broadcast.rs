//! Mirrors `BroadcastJob` from `src/lib/definitions.ts` (line ~2469) and
//! the runtime shape written by `src/app/actions/broadcast.actions.ts` into
//! the `broadcasts` Mongo collection.
//!
//! The TS type carries a long tail of UI/worker fields (file name, audience
//! type, variable mappings, flow config, etc.). We model the **handler-facing
//! subset** here — the fields a Rust worker or read API actually reasons
//! about. Callers that need the long tail (CSV path, MPS, header media id,
//! flow config) can extend a richer struct in their own crate.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Broadcast lifecycle.
///
/// Terminology note: the TS uses a slightly inconsistent set of strings
/// (`"DRAFT" | "QUEUED" | "PENDING_PROCESSING" | "PROCESSING" | "Completed"
/// | "Partial Failure" | "Failed" | "Cancelled"`). Our Rust enum collapses
/// `PENDING_PROCESSING` and `PROCESSING` into `Sending`, drops the
/// `Partial Failure` distinction (callers can derive it from
/// `failed_count > 0 && sent_count > 0`), and renames `Cancelled` to
/// `Paused` per the slice spec. Migrations to this enum should map old
/// rows accordingly. Wire format is `SCREAMING_SNAKE_CASE`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BroadcastStatus {
    Draft,
    Queued,
    Sending,
    Paused,
    Completed,
    Failed,
}

/// A broadcast job — one "send template X to N recipients" unit of work.
///
/// Mongo collection: `broadcasts`. Per-recipient attempts are tracked
/// separately in `broadcast_contacts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Broadcast {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project.
    pub project_id: ObjectId,

    /// The template being sent. Required because every broadcast in the
    /// wachat product is template-driven (Meta forbids non-template
    /// broadcasts outside the 24h session window).
    pub template_id: ObjectId,

    pub status: BroadcastStatus,

    /// Total recipients enqueued. `u64` because broadcasts can run into the
    /// millions; `i32` would not be safe.
    pub recipient_count: u64,

    /// How many recipients have been successfully sent (Meta accepted).
    pub sent_count: u64,

    /// How many recipients failed (Meta rejected or worker gave up).
    pub failed_count: u64,

    /// Messages-per-second cap requested for this broadcast. `u32` —
    /// throughput far above 4 billion/s is not a thing on the wachat path.
    pub mps: u32,

    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}
