//! On-disk shape of a `sabcheckout_pages` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `"draft"` | `"live"` | `"paused"`.
pub type PageStatusStr = String;

/// `"one_off"` | `"recurring"` | `"both"`.
pub type PageModeStr = String;

/// `"amount"` | `"plan"`.
pub type ItemTypeStr = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutItem {
    /// `"amount"` (free-typed cents amount) or `"plan"` (refs a subscription plan).
    #[serde(rename = "type")]
    pub kind: ItemTypeStr,
    /// Label rendered next to the item.
    pub label: String,
    /// Required when `type == "amount"`. Stored as minor units (paise/cents).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_minor: Option<i64>,
    /// Required when `type == "plan"`. Refs `sabcheckout_plans._id`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<ObjectId>,
    /// When true the public form shows a quantity stepper.
    #[serde(default)]
    pub allow_quantity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RequiredField {
    /// One of the canonical names (`name`, `email`, `phone`) or a free-form key
    /// for custom fields.
    pub name: String,
    /// Display label shown on the public form.
    pub label: String,
    /// `true` for the built-in `email`/`phone`/`name` fields, `false` for custom.
    #[serde(default)]
    pub custom: bool,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutPage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// URL slug rendered under `/pay/[pageSlug]`. Unique per user.
    pub slug: String,
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Free-form theme JSON (background, accent, font, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_json: Option<bson::Document>,
    /// SabFiles file id for the logo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_file_id: Option<String>,
    /// ISO 4217 currency code, e.g. `"INR"`, `"USD"`.
    #[serde(default = "default_currency")]
    pub currency: String,
    /// `"draft"` | `"live"` | `"paused"`.
    #[serde(default = "default_status")]
    pub status: PageStatusStr,
    /// `"one_off"` | `"recurring"` | `"both"`.
    #[serde(default = "default_mode")]
    pub mode: PageModeStr,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<CheckoutItem>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub require_fields: Vec<RequiredField>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub success_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancel_url: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_currency() -> String {
    "INR".to_owned()
}
fn default_status() -> String {
    "draft".to_owned()
}
fn default_mode() -> String {
    "one_off".to_owned()
}
