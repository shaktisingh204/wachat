//! On-disk shape of a `sabshow_versions` document.
//!
//! Each version is a point-in-time snapshot of a deck: the full deck +
//! slides + elements JSON tree, written to SabFiles and referenced here
//! by `snapshotFileId`. The Mongo row itself holds only the metadata.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshowVersion {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "deckId")]
    pub deck_id: ObjectId,

    /// Monotonically increasing — matches `SabshowDeck.version` at the
    /// moment of capture.
    pub version: u32,

    #[serde(rename = "savedAt")]
    pub saved_at: BsonDateTime,
    #[serde(rename = "savedBy")]
    pub saved_by: ObjectId,

    /// Optional human-readable note ("before client review").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,

    /// SabFiles ref — full deck JSON snapshot lives in object storage,
    /// not Mongo. Restoring loads the blob and replays it into the
    /// `sabshow_*` collections.
    #[serde(rename = "snapshotFileId")]
    pub snapshot_file_id: String,

    /// Optional thumbnail of the first slide at capture time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_file_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn version_round_trips() {
        let v = SabshowVersion {
            id: None,
            deck_id: ObjectId::new(),
            version: 3,
            saved_at: BsonDateTime::from_chrono(Utc::now()),
            saved_by: ObjectId::new(),
            comment: Some("pre-review".into()),
            snapshot_file_id: "sabfile_abc".into(),
            thumbnail_file_id: None,
        };
        let j = serde_json::to_string(&v).unwrap();
        assert!(j.contains("snapshotFileId"));
        let _back: SabshowVersion = serde_json::from_str(&j).unwrap();
    }
}
