//! On-disk shape of a `sabwriter_documents` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Lifecycle of a SabWriter document.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DocumentStatus {
    Draft,
    InReview,
    Approved,
    SentForSignature,
}

impl Default for DocumentStatus {
    fn default() -> Self {
        Self::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner user (tenant scope). All RBAC + isolation hangs off this.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// Sub-org / project scope if applicable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<ObjectId>,
    /// Original author — equal to userId at create time but preserved
    /// across ownership transfers.
    #[serde(rename = "ownerUserId")]
    pub owner_user_id: ObjectId,

    pub title: String,

    /// Users (by ObjectId) granted collaborator access to this doc.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shared_with_user_ids: Vec<ObjectId>,

    /// TipTap / ProseMirror JSON. Stored as opaque so the schema can
    /// evolve.
    #[serde(default)]
    pub content_json: serde_json::Value,

    pub status: DocumentStatus,

    /// Monotonically incremented every time `saveSabwriterVersion` is
    /// called. The Mongo doc always holds the latest content; historical
    /// snapshots live in `sabwriter_document_versions`.
    #[serde(default)]
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_version_id: Option<ObjectId>,

    /// SabSign envelope id once `sendDocumentForSignature` has run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub envelope_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    #[serde(rename = "createdBy", default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,
    #[serde(rename = "updatedBy", default, skip_serializing_if = "Option::is_none")]
    pub updated_by: Option<ObjectId>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn document_round_trip_camel_case() {
        let d = SabwriterDocument {
            id: None,
            user_id: ObjectId::new(),
            project_id: None,
            tenant_id: None,
            owner_user_id: ObjectId::new(),
            title: "Spec".into(),
            shared_with_user_ids: vec![],
            content_json: serde_json::json!({ "type": "doc" }),
            status: DocumentStatus::Draft,
            version: 0,
            latest_version_id: None,
            envelope_id: None,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
            created_by: None,
            updated_by: None,
        };
        let v = bson::to_bson(&d).unwrap();
        let s = serde_json::to_string(&v).unwrap();
        assert!(s.contains("userId"));
        assert!(s.contains("ownerUserId"));
        assert!(s.contains("contentJson"));
        assert!(s.contains("\"draft\""));
    }
}
