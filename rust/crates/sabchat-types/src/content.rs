//! Rich content blocks shared between [`crate::message::SabChatMessage`] and
//! the widget wire format.
//!
//! A message's payload is one [`ContentBlock`]. Cards / carousels / forms are
//! first-class so the widget and the agent inbox render the same shape
//! regardless of channel.

use serde::{Deserialize, Serialize};

/// An attachment hosted in SabFiles (R2). Stored as a stable reference so the
/// underlying URL can rotate without rewriting messages.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    /// SabFiles asset id (string form of the ObjectId).
    pub sabfile_id: String,
    /// Resolved URL at write time (may rotate; treat as a hint).
    pub url: String,
    /// Original file name.
    pub name: String,
    /// MIME type, best effort.
    #[serde(default)]
    pub mime: Option<String>,
    /// Size in bytes, if known.
    #[serde(default)]
    pub size: Option<u64>,
}

/// One content block. Tagged by `kind` on the wire.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Image {
        url: String,
        #[serde(default)]
        alt: Option<String>,
    },
    File {
        attachment: Attachment,
    },
    Voice {
        url: String,
        duration_s: u32,
        #[serde(default)]
        transcript: Option<String>,
    },
    Card {
        title: String,
        #[serde(default)]
        subtitle: Option<String>,
        #[serde(default)]
        image_url: Option<String>,
        #[serde(default)]
        buttons: Vec<CardButton>,
    },
    Carousel {
        cards: Vec<CarouselCard>,
    },
    Form {
        fields: Vec<FormField>,
    },
    Payment {
        currency: String,
        amount_minor: i64,
        link_url: String,
        #[serde(default)]
        provider: Option<String>,
    },
    Location {
        lat: f64,
        lng: f64,
        #[serde(default)]
        label: Option<String>,
    },
    System {
        /// Free-form system note (assignment change, label add, etc.).
        text: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardButton {
    pub label: String,
    /// `link` | `postback` | `phone`.
    pub kind: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CarouselCard {
    pub title: String,
    #[serde(default)]
    pub subtitle: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub buttons: Vec<CardButton>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FormField {
    pub key: String,
    pub label: String,
    /// `text` | `email` | `phone` | `select` | `textarea` | `checkbox`.
    pub kind: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    /// Optional skip-logic: only display this field when another field's
    /// current value matches. Powers CSAT branching (show a different
    /// follow-up question depending on the score). `None` = always shown.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_when: Option<ShowWhen>,
}

/// A simple display condition over another field's current value. Numeric
/// fields are compared via `min`/`max` (inclusive); `eq` matches a string.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShowWhen {
    /// `key` of the field whose value gates this one (e.g. `"score"`).
    pub field: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub eq: Option<String>,
}
