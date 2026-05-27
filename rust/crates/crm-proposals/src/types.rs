//! On-disk shape of a `crm_proposals` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSection {
    pub heading: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProposalAttachment {
    pub url: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProposal {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Auto-generated `"PROP-XXXXXXXX"` slug.
    pub proposal_number: String,
    pub title: String,

    /// Stored as a string in the source-of-truth TS action.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,

    pub currency: String,
    pub total_amount: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valid_until: Option<BsonDateTime>,

    /// `"draft"` | `"sent"` | `"accepted"` | `"rejected"` | `"expired"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sections: Vec<ProposalSection>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<ProposalAttachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<bson::Document>,

    /// Denormalised count from `crm_proposal_signs`.
    #[serde(default)]
    pub signs_count: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sent_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
