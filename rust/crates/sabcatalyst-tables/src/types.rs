use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableField {
    pub name: String,
    pub r#type: String,
    #[serde(default)] pub nullable: bool,
    #[serde(default)] pub indexed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema { pub fields: Vec<TableField> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabcatalystTable {
    #[serde(rename = "_id")] pub id: ObjectId,
    pub project_id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    pub schema_json: TableSchema,
    #[serde(default)] pub records_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
