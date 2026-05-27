//! On-disk shape of a `sabshow_elements` document.
//!
//! Every Element is one positioned rectangle on a slide canvas. The
//! kind-specific payload lives in `configJson` so the renderer can iterate
//! the shape (chart type, image fileId, text rich-text JSON, etc.) without
//! a Mongo migration.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ElementKind {
    Text,
    Image,
    Shape,
    Chart,
    Video,
    Code,
}

impl Default for ElementKind {
    fn default() -> Self {
        ElementKind::Text
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowElement {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "slideId")]
    pub slide_id: ObjectId,
    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub kind: ElementKind,

    /// Canvas position — top-left corner in deck-relative units (the
    /// renderer treats these as pixels at 1920x1080, then scales).
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,

    /// Rotation in degrees, clockwise. 0 by default.
    #[serde(default)]
    pub rotation: f64,

    /// Stacking order on the slide. Higher renders above lower.
    #[serde(default)]
    pub z_index: i32,

    /// If `true`, the element is locked and the editor must not move /
    /// resize / delete it without explicit unlock.
    #[serde(default)]
    pub locked: bool,

    /// Kind-specific payload:
    /// - text: `{ "value": "rich-text JSON", "font": "...", ... }`
    /// - image / video: `{ "fileId": "<SabFiles id>", "fit": "cover" }`
    /// - shape: `{ "shape": "rect|ellipse|triangle|arrow", "fill": "#..." }`
    /// - chart: `{ "chartKind": "bar", "data": { ... } }`
    /// - code: `{ "lang": "ts", "value": "..." }`
    #[serde(default)]
    pub config_json: JsonValue,

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
    fn element_round_trips() {
        let e = SabshowElement {
            id: None,
            slide_id: ObjectId::new(),
            deck_id: ObjectId::new(),
            user_id: ObjectId::new(),
            kind: ElementKind::Text,
            x: 10.0,
            y: 20.0,
            w: 300.0,
            h: 80.0,
            rotation: 0.0,
            z_index: 1,
            locked: false,
            config_json: serde_json::json!({ "value": "hello" }),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let j = serde_json::to_string(&e).unwrap();
        assert!(j.contains("\"kind\":\"text\""));
        let _back: SabshowElement = serde_json::from_str(&j).unwrap();
    }
}
