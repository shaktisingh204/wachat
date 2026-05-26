//! On-disk shape of a `sabshop_storefronts` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshopStorefront {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<ObjectId>,

    pub slug: String,
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<ObjectId>,
    #[serde(default = "default_currency")]
    pub currency: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shipping_zone_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tax_rule_ids: Vec<ObjectId>,

    /// `"draft"` | `"live"` | `"paused"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub favicon_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hero_image_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hero_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hero_subtitle: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub featured_product_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub featured_collection_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub published_product_ids: Vec<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_currency() -> String { "INR".to_owned() }
fn default_status() -> String { "draft".to_owned() }
