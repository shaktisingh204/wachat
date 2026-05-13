//! On-disk shape of a `crm_contacts` document.
//!
//! Mirrors the TS `CrmContact` interface in `src/lib/definitions.ts`. Keep
//! the two in lock-step: field name additions/removals MUST land in both
//! places in the same change.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmContact {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /* ----- relationships ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<ObjectId>,

    /* ----- core identity ----- */
    pub name: String,
    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,

    /* ----- lifecycle / status -----
     * TS enum: 'new_lead' | 'contacted' | 'qualified' | 'unqualified' |
     * 'customer' | 'imported'. Kept free-form so soft-delete ('archived') and
     * any other legacy value round-trips unchanged. */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_score: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<BsonDateTime>,

    /* ----- notes & tags ----- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<ContactNote>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /* ----- social ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linkedin_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub twitter_handle: Option<String>,

    /* ----- segmentation ----- */
    /// Free-form to accept legacy values ('lead', 'mql', 'sql', 'customer',
    /// 'evangelist', 'other').
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lifecycle_stage: Option<String>,
    /// Free-form to accept legacy values ('website', 'referral', 'social',
    /// 'event', 'cold-outbound', 'ad', 'other').
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,

    /* ----- personal ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date_of_birth: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContactNote {
    pub content: String,
    pub created_at: BsonDateTime,
    pub author: String,
}
