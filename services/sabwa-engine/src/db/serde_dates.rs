//! Shared serde helpers for `chrono::DateTime<Utc>` ↔ BSON `DateTime`.
//!
//! ## Why this exists
//!
//! By default, `chrono::DateTime<Utc>` serialises through serde as an **RFC
//! 3339 string** (`"2025-05-15T12:34:56Z"`). That's fine for JSON but
//! disastrous for Mongo: any update path that writes `Bson::DateTime(...)`
//! directly in a `$set` (which most of our route/worker code does for
//! `updatedAt` / `lastUsedAt` / `sentAt` etc.) produces rows where the
//! same logical field oscillates between BSON Date and BSON String types
//! depending on which code path last touched it.
//!
//! Two pathologies follow:
//!
//! 1. The typed deserialiser pukes (`invalid type: map, expected an RFC 3339
//!    formatted date and time string`) the first time it sees a Date-shaped
//!    row, silently dropping documents from `find` results. This was the
//!    "0 accounts" bug on `sabwa_sessions`.
//! 2. Range queries like `{ ts: { $gte: ISODate(...) } }` never match the
//!    string-shaped rows, so audit filters / "find due" scans silently
//!    return empty sets.
//!
//! The helpers in this module normalise both directions:
//!
//! * **Serialise** → always as `bson::DateTime` (canonical BSON Date).
//! * **Deserialise** → tolerant: accept BSON Date, RFC 3339 string, or
//!   Int64 millis, so legacy rows continue to load.
//!
//! ## Usage
//!
//! Annotate every `DateTime<Utc>` field in a Mongo-backed struct:
//!
//! ```ignore
//! use chrono::{DateTime, Utc};
//! use serde::{Deserialize, Serialize};
//!
//! #[derive(Serialize, Deserialize)]
//! struct Row {
//!     #[serde(with = "crate::db::serde_dates::chrono_dt")]
//!     created_at: DateTime<Utc>,
//!
//!     #[serde(
//!         default,
//!         skip_serializing_if = "Option::is_none",
//!         with = "crate::db::serde_dates::chrono_dt_opt"
//!     )]
//!     last_seen_at: Option<DateTime<Utc>>,
//! }
//! ```

use chrono::{DateTime, Utc};

/// Coerce any `bson::Bson` value into `chrono::DateTime<Utc>`.
///
/// Accepts the canonical `Bson::DateTime`, legacy RFC 3339 `Bson::String`
/// rows emitted by earlier engine versions, and `Bson::Int64` milliseconds.
/// Anything else returns an error string suitable for `serde::de::Error::custom`.
pub fn bson_to_chrono(b: bson::Bson) -> Result<DateTime<Utc>, String> {
    match b {
        bson::Bson::DateTime(d) => Ok(d.to_chrono()),
        bson::Bson::String(s) => chrono::DateTime::parse_from_rfc3339(&s)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| format!("invalid RFC 3339 datetime string: {e}")),
        bson::Bson::Int64(ms) => Ok(bson::DateTime::from_millis(ms).to_chrono()),
        other => Err(format!(
            "expected BSON DateTime or RFC 3339 string, got {:?}",
            other.element_type()
        )),
    }
}

/// Serde adapter for required `DateTime<Utc>` fields.
///
/// Writes always emit a `bson::DateTime`; reads tolerate any of the legacy
/// shapes via [`bson_to_chrono`].
pub mod chrono_dt {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(
        value: &DateTime<Utc>,
        s: S,
    ) -> Result<S::Ok, S::Error> {
        bson::DateTime::from_chrono(*value).serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<DateTime<Utc>, D::Error> {
        let raw = bson::Bson::deserialize(d)?;
        super::bson_to_chrono(raw).map_err(serde::de::Error::custom)
    }
}

/// Serde adapter for `Option<DateTime<Utc>>` fields.
///
/// `None` and `Bson::Null` round-trip cleanly; `Some(...)` serialises as
/// `bson::DateTime`. Combine with `#[serde(default, skip_serializing_if =
/// "Option::is_none")]` so the field is omitted entirely when absent.
pub mod chrono_dt_opt {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(
        value: &Option<DateTime<Utc>>,
        s: S,
    ) -> Result<S::Ok, S::Error> {
        match value {
            Some(v) => bson::DateTime::from_chrono(*v).serialize(s),
            None => s.serialize_none(),
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(
        d: D,
    ) -> Result<Option<DateTime<Utc>>, D::Error> {
        let opt: Option<bson::Bson> = Option::deserialize(d)?;
        match opt {
            None | Some(bson::Bson::Null) => Ok(None),
            Some(b) => super::bson_to_chrono(b)
                .map(Some)
                .map_err(serde::de::Error::custom),
        }
    }
}
