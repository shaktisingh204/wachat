//! State slice consumed by the SabChat cart-recovery routers.
//!
//! Handlers only need a Mongo handle today — every cart-recovery
//! operation is straight Mongo I/O over `sabchat_carts`,
//! `sabchat_cart_recovery_rules`, `sabchat_cart_recovery_triggers`, and
//! the read-only `sabchat_inboxes` collection (consulted to resolve a
//! visitor's tenant from the inbox they posted from). Any future caching
//! layer would move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the cart-recovery routers need. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatCartRecoveryState {
    pub mongo: MongoHandle,
}

impl SabChatCartRecoveryState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
