//! # wachat-contacts-export-sync
//!
//! Axum router backing the "Export CSV" button and "Sync Contacts"
//! dialog on `/wachat/contacts`. Mounted under
//! `/v1/wachat/contacts-export-sync` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/wachat/contacts-export-sync",
//!     wachat_contacts_export_sync::router::<AppState>(),
//! )
//! ```
//!
//! ## Routes
//!
//! | Route                  | Action                                       |
//! |------------------------|----------------------------------------------|
//! | `GET  /export`         | stream ALL matching contacts as CSV (local)  |
//! | `POST /sync/vcard`     | parse a vCard + bulk-upsert contacts (local) |
//! | `POST /sync/google`    | Google Contacts sync — **gated** (ext. seam) |
//! | `POST /sync/shopify`   | Shopify Customers sync — **gated** (ext. seam)|
//!
//! ## Local vs external
//!
//! CSV export and vCard parsing are fully **local** — no third-party
//! dependency. The Google / Shopify syncs go through the isolated
//! [`external`] seam, which requires stored OAuth / integration
//! credentials and **degrades to a typed `ApiError::BadRequest`
//! ("<Provider> not connected")** when they are absent (the current
//! state). No provider SDK is linked and no socket is opened without
//! credentials; the crate compiles and routes with no live creds.
//!
//! ## Two-store gotcha
//!
//! Handlers read and write the **real** `contacts` collection (NOT
//! `wa_contacts`), so exported / synced rows are exactly the ones the
//! contacts list shows.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`; it pulls a
//! [`WachatContactsExportSyncState`] (a Mongo handle) and the JWT
//! verifier `Arc<AuthConfig>` via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod external;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatContactsExportSyncState;

/// Build the contacts export + sync router (caller nests under
/// `/v1/wachat/contacts-export-sync`).
///
/// ```text
/// GET  /export        — export_csv   (stream CSV)
/// POST /sync/vcard    — sync_vcard   (local)
/// POST /sync/google   — sync_google  (gated)
/// POST /sync/shopify  — sync_shopify (gated)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatContactsExportSyncState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/export", get(handlers::export_csv))
        .route("/sync/vcard", post(handlers::sync_vcard))
        .route("/sync/google", post(handlers::sync_google))
        .route("/sync/shopify", post(handlers::sync_shopify))
}
