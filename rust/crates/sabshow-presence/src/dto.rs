//! Request / response DTOs for the SabShow presence HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::SabshowPresence;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceListQuery {
    pub deck_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatInput {
    pub deck_id: String,
    pub slide_id: String,
    #[serde(default)]
    pub cursor_x: Option<f64>,
    #[serde(default)]
    pub cursor_y: Option<f64>,
    #[serde(default)]
    pub selected_element_id: Option<String>,
    /// Stable per-session color. The client picks once and sends it
    /// with every heartbeat; the server just persists what it gets.
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceListResponse {
    pub items: Vec<SabshowPresence>,
}
