//! State slice consumed by the SabChat business-hours router.
//!
//! The handlers only need a Mongo handle today — every endpoint is
//! pure CRUD over `sabchat_business_hours_calendars` or read-only
//! traversal of `sabchat_inboxes` + `crm_holidays`.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the business-hours router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatBusinessHoursState {
    pub mongo: MongoHandle,
}

impl SabChatBusinessHoursState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
