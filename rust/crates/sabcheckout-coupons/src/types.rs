//! On-disk shape of a `sabcheckout_coupons` document.

use crate::dto::CreateSabcheckoutCouponInput;
use bson::{DateTime as BsonDateTime, oid::ObjectId};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutCoupon {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub code: String,
    pub discount_type: String,
    pub discount_value: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_uses: Option<i32>,
    pub uses: i32,
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

impl SabcheckoutCoupon {
    pub fn from_input(input: CreateSabcheckoutCouponInput, user_id: ObjectId) -> Self {
        Self {
            id: None,
            user_id,
            code: input.code,
            discount_type: input.discount_type,
            discount_value: input.discount_value,
            max_uses: input.max_uses,
            uses: 0,
            status: input.status.unwrap_or_else(|| "active".to_owned()),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        }
    }
}
