//! Line-item + totals shapes shared by quotation / proforma / sales
//! order / invoice. Delivery challan uses its own line-item type
//! (`ChallanLineItem`) because qty-only / batch-tracking semantics
//! diverge enough that a shared struct would be all-`Option`.
//!
//! Money fields are `f64` to match the TS Number JSON shape; future
//! migration to `rust_decimal` is tracked as a sweep across all
//! `crm-sales-types` modules.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// Value-bearing line item. Quotation/proforma populate the pricing +
/// tax fields and ignore fulfillment fields; sales orders additionally
/// populate `warehouse_id` + `qty_pending` / `qty_delivered` /
/// `qty_invoiced`; invoices populate `cess_amount`. All extras are
/// optional so the struct can be reused without per-doc subclassing.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItem {
    /// FK into `crm_products`. Optional because ad-hoc rows (free-text
    /// description without a catalog item) are allowed on quotations.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id: Option<ObjectId>,

    /// Free-text description. Falls back to the catalog item's name at
    /// render-time when blank.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// HSN (goods) or SAC (services) code.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hsn_sac: Option<String>,

    pub qty: f64,

    /// Unit of measure ("nos", "kg", "hrs", …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,

    pub rate: f64,

    /// Per-line discount %. Overall discount lives on `Totals`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount_pct: Option<f32>,

    /// Per-line tax rate % (CGST+SGST or IGST combined).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_rate_pct: Option<f32>,

    /// CGST/SGST/IGST/CESS computed amounts. Intra-state populates
    /// CGST+SGST and leaves IGST `None`; inter-state populates IGST
    /// alone. CESS only populates on invoice line items.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cgst_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sgst_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub igst_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cess_amount: Option<f64>,

    pub total: f64,

    /* ---------- Sales-Order fulfillment fields (optional) -------- */
    /// Per-line warehouse, populated on sales orders with multi-WH
    /// fulfillment. Omitted on quotation/proforma/invoice.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warehouse_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qty_pending: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qty_delivered: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qty_invoiced: Option<f64>,
}

/// Document-level totals. Aggregate of line items + global modifiers.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub sub_total: f64,
    /// Overall (header-level) discount, applied after sub-total. Per-line
    /// discounts are baked into each line's `total`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount_overall: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shipping_charge: Option<f64>,
    /// Free-form positive/negative adjustment ("write-off", "courtesy
    /// credit", …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adjustment: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub round_off: Option<f64>,
    pub total: f64,
}
