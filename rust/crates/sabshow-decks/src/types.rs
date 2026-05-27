//! On-disk shape of a `sabshow_decks` document.
//!
//! A Deck is the root container for a SabShow presentation. Slides,
//! elements, themes, comments, versions, and publications all reference
//! a Deck via `deckId`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DeckStatus {
    Draft,
    Published,
    Archived,
}

impl Default for DeckStatus {
    fn default() -> Self {
        DeckStatus::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowDeck {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner of the deck. All writes scope by this.
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub title: String,

    /// Other users this deck has been shared with (read or write).
    /// Reads accept either `ownerUserId == me` OR `me in sharedWithUserIds`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shared_with_user_ids: Vec<ObjectId>,

    /// Embedded theme override (palette / fonts / master). Free-form JSON
    /// so we can iterate the master layout schema without a migration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<JsonValue>,

    /// Reference to a `sabshow_themes` document. When null the deck uses
    /// the embedded `theme_json` or the SabShow default theme.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<ObjectId>,

    #[serde(default)]
    pub status: DeckStatus,

    /// Slide to open by default in the editor / present mode. Optional
    /// because brand-new decks have no slides yet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_slide_id: Option<ObjectId>,

    /// Monotonically increasing version. Bumped on every "save version"
    /// snapshot to `sabshow_versions`.
    #[serde(default)]
    pub version: u32,

    /// Optional cover image (SabFiles ref).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_file_id: Option<String>,

    /// Free-form tags surfaced in the deck list view.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn deck_round_trips() {
        let d = SabshowDeck {
            id: None,
            owner_user_id: ObjectId::new(),
            title: "Q1 Pitch".to_owned(),
            shared_with_user_ids: vec![],
            theme_json: None,
            theme_id: None,
            status: DeckStatus::Draft,
            default_slide_id: None,
            version: 1,
            cover_file_id: None,
            tags: vec!["pitch".to_owned()],
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let s = serde_json::to_string(&d).unwrap();
        assert!(s.contains("ownerUserId"));
        assert!(s.contains("\"status\":\"draft\""));
        let _back: SabshowDeck = serde_json::from_str(&s).unwrap();
    }
}
