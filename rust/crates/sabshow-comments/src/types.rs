//! On-disk shape of a `sabshow_comments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowComment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,
    /// Anchored to a specific slide.
    #[serde(rename = "slideId")]
    pub slide_id: ObjectId,
    /// If present, anchored to a specific element on that slide.
    #[serde(
        rename = "elementId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub element_id: Option<ObjectId>,

    #[serde(rename = "authorUserId")]
    pub author_user_id: ObjectId,

    /// Markdown body.
    pub body: String,

    #[serde(default)]
    pub resolved: bool,

    /// For threaded replies — points at the root comment in the thread.
    #[serde(
        rename = "parentCommentId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub parent_comment_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn comment_round_trips() {
        let c = SabshowComment {
            id: None,
            deck_id: ObjectId::new(),
            slide_id: ObjectId::new(),
            element_id: None,
            author_user_id: ObjectId::new(),
            body: "lgtm".into(),
            resolved: false,
            parent_comment_id: None,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let j = serde_json::to_string(&c).unwrap();
        assert!(j.contains("authorUserId"));
        let _back: SabshowComment = serde_json::from_str(&j).unwrap();
    }
}
