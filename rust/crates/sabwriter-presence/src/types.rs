//! On-disk shape of a `sabwriter_presence` row.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceCursor {
    pub anchor: u32,
    pub head: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterPresence {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub document_id: ObjectId,
    pub user_id: ObjectId,

    /// Optional cursor — absent when a user is connected but hasn't
    /// placed a cursor yet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<PresenceCursor>,

    /// Hex color used to render this user's cursor/selection.
    pub color: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: BsonDateTime,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn presence_round_trip() {
        let p = SabwriterPresence {
            id: None,
            document_id: ObjectId::new(),
            user_id: ObjectId::new(),
            cursor: Some(PresenceCursor {
                anchor: 5,
                head: 12,
            }),
            color: "#7C5CFF".into(),
            display_name: Some("R".into()),
            last_seen_at: BsonDateTime::from_chrono(Utc::now()),
        };
        let d = bson::to_document(&p).unwrap();
        assert!(d.contains_key("documentId"));
        assert!(d.contains_key("cursor"));
        assert!(d.contains_key("lastSeenAt"));
    }
}
