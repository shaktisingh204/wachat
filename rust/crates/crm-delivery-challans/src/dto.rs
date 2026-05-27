//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{ChallanLineItem, CrmDeliveryChallan, TransportDetails};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChallanInput {
    pub challan_number: String,
    #[serde(default)]
    pub account_id: Option<String>,
    pub challan_date: String,
    #[serde(default)]
    pub line_items: Vec<ChallanLineItem>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub transport_details: TransportDetails,
    #[serde(default)]
    pub notes: Option<String>,

    /* ----- §13.5 lineage seeding ----- */
    /// Optional lineage parent kind. Allowed values mirror the TS
    /// `ALLOWED_PARENT_KINDS` whitelist in `saveDeliveryChallan`:
    /// `"salesOrder"`, `"invoice"`, `"quotation"`. Anything else is
    /// ignored (the challan still saves, just without lineage).
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,

    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChallanInput {
    #[serde(default)]
    pub challan_number: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub challan_date: Option<String>,
    #[serde(default)]
    pub line_items: Option<Vec<ChallanLineItem>>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub transport_details: Option<TransportDetails>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChallanResponse {
    pub id: String,
    pub entity: CrmDeliveryChallan,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChallanResponse {
    pub deleted: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_lineage_hints() {
        let json = serde_json::json!({
            "challanNumber": "DC-001",
            "challanDate": "2026-05-16T00:00:00Z",
            "lineItems": [{
                "description": "Widget",
                "quantity": 2.0
            }],
            "fromKind": "salesOrder",
            "fromId": "65f00000000000000000beef",
        });
        let input: CreateChallanInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.challan_number, "DC-001");
        assert_eq!(input.from_kind.as_deref(), Some("salesOrder"));
        assert_eq!(input.from_id.as_deref(), Some("65f00000000000000000beef"));
    }

    #[test]
    fn create_input_omitting_lineage_hints_is_valid() {
        let json = serde_json::json!({
            "challanNumber": "DC-002",
            "challanDate": "2026-05-16T00:00:00Z",
            "lineItems": [{
                "description": "Widget",
                "quantity": 1.0
            }],
        });
        let input: CreateChallanInput = serde_json::from_value(json).unwrap();
        assert!(input.from_kind.is_none());
        assert!(input.from_id.is_none());
    }
}
