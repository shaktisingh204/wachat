//! State slice consumed by the SabChat commerce router.
//!
//! Handlers only need a Mongo handle today — the commerce endpoints are
//! pure I/O against `crm_items` / `shop` (read) and
//! `sabchat_payment_requests` / `sabchat_messages` / `sabchat_audit_log`
//! (write). Any future per-provider client (Razorpay SDK, Stripe SDK,
//! UPI deep-link signer) will move in here so callers don't have to
//! thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the commerce router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCommerceState {
    pub mongo: MongoHandle,
}

impl SabChatCommerceState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
