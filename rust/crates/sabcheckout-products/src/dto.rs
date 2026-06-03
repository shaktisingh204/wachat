//! Request DTOs for sabcheckout-products.

use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::types::SabcheckoutProduct;

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
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabcheckoutProductInput {
    pub name: String,
    pub amount_minor: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabcheckoutProductInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub amount_minor: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

impl UpdateSabcheckoutProductInput {
    pub fn into_update_doc(self) -> Document {
        let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
        if let Some(v) = self.name {
            set.insert("name", v);
        }
        if let Some(v) = self.amount_minor {
            set.insert("amountMinor", v);
        }
        if let Some(v) = self.currency {
            set.insert("currency", v);
        }
        if let Some(v) = self.description {
            set.insert("description", v);
        }
        if let Some(v) = self.status {
            set.insert("status", v);
        }
        doc! { "$set": set }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabcheckoutProductResponse {
    pub id: String,
    pub entity: SabcheckoutProduct,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabcheckoutProductResponse {
    pub deleted: bool,
}
