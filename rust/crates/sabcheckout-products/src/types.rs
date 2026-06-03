//! On-disk shape of a `sabcheckout_products` document.

use crate::dto::CreateSabcheckoutProductInput;
use bson::{DateTime as BsonDateTime, oid::ObjectId};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutProduct {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub amount_minor: i64,
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "draft".to_owned()
}

impl SabcheckoutProduct {
    pub fn from_input(input: CreateSabcheckoutProductInput, user_id: ObjectId) -> Self {
        Self {
            id: None,
            user_id,
            name: input.name,
            amount_minor: input.amount_minor,
            currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
            description: input.description,
            status: input.status.unwrap_or_else(|| "draft".to_owned()),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        }
    }
}
