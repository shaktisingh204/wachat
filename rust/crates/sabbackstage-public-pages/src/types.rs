//! On-disk shape of a `sabbackstage_public_pages` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `"draft"` | `"live"` | `"paused"`.
pub type PublicPageStatusStr = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbackstagePublicPage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Host event in `crm_events`.
    pub event_id: ObjectId,

    /// URL slug rendered under `/event/[pageSlug]`. Unique per user.
    pub slug: String,
    pub headline: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Free-form theme JSON (background, accent, fonts, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<bson::Document>,
    /// SabFiles file id for the hero image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hero_image_file_id: Option<String>,

    /// `"draft"` | `"live"` | `"paused"`.
    #[serde(default = "default_status")]
    pub status: PublicPageStatusStr,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "draft".to_owned()
}
