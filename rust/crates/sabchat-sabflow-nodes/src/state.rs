//! State slice consumed by the SabChat → SabFlow bridge router.
//!
//! Handlers only need a Mongo handle today — every action endpoint is a
//! direct write against the `sabchat_conversations` / `sabchat_messages`
//! / `sabchat_macros` / `sabchat_audit_log` collections, and the
//! `GET /nodes` endpoint is a pure descriptor render.
//!
//! Per the slice contract we **do not** depend on
//! `sabchat-conversations` / `sabchat-messages` / `sabchat-macros`. The
//! few Mongo writes needed by `/actions/*` are inlined in
//! [`crate::handlers`] so the bridge stays a leaf.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the bridge router needs. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatSabflowNodesState {
    pub mongo: MongoHandle,
}

impl SabChatSabflowNodesState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
