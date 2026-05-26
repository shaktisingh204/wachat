use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub storefront_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaxRuleInput {
    pub storefront_id: String,
    pub name: String,
    pub region: String,
    pub rate: f64,
    #[serde(default)] pub inclusive: Option<bool>,
    #[serde(default)] pub product_category_ids: Vec<String>,
    #[serde(default)] pub active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaxRuleInput {
    #[serde(default)] pub name: Option<String>,
    #[serde(default)] pub region: Option<String>,
    #[serde(default)] pub rate: Option<f64>,
    #[serde(default)] pub inclusive: Option<bool>,
    #[serde(default)] pub product_category_ids: Option<Vec<String>>,
    #[serde(default)] pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaxRuleResponse {
    pub id: String,
    pub entity: crate::types::SabshopTaxRule,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTaxRuleResponse { pub deleted: bool }
