//! On-disk shape of a `sabwriter_document_versions` row.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterDocumentVersion {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner of the parent document — kept here for tenant-scoped queries
    /// without joining.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub document_id: ObjectId,
    pub version: u32,

    /// Snapshot of `SabwriterDocument.contentJson` at save time.
    pub content_json: serde_json::Value,

    pub author_user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,

    #[serde(rename = "savedAt")]
    pub saved_at: BsonDateTime,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn version_round_trip() {
        let v = SabwriterDocumentVersion {
            id: None,
            user_id: ObjectId::new(),
            document_id: ObjectId::new(),
            version: 3,
            content_json: serde_json::json!({}),
            author_user_id: ObjectId::new(),
            comment: Some("first draft".into()),
            saved_at: BsonDateTime::from_chrono(Utc::now()),
        };
        let d = bson::to_document(&v).unwrap();
        assert!(d.contains_key("documentId"));
        assert!(d.contains_key("contentJson"));
        assert!(d.contains_key("authorUserId"));
    }
}
