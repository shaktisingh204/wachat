//! §3.4 Inventory Reports.
//!
//! Unlike the other modules in this crate, the types here are
//! request / response envelopes — not stored entities. They describe
//! the shape of an inventory-report query a Server Action can accept,
//! so they intentionally skip `Identity` / `Audit` / `Assignment` (those
//! belong on persisted documents). The request kinds covered are:
//!
//! - **Product P&L** — per-item revenue, COGS and margin over a window.
//! - **Stock Value** — current on-hand × cost across warehouses.
//! - **Batch Expiry** — batches expiring within `expiry_threshold_days`.
//! - **Party Transactions** — per vendor / customer transaction history.
//! - **All Transactions** — every inventory movement in the window.
//!
//! All five share the same filter envelope; fields irrelevant to a
//! given kind are simply left `None`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Which inventory report to run.
///
/// The two single-token variants (`stock_value`, `batch_expiry`,
/// `all_transactions`) collapse cleanly under the `snake_case` rule;
/// `product_p_l` (for "Product P&L") and `party_transactions` use the
/// snake-case multi-word form.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InventoryReportKind {
    #[default]
    StockValue,
    ProductPL,
    BatchExpiry,
    PartyTransactions,
    AllTransactions,
}

/// Filters applied to an inventory report. All fields are optional —
/// callers populate only what's relevant to the chosen
/// [`InventoryReportKind`]:
///
/// - `from` / `to` — apply to every transaction-bound report
///   (Product P&L, Party Transactions, All Transactions).
/// - `warehouse_id` — narrow to one warehouse on any report.
/// - `item_id` / `category_id` — narrow Product P&L, Stock Value,
///   Batch Expiry and All Transactions.
/// - `batch` — narrow Batch Expiry / Stock Value to a single lot.
/// - `vendor_id` / `customer_id` — narrow Party Transactions.
/// - `expiry_threshold_days` — only meaningful for Batch Expiry; rows
///   are kept when the lot expires within this many days from `to`
///   (or "now" when `to` is `None`).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportFilters {
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub from: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub to: Option<DateTime<Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warehouse_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,

    /// Only meaningful when `kind == BatchExpiry` — keep batches
    /// expiring within this many days.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_threshold_days: Option<u32>,
}

/// A single inventory-report request envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportRequest {
    pub kind: InventoryReportKind,
    #[serde(default)]
    pub filters: InventoryReportFilters,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_request_with_camel_case_filters() {
        let req = InventoryReportRequest {
            kind: InventoryReportKind::BatchExpiry,
            filters: InventoryReportFilters {
                from: Some(Utc::now()),
                to: Some(Utc::now()),
                warehouse_id: Some(ObjectId::new()),
                item_id: None,
                category_id: Some(ObjectId::new()),
                batch: Some("LOT-A19".into()),
                vendor_id: None,
                customer_id: None,
                expiry_threshold_days: Some(30),
            },
        };

        let json = serde_json::to_value(&req).unwrap();

        // multi-word enum variant serializes snake_case.
        assert_eq!(
            json.get("kind").and_then(|v| v.as_str()),
            Some("batch_expiry")
        );

        // Filter fields are camelCase at one nested level.
        let f = json.get("filters").unwrap();
        assert!(f.get("warehouseId").is_some());
        assert!(f.get("categoryId").is_some());
        assert!(f.get("expiryThresholdDays").is_some());
        // Optional `None` fields skip-serialize.
        assert!(f.get("itemId").is_none());
        assert!(f.get("vendorId").is_none());
        assert!(f.get("customerId").is_none());

        // Round-trip through serde_json.
        let back: InventoryReportRequest = serde_json::from_value(json).unwrap();
        assert_eq!(back.kind, InventoryReportKind::BatchExpiry);
        assert_eq!(back.filters.expiry_threshold_days, Some(30));
        assert_eq!(back.filters.batch.as_deref(), Some("LOT-A19"));
    }

    #[test]
    fn report_kind_serializes_snake_case() {
        assert_eq!(
            serde_json::to_string(&InventoryReportKind::ProductPL).unwrap(),
            "\"product_p_l\""
        );
        assert_eq!(
            serde_json::to_string(&InventoryReportKind::PartyTransactions).unwrap(),
            "\"party_transactions\""
        );
        assert_eq!(
            serde_json::to_string(&InventoryReportKind::AllTransactions).unwrap(),
            "\"all_transactions\""
        );
        // Single-word "stock_value" is two tokens under snake_case.
        assert_eq!(
            serde_json::to_string(&InventoryReportKind::StockValue).unwrap(),
            "\"stock_value\""
        );
    }

    #[test]
    fn empty_filters_default_round_trip() {
        let req = InventoryReportRequest {
            kind: InventoryReportKind::AllTransactions,
            filters: InventoryReportFilters::default(),
        };
        let json = serde_json::to_value(&req).unwrap();
        // The filters object exists but every field skip-serializes.
        let f = json.get("filters").unwrap();
        assert!(f.as_object().is_some_and(|m| m.is_empty()));

        let back: InventoryReportRequest = serde_json::from_value(json).unwrap();
        assert_eq!(back.kind, InventoryReportKind::AllTransactions);
    }
}
