//! Request / response DTOs for sabwriter-presence.

use serde::{Deserialize, Serialize};

use crate::types::{PresenceCursor, SabwriterPresence};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub document_id: String,
    /// Stale-cutoff in seconds. Rows older than `lastSeenAt - cutoff`
    /// are filtered out. Defaults to 60s.
    #[serde(default)]
    pub cutoff_seconds: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatInput {
    pub document_id: String,
    #[serde(default)]
    pub cursor: Option<PresenceCursor>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceListResponse {
    pub items: Vec<SabwriterPresence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatResponse {
    pub ok: bool,
}
