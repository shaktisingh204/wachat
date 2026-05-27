//! On-disk shape of a `sabshow_publications` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PublicationStatus {
    Live,
    Paused,
}

impl Default for PublicationStatus {
    fn default() -> Self {
        PublicationStatus::Live
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowPublication {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,

    /// Owner — same as `sabshow_decks.ownerUserId` at publish time.
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    /// URL slug used by the public route
    /// (`/present/{publishSlug}`). Globally unique across SabShow.
    pub slug: String,

    /// The snapshotted deck version (`sabshow_versions.version`) that
    /// the public route renders.
    pub published_version: u32,

    /// Optional pinned theme override at publish time. When null the
    /// deck's live theme is used.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<JsonValue>,

    #[serde(default)]
    pub status: PublicationStatus,

    /// Per-publication custom CSS injected after the SabShow defaults.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,

    /// Optional cover image (SabFiles ref) — surfaces in OG metadata.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_file_id: Option<String>,

    #[serde(rename = "publishedAt")]
    pub published_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn publication_round_trips() {
        let p = SabshowPublication {
            id: None,
            deck_id: ObjectId::new(),
            owner_user_id: ObjectId::new(),
            slug: "q1-pitch".into(),
            published_version: 3,
            theme_json: None,
            status: PublicationStatus::Live,
            custom_css: None,
            cover_file_id: None,
            published_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let j = serde_json::to_string(&p).unwrap();
        assert!(j.contains("\"status\":\"live\""));
        let _back: SabshowPublication = serde_json::from_str(&j).unwrap();
    }
}
