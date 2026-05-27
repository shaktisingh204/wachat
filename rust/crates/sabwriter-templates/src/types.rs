//! On-disk shape of a `sabwriter_templates` row.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabwriterTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Owner. For `public` templates the platform seeds these under a
    /// designated system user id.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Free-form category — e.g. `"NDA"`, `"Offer Letter"`, `"Contract"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    pub content_json: serde_json::Value,

    /// When `true`, every user can list + instantiate this template.
    #[serde(default)]
    pub public: bool,

    /// `"active" | "archived"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "active".to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn template_round_trip() {
        let t = SabwriterTemplate {
            id: None,
            user_id: ObjectId::new(),
            name: "NDA".into(),
            description: None,
            category: Some("Legal".into()),
            content_json: serde_json::json!({}),
            public: true,
            status: "active".into(),
            created_at: BsonDateTime::from_chrono(Utc::now()),
            updated_at: None,
        };
        let d = bson::to_document(&t).unwrap();
        assert!(d.contains_key("contentJson"));
        assert_eq!(d.get_bool("public").unwrap(), true);
    }
}
