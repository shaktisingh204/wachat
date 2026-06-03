//! On-disk shape of a `crm_certifications` document.
//!
//! The legacy TS writer persists several fields in `snake_case`. We mirror
//! the wire format with explicit `serde(rename = "...")` so the Rust BFF
//! is byte-compatible with the Mongo collection without forcing a backfill.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CrmCertification {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuer: Option<String>,

    #[serde(
        rename = "employee_id",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub employee_id: Option<String>,
    #[serde(
        rename = "employee_name",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub employee_name: Option<String>,
    #[serde(
        rename = "certification_number",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub certification_number: Option<String>,
    #[serde(
        rename = "issue_date",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub issue_date: Option<BsonDateTime>,
    #[serde(
        rename = "expiry_date",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry_date: Option<BsonDateTime>,
    #[serde(
        rename = "certificate_url",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub certificate_url: Option<String>,

    /// `"active"` | `"expired"` | `"revoked"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
