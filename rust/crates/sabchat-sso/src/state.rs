//! State slice consumed by the SabChat SSO + SCIM routers.
//!
//! Handlers only need a Mongo handle today — the SSO config CRUD, SCIM
//! token CRUD, and SCIM 2.0 user/group endpoints all live on top of four
//! collections (`sabchat_sso_configs`, `sabchat_scim_tokens`, `users`,
//! `sabchat_teams`). Any future signing-key cache or SAML metadata
//! cache will move in here so callers don't have to thread it.

use sabnode_db::mongo::MongoHandle;

/// Bundle of handles the SSO routers need. Cheap to clone — the
/// underlying `MongoHandle` is `Arc`-backed.
#[derive(Clone)]
pub struct SabChatSsoState {
    pub mongo: MongoHandle,
}

impl SabChatSsoState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
