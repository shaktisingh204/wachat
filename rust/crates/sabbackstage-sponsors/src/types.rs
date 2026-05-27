//! On-disk shape of a `sabbackstage_sponsors` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbackstageSponsor {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Host event in `crm_events`.
    pub event_id: ObjectId,

    pub name: String,
    /// Free-form display tier, e.g. `"platinum"`, `"gold"`, `"silver"`.
    /// We do not enforce a fixed enum so customers can theme tiers.
    pub tier: String,

    /// SabFiles file id for the sponsor logo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_file_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,

    #[serde(default)]
    pub order_rank: i32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
