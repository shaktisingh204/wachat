//! State slice consumed by the SabChat shifts router.
//!
//! Handlers only need a Mongo handle today — the shift-rule CRUD plus the
//! HRM-aware sync are pure Mongo I/O over three collections
//! (`sabchat_shift_rules`, `crm_attendance`, `crm_employees`) and one
//! write target (`sabchat_agent_presence`). Any future per-tenant cache
//! of compiled rules will move in here so callers don't have to thread
//! it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the shifts router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatShiftsState {
    pub mongo: MongoHandle,
}

impl SabChatShiftsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
