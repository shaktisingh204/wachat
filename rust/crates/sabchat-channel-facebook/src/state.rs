//! State slice consumed by the SabChat Facebook channel router.
//!
//! Handlers only need a Mongo handle today — ingest is pure CRUD over
//! `sabchat_inboxes`, `sabchat_contacts`, `sabchat_conversations`, and
//! `sabchat_messages`. There is no outbound Graph API call here; the
//! Next.js shim handles all egress.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the Facebook ingest router needs. Cheap to clone —
/// the underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatChannelFacebookState {
    pub mongo: MongoHandle,
}

impl SabChatChannelFacebookState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
