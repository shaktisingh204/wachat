//! On-disk shape of a `sabcreator_pages` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorPage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    pub name: String,
    pub slug: String,

    /// `dashboard` | `list` | `detail` | `form` | `chart` | `custom`.
    pub kind: String,

    /// `{ widgets: [...], filters: [...], ... }`.
    pub config_json: Value,

    /// `all` | `admin` | `specific`.
    #[serde(default = "default_role_visibility")]
    pub role_visibility: String,

    /// When `roleVisibility = specific`, the allowed app-role ids.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_role_ids: Vec<ObjectId>,

    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_role_visibility() -> String {
    "all".to_owned()
}
