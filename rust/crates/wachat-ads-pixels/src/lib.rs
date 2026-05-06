//! # wachat-ads-pixels
//!
//! Ports the **Pixels + Conversions API + Offline Events + Lead Gen +
//! Catalogs** slice of `src/app/actions/ad-manager.actions.ts` to a Rust BFF
//! surface. The handlers in this crate cover:
//!
//! * Pixels: `listPixels`, `createPixel`, `getPixelStats`,
//!   `sharePixelWithAdAccount`.
//! * Custom conversions: `listCustomConversions`, `createCustomConversion`.
//! * Conversions API + offline events: `sendConversionApiEvent`,
//!   `listOfflineEventSets`, `uploadOfflineEvents`.
//! * Lead Gen: `listLeadGenForms`, `getLeadsFromForm`.
//! * Catalogs / Product sets: `listCatalogs`, `listProductSets`,
//!   `createProductSet`.
//!
//! Mount under `/v1/ads/pixels` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/ads/pixels", wachat_ads_pixels::router::<AppState>())
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
//! header (which Meta accepts equivalently).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatAdsPixelsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAdsPixelsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Pixels
        .route(
            "/ad-accounts/{ad_account_id}/pixels",
            get(handlers::list_pixels).post(handlers::create_pixel),
        )
        .route("/pixels/{pixel_id}/stats", get(handlers::get_pixel_stats))
        .route(
            "/pixels/{pixel_id}/share",
            post(handlers::share_pixel_with_ad_account),
        )
        .route(
            "/pixels/{pixel_id}/events",
            post(handlers::send_conversion_api_event),
        )
        // Custom conversions
        .route(
            "/ad-accounts/{ad_account_id}/custom-conversions",
            get(handlers::list_custom_conversions).post(handlers::create_custom_conversion),
        )
        // Offline event data sets
        .route(
            "/ad-accounts/{ad_account_id}/offline-event-sets",
            get(handlers::list_offline_event_sets),
        )
        .route(
            "/offline-event-sets/{data_set_id}/events",
            post(handlers::upload_offline_events),
        )
        // Lead Gen
        .route(
            "/pages/{page_id}/leadgen-forms",
            get(handlers::list_lead_gen_forms),
        )
        .route(
            "/leadgen-forms/{form_id}/leads",
            get(handlers::get_leads_from_form),
        )
        // Catalogs / Product sets
        .route(
            "/businesses/{business_id}/catalogs",
            get(handlers::list_catalogs),
        )
        .route(
            "/catalogs/{catalog_id}/product-sets",
            get(handlers::list_product_sets).post(handlers::create_product_set),
        )
}
