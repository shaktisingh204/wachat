//! State bundle for the Facebook misc-domain endpoints.
//!
//! These handlers need:
//! * Mongo for the project-tenancy access check and the `fb_competitors`
//!   CRUD collection.
//! * `MetaClient` for Graph API metadata fetches (subscribed apps,
//!   blocked-profiles list, messaging feature review, publishing-auth
//!   status, competitor metadata).

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookMiscState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookMiscState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
