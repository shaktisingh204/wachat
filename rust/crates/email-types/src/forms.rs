use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailFormKind { Embed, Popup, Landing }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailFormField {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: EmailFormFieldKind,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailFormFieldKind {
    Text, Email, Number, Select, Checkbox, Phone, Date,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailFormConsent {
    pub required: bool,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailFormDesign {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub brand_kit_id: Option<ObjectId>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub submit_label: Option<String>,
    #[serde(default)]
    pub success_message: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailFormStatus { Draft, Published, Archived }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailForm {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    pub kind: EmailFormKind,
    pub list_id: ObjectId,
    pub fields: Vec<EmailFormField>,
    pub consent: EmailFormConsent,
    pub design: EmailFormDesign,
    #[serde(default)]
    pub slug: Option<String>,
    pub status: EmailFormStatus,
    #[serde(default)]
    pub submissions: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
