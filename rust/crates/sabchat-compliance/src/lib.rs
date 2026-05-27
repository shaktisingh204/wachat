//! # sabchat-compliance
//!
//! Phase — axum router that mounts the GDPR / India DPDP / CCPA toolkit
//! for SabChat under `/v1/sabchat/compliance`:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/compliance",
//!     sabchat_compliance::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! Three sub-surfaces, all tenant-scoped via the JWT (`tid` claim):
//!
//! | Surface              | Routes                                                          |
//! |----------------------|-----------------------------------------------------------------|
//! | Data Subject Requests | `POST /dsr`, `GET /dsr`, `GET /dsr/{id}`, `POST /dsr/{id}/run` |
//! | Retention rules      | `POST/GET/PATCH/DELETE /retention[/{id}]`, `POST /retention/sweep` |
//! | PII utilities        | `POST /redact-text`                                             |
//!
//! ### Data subject requests
//!
//! `POST /dsr` records a `pending` row in `sabchat_dsr_requests` for the
//! given contact. Execution is deferred to `POST /dsr/{id}/run` so an
//! operator (or a sweep job) can drive long-running jobs out of the
//! request path:
//!
//! - `kind = "export"` aggregates the [`SabChatContact`] row, all
//!   conversations, and all messages for the contact into a single
//!   blob, writes it to the `sabchat_dsr_exports` collection, and
//!   stamps the request with the resulting `payloadId`.
//! - `kind = "delete"` redacts PII in place: the contact's `name`,
//!   `emails`, `phones`, `socialIds` are scrubbed; every related
//!   message's `content` is rewritten to a
//!   [`ContentBlock::System { text: "[redacted]" }`].
//!
//! Both terminal states flip the row to `status = "done"` and stamp
//! `completed_at`; failures land in `status = "failed"` with the error
//! message captured for the operator.
//!
//! ### Retention rules
//!
//! Standard CRUD over `sabchat_retention_rules`. The `sweep` endpoint
//! walks every **active** rule for the tenant, computes a cutoff
//! `Utc::now() - older_than_days`, and runs a tenant-scoped
//! `delete_many` against the rule's `target` collection. Returns a
//! per-rule `{ ruleId, deleted }` summary so a scheduler can log a
//! delta.
//!
//! ### PII redactor
//!
//! [`redact_pii`] is exported as a free function so other SabChat
//! crates can scrub strings before logging without paying the cost of
//! a HTTP round trip. The `POST /redact-text` endpoint is a thin wrapper
//! around it for one-off use from the dashboard.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatComplianceState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod redact;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
};
use sabnode_auth::AuthConfig;

pub use redact::redact_pii;
pub use state::SabChatComplianceState;

// ---------------------------------------------------------------------------
// Collection names — kept centralised here so handler modules can import
// the canonical strings and the surrounding documentation tracks every
// Mongo namespace the crate touches.
// ---------------------------------------------------------------------------

/// `sabchat_dsr_requests` — one row per inbound data-subject request
/// (export or delete). Rows progress through
/// `pending → running → done | failed` over their lifetime.
pub const DSR_REQUESTS_COLL: &str = "sabchat_dsr_requests";

/// `sabchat_dsr_exports` — one row per executed export. Stores the
/// full aggregated payload as a single document so the request row
/// stays small.
pub const DSR_EXPORTS_COLL: &str = "sabchat_dsr_exports";

/// `sabchat_retention_rules` — tenant-defined retention policy rows.
/// One row per `target` collection per `older_than_days` cutoff.
pub const RETENTION_RULES_COLL: &str = "sabchat_retention_rules";

/// `sabchat_contacts` — read + mutate target for export / delete runs.
pub const CONTACTS_COLL: &str = "sabchat_contacts";

/// `sabchat_conversations` — read target for export runs; also a
/// retention sweep target.
pub const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// `sabchat_messages` — read + mutate target for export / delete runs;
/// also a retention sweep target.
pub const MESSAGES_COLL: &str = "sabchat_messages";

/// `sabchat_events` — retention sweep target (channel webhooks / system
/// events). Not directly read here, just pruned.
pub const EVENTS_COLL: &str = "sabchat_events";

/// `sabchat_audit_log` — retention sweep target.
pub const AUDIT_LOG_COLL: &str = "sabchat_audit_log";

/// Build the SabChat compliance router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/compliance`):
///
/// ```text
/// // Data subject requests
/// POST   /dsr
/// GET    /dsr
/// GET    /dsr/{id}
/// POST   /dsr/{id}/run
///
/// // Retention rules
/// POST   /retention
/// GET    /retention
/// PATCH  /retention/{id}
/// DELETE /retention/{id}
/// POST   /retention/sweep
///
/// // PII utility
/// POST   /redact-text
/// ```
///
/// `S` is the caller's outer application state. Handlers need a
/// [`SabChatComplianceState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know about
/// a concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/dsr/{id}/run` segment is
/// registered before the catch-all `/dsr/{id}` so axum's matcher
/// prefers the deeper path. Same logic applies to `/retention/sweep`
/// vs `/retention/{id}`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatComplianceState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- DSR --------------------------------------------------------
        .route("/dsr", post(handlers::create_dsr).get(handlers::list_dsr))
        // Deeper literal first so `/run` is preferred over the `{id}` catch-all.
        .route("/dsr/{id}/run", post(handlers::run_dsr))
        .route("/dsr/{id}", get(handlers::get_dsr))
        // ---- Retention rules -------------------------------------------
        .route(
            "/retention",
            post(handlers::create_retention_rule).get(handlers::list_retention_rules),
        )
        // Literal `/sweep` before the `{id}` catch-all.
        .route("/retention/sweep", post(handlers::sweep_retention))
        .route(
            "/retention/{id}",
            patch(handlers::update_retention_rule).delete(handlers::delete_retention_rule),
        )
        // ---- PII utility -----------------------------------------------
        .route("/redact-text", post(handlers::redact_text))
}
