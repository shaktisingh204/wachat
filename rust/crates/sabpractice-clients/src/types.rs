//! On-disk shape of a `sabpractice_clients` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabPracticeClient {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Owning firm. Optional — defaults to the tenant's primary firm.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub firm_id: Option<ObjectId>,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fiscal_year_start: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_contact_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_contact_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_contact_phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registration_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `active` | `inactive` | `onboarding`. Free-form to allow legacy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Soft pointer to data in CRM/accounting (or external system).
    /// Shape is intentionally opaque — the consumer interprets it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub books_link_ref: Option<BooksLinkRef>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub assigned_advisor_user_ids: Vec<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BooksLinkRef {
    /// Where the books live — `sabnode` (CRM/accounting) | `external`.
    pub system: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}
