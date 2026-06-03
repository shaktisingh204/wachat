//! Request DTOs for sabcheckout-taxes.

use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::types::SabcheckoutTax;

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
pub struct CreateSabcheckoutTaxInput {
    pub name: String,
    pub rate_percent: f64,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabcheckoutTaxInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub rate_percent: Option<f64>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

impl UpdateSabcheckoutTaxInput {
    pub fn into_update_doc(self) -> Document {
        let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
        if let Some(v) = self.name {
            set.insert("name", v);
        }
        if let Some(v) = self.rate_percent {
            set.insert("ratePercent", v);
        }
        if let Some(v) = self.country {
            set.insert("country", v);
        }
        if let Some(v) = self.state {
            set.insert("state", v);
        }
        if let Some(v) = self.status {
            set.insert("status", v);
        }
        doc! { "$set": set }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabcheckoutTaxResponse {
    pub id: String,
    pub entity: SabcheckoutTax,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabcheckoutTaxResponse {
    pub deleted: bool,
}
