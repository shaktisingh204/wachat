//! Request / response DTOs for the SabShow slides HTTP surface.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::{SabshowSlide, SlideLayoutKind};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSlidesQuery {
    /// Required — only list slides for one deck at a time.
    pub deck_id: String,
    #[serde(default)]
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlideInput {
    pub deck_id: String,
    /// 0-indexed insert position. If omitted, append to the end.
    #[serde(default)]
    pub position: Option<u32>,
    #[serde(default)]
    pub layout_kind: Option<SlideLayoutKind>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub background_json: Option<JsonValue>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSlideInput {
    #[serde(default)]
    pub layout_kind: Option<SlideLayoutKind>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub background_json: Option<JsonValue>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub thumbnail_file_id: Option<String>,
    #[serde(default)]
    pub hidden: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderSlideInput {
    pub new_position: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideEnvelope {
    pub slide: SabshowSlide,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideListResponse {
    pub items: Vec<SabshowSlide>,
}
