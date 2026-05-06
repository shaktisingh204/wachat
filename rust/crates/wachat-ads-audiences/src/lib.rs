//! # wachat-ads-audiences
//!
//! Ports the **Audiences + Targeting + Reach** slice of
//! `src/app/actions/ad-manager.actions.ts` to a Rust BFF surface. The
//! handlers in this crate cover:
//!
//! * Custom audiences: `getCustomAudiences`, `createCustomAudience`,
//!   `createLookalikeAudience`, `deleteCustomAudience`,
//!   `addUsersToCustomAudience`, `removeUsersFromCustomAudience`,
//!   `shareCustomAudience`, `listSharedAudienceAccounts`,
//!   `createWebsiteRetargetingAudience`.
//! * Saved audiences: `getSavedAudiences`, `createSavedAudience`,
//!   `deleteSavedAudience`.
//! * Targeting search & introspection: `searchTargeting`, `browseTargeting`,
//!   `suggestTargeting`, `validateTargeting`, `getTargetingSentenceLines`.
//! * Reach + delivery: `getReachEstimate`, `getDeliveryEstimate`,
//!   `createReachFrequencyPrediction`, `listReachFrequencyPredictions`.
//!
//! Mount under `/v1/ads/audiences` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/ads/audiences", wachat_ads_audiences::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and look
//! up the user's `adManagerAccessToken` from the `users` collection — this
//! mirrors the `requireToken()` helper at the top of the TS module which
//! reads the token off the session.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.request` with `?access_token=…` query
//! parameters; we instead pass the token via the `Authorization: Bearer`
//! header (which Meta accepts equivalently). For the two endpoints that
//! need a HTTP DELETE with a body (`removeUsersFromCustomAudience`), the
//! payload is forwarded as a `?payload=…` query string instead — Graph
//! accepts both forms equivalently.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatAdsAudiencesState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAdsAudiencesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---------------- Custom audiences ----------------
        .route(
            "/ad-accounts/{ad_account_id}/custom-audiences",
            get(handlers::get_custom_audiences).post(handlers::create_custom_audience),
        )
        .route(
            "/ad-accounts/{ad_account_id}/lookalike-audiences",
            post(handlers::create_lookalike_audience),
        )
        .route(
            "/ad-accounts/{ad_account_id}/website-retargeting-audiences",
            post(handlers::create_website_retargeting_audience),
        )
        .route(
            "/custom-audiences/{audience_id}",
            delete(handlers::delete_custom_audience),
        )
        .route(
            "/custom-audiences/{audience_id}/users",
            post(handlers::add_users_to_custom_audience)
                .delete(handlers::remove_users_from_custom_audience),
        )
        .route(
            "/custom-audiences/{audience_id}/share",
            post(handlers::share_custom_audience).get(handlers::list_shared_audience_accounts),
        )
        // ---------------- Saved audiences ----------------
        .route(
            "/ad-accounts/{ad_account_id}/saved-audiences",
            get(handlers::get_saved_audiences).post(handlers::create_saved_audience),
        )
        .route(
            "/saved-audiences/{audience_id}",
            delete(handlers::delete_saved_audience),
        )
        // ---------------- Targeting search ----------------
        .route("/targeting/search", get(handlers::search_targeting))
        .route("/targeting/browse", get(handlers::browse_targeting))
        .route("/targeting/suggest", post(handlers::suggest_targeting))
        .route("/targeting/validate", post(handlers::validate_targeting))
        .route(
            "/ad-accounts/{ad_account_id}/targeting-sentence-lines",
            post(handlers::get_targeting_sentence_lines),
        )
        // ---------------- Reach / delivery ----------------
        .route(
            "/ad-accounts/{ad_account_id}/reach-estimate",
            post(handlers::get_reach_estimate),
        )
        .route(
            "/ad-accounts/{ad_account_id}/delivery-estimate",
            post(handlers::get_delivery_estimate),
        )
        .route(
            "/ad-accounts/{ad_account_id}/reach-frequency-predictions",
            get(handlers::list_reach_frequency_predictions)
                .post(handlers::create_reach_frequency_prediction),
        )
}
