//! On-disk shape of a `sabwriter_suggestions` row.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionAnchor {
    pub from: u32,
    pub to: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionStatus {
    Pending,
    Accepted,
    Rejected,
}

impl Default for SuggestionStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterSuggestion {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub document_id: ObjectId,
    pub anchor: SuggestionAnchor,
    pub author_user_id: ObjectId,

    /// Opaque payload — TipTap insert / delete step JSON. The TS layer
    /// applies this against the live editor state on accept.
    pub proposal_json: serde_json::Value,

    pub status: SuggestionStatus,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<BsonDateTime>,

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
    fn suggestion_round_trip() {
        let s = SabwriterSuggestion {
            id: None,
            user_id: ObjectId::new(),
            document_id: ObjectId::new(),
            anchor: SuggestionAnchor { from: 3, to: 10 },
            author_user_id: ObjectId::new(),
            proposal_json: serde_json::json!({ "steps": [] }),
            status: SuggestionStatus::Pending,
            reviewed_by: None,
            reviewed_at: None,
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let d = bson::to_document(&s).unwrap();
        assert!(d.contains_key("proposalJson"));
        assert_eq!(d.get_str("status").unwrap(), "pending");
    }
}
