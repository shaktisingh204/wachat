//! On-disk shape of a `sabshow_themes` document.
//!
//! A Theme is the visual identity layer applied across a Deck: palette,
//! fonts, header/footer template, and master slide layouts (the
//! per-`SlideLayoutKind` defaults).

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowTheme {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner. `null` for system-provided built-in themes that every
    /// tenant can read.
    #[serde(
        rename = "userId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub user_id: Option<ObjectId>,

    pub name: String,

    /// Free-form config:
    /// `{ palette: { primary, secondary, accent, bg, fg, … },
    ///    fonts:   { heading, body, mono },
    ///    header:  {...}, footer: {...},
    ///    master:  { title: {...}, content: {...}, … } }`
    #[serde(default)]
    pub config_json: JsonValue,

    /// Optional preview image (SabFiles ref) used in the picker.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_file_id: Option<String>,

    /// `true` for SabShow-provided themes available to every tenant.
    #[serde(default)]
    pub built_in: bool,

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
    fn theme_round_trips() {
        let t = SabshowTheme {
            id: None,
            user_id: Some(ObjectId::new()),
            name: "Editorial".to_owned(),
            config_json: serde_json::json!({ "palette": { "primary": "#222" } }),
            preview_file_id: None,
            built_in: false,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let j = serde_json::to_string(&t).unwrap();
        assert!(j.contains("\"builtIn\":false"));
        let _back: SabshowTheme = serde_json::from_str(&j).unwrap();
    }
}
