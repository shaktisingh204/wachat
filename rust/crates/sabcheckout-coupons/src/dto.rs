//! Request DTOs for sabcheckout-coupons.

use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::types::SabcheckoutCoupon;

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
pub struct CreateSabcheckoutCouponInput {
    pub code: String,
    pub discount_type: String,
    pub discount_value: i64,
    #[serde(default)]
    pub max_uses: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSabcheckoutCouponInput {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub discount_type: Option<String>,
    #[serde(default)]
    pub discount_value: Option<i64>,
    #[serde(default)]
    pub max_uses: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

impl UpdateSabcheckoutCouponInput {
    pub fn into_update_doc(self) -> Document {
        let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
        if let Some(v) = self.code {
            set.insert("code", v);
        }
        if let Some(v) = self.discount_type {
            set.insert("discountType", v);
        }
        if let Some(v) = self.discount_value {
            set.insert("discountValue", v);
        }
        if let Some(v) = self.max_uses {
            set.insert("maxUses", v);
        }
        if let Some(v) = self.status {
            set.insert("status", v);
        }
        doc! { "$set": set }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSabcheckoutCouponResponse {
    pub id: String,
    pub entity: SabcheckoutCoupon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSabcheckoutCouponResponse {
    pub deleted: bool,
}
