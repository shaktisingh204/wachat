use serde::{Deserialize, Serialize};

use crate::types::AdGroupMember;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub domain_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAdGroupInput {
    pub domain_id: String,
    pub name: String,
    pub kind: String,
    #[serde(default)]
    pub members: Vec<AdGroupMember>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAdGroupResponse {
    pub id: String,
    pub entity: crate::types::SabopsAdGroup,
}
