//! # wachat-ads-accounts
//!
//! Ports the **Ad Accounts & Business** slice of
//! `src/app/actions/ad-manager.actions.ts` to a Rust BFF surface. This
//! is the foundation crate of the ad-manager port — many other ad
//! clusters (campaigns, ad sets, ads, creatives, audiences, insights)
//! resolve their `adManagerAccessToken` and ad-account ids through the
//! handlers exposed here.
//!
//! Mount under `/v1/ads/accounts` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/ads/accounts", wachat_ads_accounts::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and
//! load the caller's user document via [`handlers::load_user_doc`].
//! Tokens are read from the user doc's `adManagerAccessToken` (most
//! ad-manager actions) or `metaSuiteAccessToken` (the page+IG
//! discovery helpers used by the creative wizard).
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.get/post` with `?access_token=…`; we
//! pass the token via the `Authorization: Bearer` header (which Meta
//! accepts equivalently). Field selectors and query parameters are
//! url-encoded into the `path` argument so the same call sites work
//! across `MetaClient::get_json` / `post_json`.
//!
//! ## Function map
//!
//! | TS export | HTTP route |
//! |---|---|
//! | `getAdAccounts` | `GET /` |
//! | `getAdAccountDetails` | `GET /:ad_account_id` |
//! | `deleteAdAccount` | `DELETE /:ad_account_id` |
//! | `getAdAccountSpend` | `GET /:ad_account_id/spend` |
//! | `getAdAccountCapabilities` | `GET /:ad_account_id/capabilities` |
//! | `getAdAccountActivities` | `GET /:ad_account_id/activities` |
//! | `listAdAccountUsers` | `GET /:ad_account_id/users` |
//! | `listAdAccountAgencies` | `GET /:ad_account_id/agencies` |
//! | `listBusinessInvoices` | `GET /business/:business_id/invoices` |
//! | `listBusinessUsers` | `GET /business/:business_id/users` |
//! | `listBusinessPartners` | `GET /business/:business_id/partners` |
//! | `listExtendedCredits` | `GET /business/:business_id/extended-credits` |
//! | `getFacebookPagesForAdCreation` | `GET /pages` |
//! | `getInstagramAccountsForPage` | `GET /pages/:page_id/instagram-accounts` |
//! | `getInstagramBusinessAccount` | `GET /pages/:page_id/instagram-business` |

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

pub use state::WachatAdsAccountsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatAdsAccountsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // User-level "my ad accounts" + Facebook page discovery for the
        // creative wizard. Literal `/pages` segments are ordered before
        // the dynamic `/{ad_account_id}` catch-all to keep axum happy.
        .route("/", get(handlers::get_ad_accounts))
        .route("/sync", post(handlers::sync_ad_accounts))
        .route("/pages", get(handlers::get_facebook_pages_for_ad_creation))
        .route(
            "/pages/{page_id}/instagram-accounts",
            get(handlers::get_instagram_accounts_for_page),
        )
        .route(
            "/pages/{page_id}/instagram-business",
            get(handlers::get_instagram_business_account),
        )
        // Business-scoped routes (invoices, users, partners, credits).
        .route(
            "/business/{business_id}/invoices",
            get(handlers::list_business_invoices),
        )
        .route(
            "/business/{business_id}/users",
            get(handlers::list_business_users),
        )
        .route(
            "/business/{business_id}/partners",
            get(handlers::list_business_partners),
        )
        .route(
            "/business/{business_id}/extended-credits",
            get(handlers::list_extended_credits),
        )
        // Ad-account-scoped routes.
        .route(
            "/{ad_account_id}",
            get(handlers::get_ad_account_details).delete(handlers::delete_ad_account),
        )
        .route(
            "/{ad_account_id}/spend",
            get(handlers::get_ad_account_spend),
        )
        .route(
            "/{ad_account_id}/capabilities",
            get(handlers::get_ad_account_capabilities),
        )
        .route(
            "/{ad_account_id}/activities",
            get(handlers::get_ad_account_activities),
        )
        .route(
            "/{ad_account_id}/users",
            get(handlers::list_ad_account_users),
        )
        .route(
            "/{ad_account_id}/agencies",
            get(handlers::list_ad_account_agencies),
        )
}
