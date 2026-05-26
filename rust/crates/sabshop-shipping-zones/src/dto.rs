use serde::{Deserialize, Serialize};
use crate::types::ShippingRate;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub storefront_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShippingZoneInput {
    pub storefront_id: String,
    pub name: String,
    #[serde(default)] pub regions: Vec<String>,
    #[serde(default)] pub rates: Vec<ShippingRate>,
    #[serde(default)] pub active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShippingZoneInput {
    #[serde(default)] pub name: Option<String>,
    #[serde(default)] pub regions: Option<Vec<String>>,
    #[serde(default)] pub rates: Option<Vec<ShippingRate>>,
    #[serde(default)] pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShippingZoneResponse {
    pub id: String,
    pub entity: crate::types::SabshopShippingZone,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteShippingZoneResponse { pub deleted: bool }
