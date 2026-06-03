use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshopProduct {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<ObjectId>,

    pub title: String,
    pub slug: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html_description: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub media_urls: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_type: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /// `"draft"` | `"active"` | `"archived"`
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub collection_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<SabshopProductOption>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variants: Vec<SabshopProductVariant>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshopProductOption {
    pub name: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabshopProductVariant {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub barcode: Option<String>,

    pub price: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compare_at_price: Option<f64>,

    #[serde(default)]
    pub track_inventory: bool,
    #[serde(default)]
    pub inventory_quantity: i32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight_unit: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option1: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option2: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option3: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

fn default_status() -> String {
    "draft".to_owned()
}
