//! Platform fee + tax resolution.
//!
//! SabPay charges merchants a platform fee on every **succeeded** payment,
//! mirroring how a gateway like Razorpay deducts MDR + GST before settlement.
//! There is no PayU fee API in play here — these are SabNode's own ledger
//! numbers, stamped onto the payment at finalize-success time and summed by the
//! settlement runner.
//!
//! Defaults come from env; a merchant may override the fee rate via `feeBps` on
//! their `sabpay_merchants` doc. Tax (18% GST) always applies to the fee.

use bson::{Document, oid::ObjectId};
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;

use crate::store::{self, num_opt_i64};

/// Default platform fee in basis points (2.00%).
const DEFAULT_FEE_BPS: i64 = 200;
/// GST on the fee, in basis points of the fee (18.00%).
const DEFAULT_FEE_TAX_BPS: i64 = 1800;

fn env_bps(key: &str, default: i64) -> i64 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.trim().parse::<i64>().ok())
        .filter(|n| *n >= 0 && *n <= 10_000)
        .unwrap_or(default)
}

/// Fee + tax (both in paise) for an amount, given the resolved fee rate.
#[derive(Debug, Clone, Copy)]
pub struct FeeBreakdown {
    pub fee: i64,
    pub tax: i64,
}

impl FeeBreakdown {
    /// fee + tax — the total deducted before settlement.
    pub fn total(&self) -> i64 {
        self.fee + self.tax
    }
}

/// Resolve the fee rate (bps) for a merchant: their override or the platform
/// default. `merchant_doc` is the optional `sabpay_merchants` doc.
pub fn fee_bps_for(merchant_doc: Option<&Document>) -> i64 {
    let default = env_bps("SABPAY_FEE_BPS", DEFAULT_FEE_BPS);
    merchant_doc
        .and_then(|d| num_opt_i64(d, "feeBps"))
        .filter(|n| *n >= 0 && *n <= 10_000)
        .unwrap_or(default)
}

/// Compute fee + GST for `amount` paise at `fee_bps`.
pub fn compute(amount: i64, fee_bps: i64) -> FeeBreakdown {
    let amount = amount.max(0);
    let fee = (amount.saturating_mul(fee_bps)) / 10_000;
    let tax_bps = env_bps("SABPAY_FEE_TAX_BPS", DEFAULT_FEE_TAX_BPS);
    let tax = (fee.saturating_mul(tax_bps)) / 10_000;
    FeeBreakdown { fee, tax }
}

/// Convenience: load the merchant doc and compute the fee for an amount.
pub async fn compute_for_user(
    mongo: &MongoHandle,
    uid: ObjectId,
    amount: i64,
) -> Result<FeeBreakdown> {
    let merchant = store::get_merchant_doc(mongo, uid).await?;
    Ok(compute(amount, fee_bps_for(merchant.as_ref())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    #[test]
    fn default_fee_is_two_percent_plus_gst() {
        // ₹100.00 = 10000 paise at 2% → ₹2.00 fee, 18% GST on the fee → ₹0.36.
        let f = compute(10_000, 200);
        assert_eq!(f.fee, 200);
        assert_eq!(f.tax, 36);
        assert_eq!(f.total(), 236);
    }

    #[test]
    fn zero_amount_has_no_fee() {
        let f = compute(0, 200);
        assert_eq!(f.fee, 0);
        assert_eq!(f.tax, 0);
    }

    #[test]
    fn merchant_override_takes_precedence() {
        let d = doc! { "feeBps": 100_i64 };
        assert_eq!(fee_bps_for(Some(&d)), 100);
        // Out-of-range overrides are ignored (fall back to the platform default).
        let bad = doc! { "feeBps": 20_000_i64 };
        assert_eq!(fee_bps_for(Some(&bad)), DEFAULT_FEE_BPS);
        assert_eq!(fee_bps_for(None), DEFAULT_FEE_BPS);
    }
}
