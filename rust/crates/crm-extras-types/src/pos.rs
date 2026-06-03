//! §12.6 POS / Online Store.
//!
//! Mongo collections: `crm_pos_sessions` + `crm_pos_sales` + `crm_storefronts`.
//!
//! - `PosSession` — a cashier shift on a terminal at an outlet, with
//!   opening / closing cash drawer counts.
//! - `PosSale` — a single transaction (scanned items, applied
//!   promotions, payment splits, change returned). Hold/recall is
//!   modelled by `held: true`; refunds carry `refund_of_sale_id` and
//!   reuse the same shape.
//! - `Storefront` — the public-facing online store: theme, collections,
//!   pricing rules, tax + shipping zones, gateways, abandoned-cart
//!   recovery. Theme / pricing / zones / fields are stored as
//!   `serde_json::Value` because each one is a deep nested config that
//!   the storefront editor evolves independently of this DTO.
//!
//! All three structs flatten the §0 `Identity` + `Audit` fragments.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use crm_sales_types::{LineItem, Totals};
use serde::{Deserialize, Serialize};

/* ============================== POS SESSION ============================== */

/// A cashier's shift on one terminal at one outlet.
///
/// `status` is a free-form string ("open" | "closed") rather than an
/// enum because POS deployments often introduce intermediate states
/// (e.g. "blind_close", "suspended") that we don't want to bake into
/// the type system.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosSession {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- shift head ------------------------------------------- */
    /// FK into the outlets / branches collection.
    pub outlet_id: ObjectId,

    /// Free-form terminal identifier (registered POS device id /
    /// hostname / static "till-1" label).
    pub terminal_id: String,

    pub cashier_id: ObjectId,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub shift_start: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub shift_end: Option<DateTime<Utc>>,

    pub opening_cash: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closing_cash: Option<f64>,

    /// "open" | "closed" (free-text — see struct doc).
    pub status: String,
}

/* ================================ POS SALE =============================== */

/// One leg of a split-tender payment. `mode` is intentionally
/// free-text ("cash" / "card" / "upi" / "wallet" / …) because POS
/// integrations onboard new tender types frequently and we don't want
/// the DTO to be a release blocker.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentSplit {
    pub mode: String,
    pub amount: f64,
    /// Gateway / terminal reference (auth code, RRN, last-4 PAN, UPI
    /// VPA, …). Optional — cash legs typically omit it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
}

/// A single POS sale.
///
/// `held = true` puts the cart in the recall queue; checkout flips it
/// back to `false` before stamping `status = "completed"`. Refunds /
/// exchanges write a new `PosSale` row with `refund_of_sale_id` set;
/// `status` then transitions through "refunded".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosSale {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- session + parties ------------------------------------ */
    /// FK into `crm_pos_sessions`.
    pub session_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,

    /* ----- cart ------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<LineItem>,

    /// Free-form codes / IDs of the promotions applied at scan-time.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applied_promotions: Vec<String>,

    /* ----- tender ------------------------------------------------ */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub payments: Vec<PaymentSplit>,

    /// Cash returned to the customer (cash-tendered minus owed).
    pub change_returned: f64,

    /* ----- render + workflow ------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_template_id: Option<ObjectId>,

    /// `true` while the sale sits in the recall queue.
    #[serde(default, skip_serializing_if = "is_false")]
    pub held: bool,

    /// Set on a refund / exchange row — points at the original sale.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_of_sale_id: Option<ObjectId>,

    /// "completed" | "held" | "refunded" | "voided" (free-text).
    pub status: String,

    pub totals: Totals,
}

/* ============================== STOREFRONT =============================== */

/// Public-facing online store config.
///
/// Theme, pricing rules, tax / shipping zones and checkout fields are
/// stored as opaque `serde_json::Value` shapes — each of those configs
/// is its own nested editor and we don't want to lock its schema into
/// this DTO. `collection_ids` / `product_ids` / `gateway_ids` ARE
/// modelled because they're plain FK lists the rest of the system
/// joins against.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Storefront {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- public addressing ------------------------------------ */
    /// URL slug — the leaf of the public storefront URL.
    pub slug: String,

    /// Theme bundle (palette, layout tokens, hero config, …). Opaque
    /// JSON edited by the storefront theme editor.
    pub theme: serde_json::Value,

    /* ----- catalog ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub collection_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub product_ids: Vec<ObjectId>,

    /* ----- commerce config (opaque editor blobs) ---------------- */
    pub pricing_rules: serde_json::Value,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tax_zones: Vec<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shipping_zones: Vec<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub checkout_fields: Vec<serde_json::Value>,

    /* ----- gateways + retention --------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gateway_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "is_false")]
    pub abandoned_cart_recovery: bool,
}

/* ========================== helpers ====================================== */

#[allow(clippy::trivially_copy_pass_by_ref)]
fn is_false(b: &bool) -> bool {
    !*b
}

/* ============================== tests ==================================== */

#[cfg(test)]
mod tests {
    use super::*;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn pos_session_round_trips_with_flattened_fragments() {
        let session = PosSession {
            identity: ident(),
            audit: audit(),
            outlet_id: ObjectId::new(),
            terminal_id: "till-1".into(),
            cashier_id: ObjectId::new(),
            shift_start: Utc::now(),
            shift_end: None,
            opening_cash: 5000.0,
            closing_cash: None,
            status: "open".into(),
        };

        let json = serde_json::to_value(&session).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("outletId").is_some());
        assert!(json.get("terminalId").is_some());
        assert!(json.get("openingCash").is_some());

        let back: PosSession = serde_json::from_value(json).unwrap();
        assert_eq!(back.terminal_id, "till-1");
        assert_eq!(back.opening_cash, 5000.0);
    }

    #[test]
    fn pos_sale_round_trips_with_flattened_fragments() {
        let sale = PosSale {
            identity: ident(),
            audit: audit(),
            session_id: ObjectId::new(),
            customer_id: None,
            items: vec![],
            applied_promotions: vec!["SUMMER10".into()],
            payments: vec![PaymentSplit {
                mode: "cash".into(),
                amount: 200.0,
                reference: None,
            }],
            change_returned: 0.0,
            receipt_template_id: None,
            held: false,
            refund_of_sale_id: None,
            status: "completed".into(),
            totals: Totals::default(),
        };

        let json = serde_json::to_value(&sale).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("sessionId").is_some());
        assert!(json.get("appliedPromotions").is_some());
        assert!(json.get("changeReturned").is_some());
        assert!(json.get("held").is_none(), "held=false must skip-serialize");

        let back: PosSale = serde_json::from_value(json).unwrap();
        assert_eq!(back.payments.len(), 1);
        assert_eq!(back.payments[0].mode, "cash");
        assert_eq!(back.status, "completed");
    }

    #[test]
    fn storefront_round_trips_with_flattened_fragments() {
        let store = Storefront {
            identity: ident(),
            audit: audit(),
            slug: "acme-shop".into(),
            theme: serde_json::json!({ "palette": "noir" }),
            collection_ids: vec![ObjectId::new()],
            product_ids: vec![],
            pricing_rules: serde_json::json!({ "rules": [] }),
            tax_zones: vec![serde_json::json!({ "zone": "IN-MH" })],
            shipping_zones: vec![],
            checkout_fields: vec![],
            gateway_ids: vec![ObjectId::new()],
            abandoned_cart_recovery: true,
        };

        let json = serde_json::to_value(&store).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("slug").is_some());
        assert!(json.get("collectionIds").is_some());
        assert!(json.get("pricingRules").is_some());
        assert!(json.get("taxZones").is_some());
        assert!(json.get("abandonedCartRecovery").is_some());

        let back: Storefront = serde_json::from_value(json).unwrap();
        assert_eq!(back.slug, "acme-shop");
        assert!(back.abandoned_cart_recovery);
        assert_eq!(back.collection_ids.len(), 1);
    }
}
