//! DTOs for the sabwebinar-analytics HTTP surface.

use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsQuery {
    pub webinar_id: String,
}
