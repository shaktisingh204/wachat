//! State bundle for the Ad Accounts & Business endpoints.
//!
//! Endpoints need:
//! * Mongo for user-doc lookups (`adManagerAccessToken`,
//!   `metaSuiteAccessToken`, `metaAdAccounts`) and for the
//!   `deleteAdAccount` `$pull` against `users.metaAdAccounts`.
//! * `MetaClient` for outbound Graph API calls.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatAdsAccountsState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
}

impl WachatAdsAccountsState {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }
}
