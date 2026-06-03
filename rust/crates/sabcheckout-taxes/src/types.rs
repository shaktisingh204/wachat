//! On-disk shape of a `sabcheckout_taxes` document.

use crate::dto::CreateSabcheckoutTaxInput;
use bson::{DateTime as BsonDateTime, oid::ObjectId};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutTax {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub rate_percent: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "active".to_owned()
}

impl SabcheckoutTax {
    pub fn from_input(input: CreateSabcheckoutTaxInput, user_id: ObjectId) -> Self {
        Self {
            id: None,
            user_id,
            name: input.name,
            rate_percent: input.rate_percent,
            country: input.country,
            state: input.state,
            status: input.status.unwrap_or_else(|| "active".to_owned()),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        }
    }
}
