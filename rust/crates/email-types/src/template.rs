//! Templates + builder document + reusable blocks.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmailBuilderBlockType {
    Text, Image, Button, Columns, Divider,
    Spacer, Social, Video, Footer, Html, Amp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: EmailBuilderBlockType,
    #[serde(default)]
    pub props: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<EmailBuilderBlock>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderSettings {
    #[serde(default)]
    pub background_color: Option<String>,
    #[serde(default)]
    pub content_background_color: Option<String>,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub preheader: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailBuilderDocument {
    pub version: u8,
    pub settings: EmailBuilderSettings,
    pub blocks: Vec<EmailBuilderBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplate {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builder_json: Option<EmailBuilderDocument>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mjml: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub is_library: bool,
    #[serde(default = "default_version")]
    pub version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_version() -> u32 { 1 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplateBlock {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub name: String,
    pub block: EmailBuilderBlock,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
