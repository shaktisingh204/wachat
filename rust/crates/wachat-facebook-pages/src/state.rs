//! State bundle for the Facebook Pages domain endpoints.
//!
//! Endpoints need:
//! * Mongo for project lookups + token writes (refresh token persistence,
//!   manual setup project insert, OAuth-callback projects upsert).
//! * `MetaClient` for Graph API calls.
//! * The Facebook app id / secret + `NEXT_PUBLIC_APP_URL` for the OAuth
//!   callback exchange and `debug_token` introspection.

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

#[derive(Clone)]
pub struct WachatFacebookPagesState {
    pub mongo: MongoHandle,
    pub meta: MetaClient,
    pub config: FacebookAppConfig,
}

/// Facebook OAuth + debug-token credentials. These are the four `process.env.*`
/// values the original TS server actions read directly. The API binary reads
/// them from its environment once at startup and threads them through here.
///
/// Defaults are empty strings so that handlers can detect "not configured" and
/// surface the same error message the TS code does.
#[derive(Clone, Default, Debug)]
pub struct FacebookAppConfig {
    /// `NEXT_PUBLIC_FACEBOOK_APP_ID`.
    pub facebook_app_id: String,
    /// `FACEBOOK_APP_SECRET`.
    pub facebook_app_secret: String,
    /// `NEXT_PUBLIC_META_ONBOARDING_APP_ID` — the Embedded-Signup app that
    /// initiates the WhatsApp onboarding OAuth dialog. The `whatsapp` state
    /// must exchange its code against this app, not the Meta-Suite app.
    pub onboarding_app_id: String,
    /// `META_ONBOARDING_APP_SECRET`.
    pub onboarding_app_secret: String,
    /// `NEXT_PUBLIC_APP_URL` — used to derive the redirect URI.
    pub app_url: String,
}

impl WachatFacebookPagesState {
    pub fn new(mongo: MongoHandle, meta: MetaClient, config: FacebookAppConfig) -> Self {
        Self {
            mongo,
            meta,
            config,
        }
    }
}
