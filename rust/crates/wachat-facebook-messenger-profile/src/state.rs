//! State bundle for the Messenger Profile / Personas / Saved Responses domain.
//!
//! Endpoints in this crate need:
//! * Mongo for project lookups (owner-based access checks).
//! * `MetaClient` for Graph API calls against Messenger Profile, personas,
//!   saved message responses, and reusable message attachments.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookMessengerProfileState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookMessengerProfileState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
