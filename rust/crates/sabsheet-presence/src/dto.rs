//! Request / response DTOs for SabSheet presence.

use serde::{Deserialize, Serialize};

use crate::types::{PresenceSelection, SabsheetPresence};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
    #[serde(default)]
    pub sheet_id: Option<String>,
    /// Filter to entries seen within `withinSecs` seconds. Default: 30.
    #[serde(default)]
    pub within_secs: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPresenceInput {
    pub sheet_id: String,
    pub workbook_id: String,
    pub selection: PresenceSelection,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetPresence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPresenceResponse {
    pub ok: bool,
}
