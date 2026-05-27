//! Wire DTOs for the audience router.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use email_types::{
    EmailFilterTree, EmailSubscriber, EmailSubscriberStatus,
};
use serde::{Deserialize, Serialize};

// ---------- pagination ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub include_archived: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribersQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub list_id: Option<String>,
    #[serde(default)]
    pub status: Option<EmailSubscriberStatus>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
}

fn default_page() -> u64 { 1 }
fn default_limit() -> u64 { 50 }

// ---------- input bodies ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateListBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_from_name: Option<String>,
    #[serde(default)]
    pub default_from_email: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateListBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default_from_name: Option<String>,
    #[serde(default)]
    pub default_from_email: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriberBody {
    pub list_id: String,
    pub email: String,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub custom_fields: serde_json::Value,
    #[serde(default)]
    pub status: Option<EmailSubscriberStatus>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubscriberBody {
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub custom_fields: Option<serde_json::Value>,
    #[serde(default)]
    pub status: Option<EmailSubscriberStatus>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSegmentBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub list_id: Option<String>,
    pub filter: EmailFilterTree,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSegmentBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub filter: Option<EmailFilterTree>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSegmentBody {
    pub filter: EmailFilterTree,
    #[serde(default)]
    pub list_id: Option<String>,
    #[serde(default = "default_preview_limit")]
    pub sample_size: u64,
}

fn default_preview_limit() -> u64 { 10 }

// ---------- field schema ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFieldDef {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: CustomFieldType,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CustomFieldType {
    Text, Number, Date, Boolean, Select, Multiselect, Url, Phone,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub fields: Vec<CustomFieldDef>,
}

// ---------- responses ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentPreviewResponse {
    pub matches: u64,
    pub sample: Vec<EmailSubscriber>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub created: u64,
    pub updated: u64,
    pub skipped: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagsResponse {
    pub tags: Vec<TagWithCount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagWithCount {
    pub name: String,
    pub count: u64,
}

// Re-exports so handlers don't have to bring email_types in twice.
pub use email_types::{EmailFilterTree as Filter, EmailList as ListDoc, EmailSegment as SegmentDoc, EmailSubscriber as SubscriberDoc};

// Defensive use to silence unused-import warnings if a future commit drops one.
#[allow(dead_code)]
fn _refs() {
    let _ = std::marker::PhantomData::<(ObjectId, DateTime<Utc>)>;
}
