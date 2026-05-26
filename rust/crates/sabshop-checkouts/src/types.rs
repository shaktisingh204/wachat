//! On-disk shape of a `sabshop_checkouts` document.

use bson::{Bson, DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabshopCheckout {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub cart_id: ObjectId,
    pub storefront_id: ObjectId,
    /// `"address"` | `"shipping"` | `"payment"` | `"review"` | `"completed"`.
    pub step: String,
    #[serde(default)]
    pub payload: Bson,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order_id: Option<ObjectId>,
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
