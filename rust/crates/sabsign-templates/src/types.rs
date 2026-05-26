//! On-disk shape of an `esign_templates` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

use sabsign_envelopes::types::{EnvelopeField, RoutingOrder, RoutingRule};

/// A recipient slot in a template — concrete name/email is filled in at
/// instantiation time.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateRecipientSlot {
    pub role: String,
    pub label: String,
    pub order: u32,
    /// Default auth method to use when instantiating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EsignTemplate {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub doc_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_name: Option<String>,

    pub routing_order: RoutingOrder,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routing_rules: Vec<RoutingRule>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipient_slots: Vec<TemplateRecipientSlot>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<EnvelopeField>,

    /// `"active" | "archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
