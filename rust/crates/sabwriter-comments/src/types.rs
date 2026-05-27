//! On-disk shape of a `sabwriter_comments` row.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchor {
    /// Inclusive start offset in the document (ProseMirror position).
    pub from: u32,
    /// Exclusive end offset.
    pub to: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterComment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner of the parent document, copied for tenant-scoped queries.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub document_id: ObjectId,
    pub anchor: CommentAnchor,
    pub author_user_id: ObjectId,
    pub body: String,
    #[serde(default)]
    pub resolved: bool,
    /// When set, this comment is a reply to another comment in the same
    /// document — used for threaded discussion.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_comment_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_by: Option<ObjectId>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn comment_round_trip() {
        let c = SabwriterComment {
            id: None,
            user_id: ObjectId::new(),
            document_id: ObjectId::new(),
            anchor: CommentAnchor { from: 5, to: 12 },
            author_user_id: ObjectId::new(),
            body: "note".into(),
            resolved: false,
            parent_comment_id: None,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
            resolved_at: None,
            resolved_by: None,
        };
        let d = bson::to_document(&c).unwrap();
        assert!(d.contains_key("documentId"));
        assert!(d.contains_key("anchor"));
        assert_eq!(d.get_document("anchor").unwrap().get_i32("from").unwrap(), 5);
    }
}
