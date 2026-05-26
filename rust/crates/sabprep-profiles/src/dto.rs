//! Request / response DTOs.

use sabprep_steps::Row;
use serde::{Deserialize, Serialize};

use crate::types::SabprepProfile;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub dataset_id: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileInput {
    /// Profile a stored dataset by id. Either this or `rows` must be set.
    #[serde(default)]
    pub dataset_id: Option<String>,
    /// Profile rows in-band (handy for CSV upload preview before persist).
    #[serde(default)]
    pub rows: Option<Vec<Row>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeProfileInput {
    pub rows: Vec<Row>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabprepProfile>,
}
