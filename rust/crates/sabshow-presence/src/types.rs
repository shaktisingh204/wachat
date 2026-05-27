//! On-disk shape of a `sabshow_presence` document.
//!
//! Presence is ephemeral — rows live only as long as a co-editor is in
//! the deck. The Mongo collection is provisioned with a TTL index on
//! `lastSeenAt` (TTL ~30s) so abandoned cursors auto-expire without an
//! explicit `disconnect`.
//!
//! NOTE: index creation is handled by the integrator (the api crate's
//! Mongo bootstrap) — this crate only writes the documents.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceCursor {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowPresence {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,
    /// Currently-focused slide (a user may switch slides during a session).
    #[serde(rename = "slideId")]
    pub slide_id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Live cursor position in deck-relative canvas coordinates.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<PresenceCursor>,

    /// Stable per-session display color (hex, e.g. "#22c55e").
    pub color: String,

    /// Optional currently-selected element on the focused slide.
    #[serde(
        rename = "selectedElementId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub selected_element_id: Option<ObjectId>,

    /// Last heartbeat. TTL index expires rows ~30s after this.
    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: BsonDateTime,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn presence_round_trips() {
        let p = SabshowPresence {
            id: None,
            deck_id: ObjectId::new(),
            slide_id: ObjectId::new(),
            user_id: ObjectId::new(),
            cursor: Some(PresenceCursor { x: 10.0, y: 20.0 }),
            color: "#22c55e".into(),
            selected_element_id: None,
            last_seen_at: BsonDateTime::from_chrono(Utc::now()),
        };
        let j = serde_json::to_string(&p).unwrap();
        assert!(j.contains("lastSeenAt"));
        let _back: SabshowPresence = serde_json::from_str(&j).unwrap();
    }
}
