//! On-disk shape of a `sabwebinar_webinars` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

/// Landing-page theme tokens (colors + typography hints).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct LandingTheme {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_headline: Option<String>,
    /// Optional CTA label override (default "Register").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cta_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_bio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Webinar {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Public URL slug — `/webinar/[slug]`. Unique per deployment.
    pub slug: String,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub host_user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scheduled_start: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    /// `"draft"` | `"scheduled"` | `"live"` | `"ended"` | `"cancelled"`.
    pub status: String,

    /// Landing-page theme JSON (colors, headline, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub landing_theme: Option<LandingTheme>,

    /// SabFiles file id for the hero image. NEVER a free-text URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hero_file_id: Option<String>,

    /// SabFiles file id for the post-event recording.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recording_file_id: Option<String>,

    /// If `true`, the public landing page collects registrations before
    /// granting the live URL.
    #[serde(default, skip_serializing_if = "is_false")]
    pub require_registration: bool,

    /// Max registrations / concurrent viewers. `None` = unlimited.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity: Option<u32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
