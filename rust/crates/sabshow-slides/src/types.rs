//! On-disk shape of a `sabshow_slides` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SlideLayoutKind {
    Title,
    Content,
    TwoColumn,
    Image,
    Chart,
    Blank,
    SectionHeader,
}

impl Default for SlideLayoutKind {
    fn default() -> Self {
        SlideLayoutKind::Blank
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowSlide {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,

    /// User who created the slide. Editors who are not the deck owner
    /// (shared editors) may write slides; ownership of the slide row is
    /// tracked for audit.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// 0-indexed position within the parent deck.
    pub position: u32,

    #[serde(default)]
    pub layout_kind: SlideLayoutKind,

    /// Background config — color, image-fileId, gradient, etc.
    /// Free-form JSON so the renderer can iterate.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_json: Option<JsonValue>,

    /// Speaker notes (Markdown).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// Optional title — denormalised so the slide-thumbnails sidebar can
    /// render without loading every element row.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// Optional thumbnail snapshot (SabFiles ref) for the sidebar.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_file_id: Option<String>,

    /// If `true`, the slide is hidden in present mode.
    #[serde(default)]
    pub hidden: bool,

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
    fn slide_round_trips() {
        let s = SabshowSlide {
            id: None,
            deck_id: ObjectId::new(),
            user_id: ObjectId::new(),
            position: 0,
            layout_kind: SlideLayoutKind::TwoColumn,
            background_json: None,
            notes: Some("hello".to_owned()),
            title: Some("Slide 1".to_owned()),
            thumbnail_file_id: None,
            hidden: false,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let j = serde_json::to_string(&s).unwrap();
        assert!(j.contains("\"layoutKind\":\"two_column\""));
        let _back: SabshowSlide = serde_json::from_str(&j).unwrap();
    }
}
