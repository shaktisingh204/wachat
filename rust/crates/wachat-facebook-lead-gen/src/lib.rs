//! # wachat-facebook-lead-gen
//!
//! Ports the **Facebook Lead Generation forms & leads** slice of
//! `src/app/actions/facebook.actions.ts` to a Rust BFF surface. Three
//! handlers cover form listing, leads-per-form enumeration, and single-lead
//! fetch — the legacy stubs `getLeadGenForms`, `getLeadsForForm`, and
//! `getLeadById`. Function shapes were recovered from git history (commit
//! `a3d8ff38`) where the actions were a thin wrapper over the Facebook
//! Graph API v23.0.
//!
//! Mount under `/v1/facebook/lead-gen` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/lead-gen", wachat_facebook_lead_gen::router::<AppState>())
//! ```
//!
//! ## Auth
//!
//! All handlers extract a [`sabnode_auth::AuthUser`] from the JWT and call
//! [`handlers::load_project_for`] to confirm the caller owns the target
//! project before any Graph API call — mirroring the `getProjectById`
//! access check in the TS originals.
//!
//! ## Graph API client
//!
//! Outbound Graph API traffic goes through [`wachat_meta_client::MetaClient`].
//! The TS originals call `axios.get` with `?access_token=…` query
//! parameters; we instead pass the token via the `Authorization: Bearer`
//! header (which Meta accepts equivalently).
//!
//! ## Routes
//!
//! | Method | Path                                                | Handler                              |
//! |--------|-----------------------------------------------------|--------------------------------------|
//! | GET    | `/projects/{project_id}/forms`                      | `getLeadGenForms`                    |
//! | GET    | `/forms/{form_id}/leads?projectId={…}`              | `getLeadsForForm`                    |
//! | GET    | `/leads/{lead_id}?projectId={…}`                    | `getLeadById`                        |
//! | POST   | `/process-webhook`                                  | `process_webhook` (internal, JWT)    |
//! | GET    | `/config`                                           | `get_config`                         |
//! | POST   | `/config`                                           | `upsert_config`                      |
//! | DELETE | `/config/{form_id}`                                 | `delete_form`                        |
//! | GET    | `/config/forms`                                     | `list_config_forms`                  |
//! | GET    | `/activity`                                         | `get_activity`                       |

pub mod config_handlers;
pub mod dto;
pub mod handlers;
pub mod state;
pub mod webhook_handler;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookLeadGenState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookLeadGenState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Legacy project-scoped form/lead reads
        .route(
            "/projects/{project_id}/forms",
            get(handlers::get_lead_gen_forms),
        )
        .route("/forms/{form_id}/leads", get(handlers::get_leads_for_form))
        .route("/leads/{lead_id}", get(handlers::get_lead_by_id))
        // CRM integration — webhook processing (called by Next.js webhook route)
        .route("/process-webhook", post(webhook_handler::process_webhook))
        // CRM integration — config CRUD
        .route("/config", get(config_handlers::get_config))
        .route("/config", post(config_handlers::upsert_config))
        .route("/config/{form_id}", delete(config_handlers::delete_form))
        .route("/config/forms", get(config_handlers::list_config_forms))
        // CRM integration — activity log
        .route("/activity", get(config_handlers::get_activity))
}
