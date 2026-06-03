//! §12.7 Coupons / Promotions / Loyalty / Gift Cards.
//!
//! Three top-level DTOs:
//!
//! - [`Coupon`] — discount code with type (percent / flat / BOGO / free
//!   shipping), validity window, applicability filters, usage caps,
//!   stackability and exclusions.
//! - [`LoyaltyProgram`] — tiered points-based loyalty config (tiers,
//!   earn rate, expiry, redemption ratio, partner stores).
//! - [`GiftCard`] — code with monetary balance, optional assignee,
//!   transferability flag, and per-redemption ledger entries.
//!
//! All three flatten the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! / audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================
 * Coupon
 * ============================================================ */

/// Tagged discount kind. Serialized as `{ "kind": "...", ...payload }`
/// so the JSON shape is self-describing and forward-compatible with new
/// promotion mechanics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CouponType {
    /// Percentage off the cart subtotal (or applicable line items).
    Percent {
        /// 0–100 percent. Stored as `f32` because typical config is a
        /// small whole number ("10", "12.5") — keeps the JSON compact.
        pct: f32,
    },
    /// Flat-amount discount. `currency` is the ISO code the amount is
    /// expressed in; the cart must be in the same currency for the
    /// coupon to apply (or the consumer must convert).
    Flat { amount: f64, currency: String },
    /// Buy `buy` get `get` free. `applies_to_item_ids` restricts the
    /// promo to a specific set of products; an empty vec means "any
    /// matching items in the cart".
    Bogo {
        buy: u32,
        get: u32,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        applies_to_item_ids: Vec<ObjectId>,
    },
    /// Free shipping; no payload.
    FreeShipping,
}

impl Default for CouponType {
    fn default() -> Self {
        CouponType::Percent { pct: 0.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Coupon {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- code + discount mechanics ----------------------------- */
    pub code: String,
    pub kind: CouponType,

    /* ----- gating ------------------------------------------------ */
    /// Minimum cart subtotal required for the coupon to apply.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_cart: Option<f64>,
    /// Total redemptions across all customers; `None` = unlimited.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_uses_total: Option<u32>,
    /// Per-customer redemption cap; `None` = unlimited.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_uses_per_customer: Option<u32>,

    /* ----- validity window --------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub valid_from: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub valid_until: Option<DateTime<Utc>>,

    /* ----- applicability scopes (empty = "any") ------------------ */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_product_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_category_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applicable_customer_ids: Vec<ObjectId>,

    /* ----- combination rules ------------------------------------- */
    /// Whether this coupon can stack with other discounts in the same
    /// cart. Defaults to `false` — most coupons are exclusive.
    #[serde(default, skip_serializing_if = "is_false")]
    pub stackable: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub exclusion_product_ids: Vec<ObjectId>,

    /* ----- runtime counters + lifecycle -------------------------- */
    #[serde(default)]
    pub used_count: u32,
    #[serde(default)]
    pub active: bool,
}

/* ============================================================
 * Loyalty Program
 * ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoyaltyTier {
    pub name: String,
    /// Lifetime points required to enter this tier.
    pub threshold_points: u64,
    /// Earn-rate multiplier for purchases made while in this tier
    /// (e.g. `1.5` for "1.5× points on all spend").
    pub multiplier: f32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub perks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoyaltyProgram {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tiers: Vec<LoyaltyTier>,
    /// Points awarded per 1 unit of base currency spent (before tier
    /// multiplier). E.g. `1.0` = "1 point per ₹1".
    pub points_per_currency_unit: f32,
    /// How many months until earned points expire; `None` = never.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub point_expiry_months: Option<u32>,
    /// Currency value of 1 point at redemption (e.g. `0.25` = "1 point
    /// = ₹0.25"). Note: §12.7 wording is "1 point = N currency", so
    /// this is the per-point currency value, not a points-per-currency
    /// rate.
    pub redemption_ratio: f32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub partner_store_ids: Vec<ObjectId>,
    #[serde(default)]
    pub active: bool,
}

/* ============================================================
 * Gift Card
 * ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardRedemption {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub amount: f64,
    /// FK to the sale / invoice the redemption was applied to (if any).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sale_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCard {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub code: String,
    /// FK to a Customer, if the card was issued to a known account.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_to_customer_id: Option<ObjectId>,
    /// Email the card was issued to — used for guest / anonymous gifts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_to_email: Option<String>,

    /// Original face value of the card.
    pub value: f64,
    /// Remaining balance after redemptions.
    pub balance: f64,
    pub currency: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,

    /// Whether the card can be reassigned to another recipient after
    /// issue.
    #[serde(default, skip_serializing_if = "is_false")]
    pub transferable: bool,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub redemption_log: Vec<GiftCardRedemption>,

    /// Free-form lifecycle string: "active" | "redeemed" | "expired"
    /// | "void". Kept as `String` per spec (not a closed enum) so the
    /// consumer can introduce additional terminal states without a
    /// schema migration.
    pub status: String,
}

/* ============================================================
 * helpers
 * ============================================================ */

#[allow(clippy::trivially_copy_pass_by_ref)]
fn is_false(b: &bool) -> bool {
    !*b
}

/* ============================================================
 * tests
 * ============================================================ */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crm_core::{Audit, Identity};

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn sample_audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn coupon_round_trips_with_tagged_kind() {
        let coupon = Coupon {
            identity: sample_identity(),
            audit: sample_audit(),
            code: "SUMMER25".into(),
            kind: CouponType::Percent { pct: 25.0 },
            min_cart: Some(500.0),
            max_uses_total: Some(1_000),
            max_uses_per_customer: Some(1),
            valid_from: Utc::now(),
            valid_until: None,
            applicable_product_ids: vec![],
            applicable_category_ids: vec![],
            applicable_customer_ids: vec![],
            stackable: false,
            exclusion_product_ids: vec![],
            used_count: 0,
            active: true,
        };

        let v = serde_json::to_value(&coupon).expect("serialize Coupon");

        // Identity / Audit are flattened, never nested.
        assert!(v.get("_id").is_some(), "_id flattened to root");
        assert!(v.get("projectId").is_some(), "projectId flattened to root");
        assert!(v.get("userId").is_some(), "userId flattened to root");
        assert!(v.get("createdAt").is_some(), "createdAt flattened to root");
        assert!(v.get("identity").is_none(), "identity must NOT be nested");
        assert!(v.get("audit").is_none(), "audit must NOT be nested");

        // camelCase entity fields.
        assert_eq!(v.get("code").and_then(|x| x.as_str()), Some("SUMMER25"));
        assert!(v.get("validFrom").is_some());
        assert!(v.get("maxUsesPerCustomer").is_some());

        // Tagged-enum CouponType: percent variant => kind="percent" + pct.
        let kind = v.get("kind").expect("kind object present");
        assert_eq!(kind.get("kind").and_then(|x| x.as_str()), Some("percent"));
        assert!((kind.get("pct").and_then(|x| x.as_f64()).unwrap() - 25.0).abs() < 1e-6);

        // Round-trip back.
        let back: Coupon = serde_json::from_value(v).expect("deserialize Coupon");
        assert_eq!(back.code, "SUMMER25");
        match back.kind {
            CouponType::Percent { pct } => assert!((pct - 25.0).abs() < 1e-6),
            _ => panic!("expected Percent variant after round-trip"),
        }

        // Sanity check the other CouponType variants serialize with the
        // expected `kind` discriminator.
        let bogo = serde_json::to_value(CouponType::Bogo {
            buy: 2,
            get: 1,
            applies_to_item_ids: vec![],
        })
        .unwrap();
        assert_eq!(bogo.get("kind").and_then(|x| x.as_str()), Some("bogo"));
        assert_eq!(bogo.get("buy").and_then(|x| x.as_u64()), Some(2));

        let ship = serde_json::to_value(CouponType::FreeShipping).unwrap();
        assert_eq!(
            ship.get("kind").and_then(|x| x.as_str()),
            Some("free_shipping")
        );

        let flat = serde_json::to_value(CouponType::Flat {
            amount: 50.0,
            currency: "INR".into(),
        })
        .unwrap();
        assert_eq!(flat.get("kind").and_then(|x| x.as_str()), Some("flat"));
        assert_eq!(flat.get("currency").and_then(|x| x.as_str()), Some("INR"));
    }

    #[test]
    fn loyalty_program_round_trips() {
        let prog = LoyaltyProgram {
            identity: sample_identity(),
            audit: sample_audit(),
            name: "SabRewards".into(),
            tiers: vec![
                LoyaltyTier {
                    name: "Silver".into(),
                    threshold_points: 0,
                    multiplier: 1.0,
                    perks: vec!["1x points".into()],
                },
                LoyaltyTier {
                    name: "Gold".into(),
                    threshold_points: 5_000,
                    multiplier: 1.5,
                    perks: vec!["1.5x points".into(), "free shipping".into()],
                },
            ],
            points_per_currency_unit: 1.0,
            point_expiry_months: Some(12),
            redemption_ratio: 0.25,
            partner_store_ids: vec![],
            active: true,
        };

        let v = serde_json::to_value(&prog).expect("serialize LoyaltyProgram");
        assert!(v.get("_id").is_some());
        assert!(v.get("createdAt").is_some());
        assert!(v.get("identity").is_none());
        assert!(v.get("audit").is_none());

        // camelCase + nested array shape.
        assert_eq!(v.get("name").and_then(|x| x.as_str()), Some("SabRewards"));
        assert!(v.get("pointsPerCurrencyUnit").is_some());
        assert!(v.get("pointExpiryMonths").is_some());

        let tiers = v.get("tiers").and_then(|x| x.as_array()).unwrap();
        assert_eq!(tiers.len(), 2);
        assert_eq!(tiers[1].get("name").and_then(|x| x.as_str()), Some("Gold"));
        assert_eq!(
            tiers[1].get("thresholdPoints").and_then(|x| x.as_u64()),
            Some(5_000)
        );

        let back: LoyaltyProgram = serde_json::from_value(v).expect("deserialize LoyaltyProgram");
        assert_eq!(back.name, "SabRewards");
        assert_eq!(back.tiers.len(), 2);
        assert_eq!(back.tiers[1].threshold_points, 5_000);
    }

    #[test]
    fn gift_card_round_trips() {
        let card = GiftCard {
            identity: sample_identity(),
            audit: sample_audit(),
            code: "GC-ABCD-1234".into(),
            issued_to_customer_id: None,
            issued_to_email: Some("recipient@example.com".into()),
            value: 1_000.0,
            balance: 750.0,
            currency: "INR".into(),
            expiry: None,
            transferable: true,
            redemption_log: vec![GiftCardRedemption {
                at: Utc::now(),
                amount: 250.0,
                sale_id: Some(ObjectId::new()),
                note: Some("Order #42".into()),
            }],
            status: "active".into(),
        };

        let v = serde_json::to_value(&card).expect("serialize GiftCard");
        assert!(v.get("_id").is_some());
        assert!(v.get("projectId").is_some());
        assert!(v.get("createdAt").is_some());
        assert!(v.get("identity").is_none());
        assert!(v.get("audit").is_none());

        // camelCase fields.
        assert_eq!(v.get("code").and_then(|x| x.as_str()), Some("GC-ABCD-1234"));
        assert_eq!(
            v.get("issuedToEmail").and_then(|x| x.as_str()),
            Some("recipient@example.com")
        );
        assert_eq!(v.get("status").and_then(|x| x.as_str()), Some("active"));
        assert_eq!(v.get("transferable").and_then(|x| x.as_bool()), Some(true));

        let log = v.get("redemptionLog").and_then(|x| x.as_array()).unwrap();
        assert_eq!(log.len(), 1);
        assert!((log[0].get("amount").and_then(|x| x.as_f64()).unwrap() - 250.0).abs() < 1e-6);

        let back: GiftCard = serde_json::from_value(v).expect("deserialize GiftCard");
        assert_eq!(back.code, "GC-ABCD-1234");
        assert!((back.balance - 750.0).abs() < 1e-6);
        assert_eq!(back.redemption_log.len(), 1);
        assert_eq!(back.status, "active");
    }
}
