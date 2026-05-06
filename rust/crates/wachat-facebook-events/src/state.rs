//! State bundle for the Facebook Events domain endpoints.
//!
//! Endpoints need:
//! * Mongo for project ownership lookups.
//! * `MetaClient` for outbound Graph API calls (`/{pageId}/events`,
//!   `/{eventId}`, `/{eventId}/{rsvpStatus}`).

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookEventsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookEventsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
