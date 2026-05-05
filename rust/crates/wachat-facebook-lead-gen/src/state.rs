//! State bundle for the Facebook Lead Gen domain endpoints.
//!
//! Endpoints need:
//! * Mongo for project lookups (owner check + page-id / access-token reads).
//! * `MetaClient` for Graph API calls against `/{pageId}/leadgen_forms`,
//!   `/{formId}/leads`, and `/{leadId}`.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookLeadGenState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatFacebookLeadGenState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
