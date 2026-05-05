//! State bundle consumed by the Facebook automation router.
//!
//! Holds the Mongo handle (every endpoint touches at least one of
//! `projects`, `facebook_broadcasts`, `randomizer_posts`,
//! `facebook_live_streams`), the shared `MetaClient` for the broadcast
//! send path, and a private `reqwest::Client` for the live-stream upload
//! (which targets `graph-video.facebook.com`, a host the shared
//! `MetaClient` deliberately doesn't speak).

use std::time::Duration;

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;

/// Bundle of handles every Facebook automation endpoint needs. Cheap to
/// clone — every field is `Arc`-backed (Mongo wraps an `Arc` internally,
/// `MetaClient` does the same over `reqwest::Client`, and
/// `reqwest::Client` is itself `Arc`-backed).
#[derive(Clone)]
pub struct WachatFacebookAutomationState {
    /// Mongo handle for direct collection access.
    pub mongo: MongoHandle,

    /// Shared retry-aware Meta Graph API client. Used by the broadcast
    /// send path — `POST {pageId or me}/messages`.
    pub meta: MetaClient,

    /// Private `reqwest::Client` reserved for the live-stream multipart
    /// upload to `graph-video.facebook.com`. Kept on state so we don't
    /// rebuild the connection pool per request.
    pub video_http: reqwest::Client,
}

impl WachatFacebookAutomationState {
    /// Construct from a Mongo handle and an existing `MetaClient`. We
    /// build the upload-only `reqwest::Client` here so callers don't have
    /// to thread two clients through their state struct.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        let video_http = reqwest::Client::builder()
            // Live-stream uploads can be larger than the default Meta
            // call — give them a more generous timeout.
            .timeout(Duration::from_secs(300))
            .pool_idle_timeout(Some(Duration::from_secs(90)))
            .user_agent(concat!(
                "sabnode-wachat-facebook-automation/",
                env!("CARGO_PKG_VERSION"),
            ))
            .build()
            .expect("reqwest client must build with default config");
        Self {
            mongo,
            meta,
            video_http,
        }
    }
}
