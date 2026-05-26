//! # sabchat-ad-attribution
//!
//! Closes the ad → chat → revenue loop for the SabChat module.
//!
//! Tenants tag their inbound traffic with UTM parameters, Meta's
//! `ctwa_clid` (Click-to-WhatsApp click id), Google's `gclid`, or
//! Facebook's `fbclid`. The widget (or any channel webhook) records a
//! **touch** row when a visitor lands; once the visitor becomes a
//! conversation the most recent touch is bound to it; once a payment
//! lands the conversation's touch absorbs the revenue and the rollups
//! in `/report` light up.
//!
//! Mounted under **two** prefixes from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/ad-attribution",        sabchat_ad_attribution::router::<AppState>())
//! .nest("/v1/sabchat/ad-attribution-public", sabchat_ad_attribution::public_router::<AppState>())
//! ```
//!
//! ## Why two routers
//!
//! The agent / admin surface is fully authenticated and scoped by
//! `tenant_id` taken from the JWT. The visitor surface — used by the
//! widget when the user first lands — is anonymous (no `AuthUser`). It
//! recovers the tenant by joining on the inbox row (`sabchat_inboxes`)
//! since the inbox id is already public knowledge (it ships embedded in
//! the widget snippet). Keeping the routers separate means the JWT
//! middleware on the api crate doesn't have to know which routes are
//! exempt.
//!
//! ## Routes — agent / admin (`/v1/sabchat/ad-attribution`)
//!
//! | Method | Path                          | Handler              |
//! |--------|-------------------------------|----------------------|
//! | GET    | `/touches`                    | `list_touches`       |
//! | GET    | `/touches/{id}`               | `get_touch`          |
//! | POST   | `/attribute-revenue`          | `attribute_revenue`  |
//! | GET    | `/report`                     | `report`             |
//!
//! ## Routes — public visitor (`/v1/sabchat/ad-attribution-public`)
//!
//! | Method | Path        | Handler              |
//! |--------|-------------|----------------------|
//! | POST   | `/touch`    | `public_touch`       |
//!
//! ## Collections
//!
//! - [`TOUCHES_COLL`] — `sabchat_ad_touches`. One row per visitor
//!   landing. Carries the campaign / ad / UTM blob, the click ids, the
//!   landing URL, the bound `conversation_id` / `contact_id` once the
//!   visitor enters the inbox, and the rolling `attributed_revenue_minor`
//!   counter.
//! - [`REVENUE_COLL`] — `sabchat_ad_revenue_attributions`. Append-only
//!   ledger — one row per payment attributed back to a touch.
//!
//! ## State contract
//!
//! Both [`router`] and [`public_router`] are generic over the caller's
//! outer state `S`. The handlers need:
//!
//! - a [`SabChatAdAttributionState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (only the agent router consumes
//!   `AuthUser` — the public router does not need it).
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so the
//! routers stay decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod public_handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatAdAttributionState;

/// Mongo collection that stores visitor touches. Exposed `pub(crate)`
/// so both the handlers and the public handler agree on the name.
pub(crate) const TOUCHES_COLL: &str = "sabchat_ad_touches";

/// Mongo collection that stores the revenue-attribution ledger.
pub(crate) const REVENUE_COLL: &str = "sabchat_ad_revenue_attributions";

/// Mongo collection that stores inbox rows (read on the public path to
/// resolve the inbox → tenant join without trusting client input).
pub(crate) const INBOXES_COLL: &str = "sabchat_inboxes";

/// Mongo collection that stores conversations (read on the
/// `attribute-revenue` path to bind a conversation to its most recent
/// touch).
pub(crate) const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Build the agent / admin SabChat ad-attribution router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/ad-attribution`):
///
/// ```text
/// GET    /touches                        — list_touches
/// GET    /touches/{id}                   — get_touch
/// POST   /attribute-revenue              — attribute_revenue
/// GET    /report                         — report
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAdAttributionState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/touches", get(handlers::list_touches))
        .route("/touches/{id}", get(handlers::get_touch))
        .route("/attribute-revenue", post(handlers::attribute_revenue))
        .route("/report", get(handlers::report))
}

/// Build the **public-visitor** SabChat ad-attribution router.
///
/// Mounted at `/v1/sabchat/ad-attribution-public`. No [`AuthUser`] is
/// consumed by any handler in this router — the tenant is recovered by
/// looking the inbox up in `sabchat_inboxes` and reading
/// `inbox.tenant_id`. The widget already knows the inbox id (it's in
/// the embed snippet), but the tenant id is *never* trusted from the
/// request body.
///
/// Routes (mounted relative):
///
/// ```text
/// POST   /touch                          — public_touch
/// ```
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAdAttributionState: FromRef<S>,
{
    Router::new().route("/touch", post(public_handlers::public_touch))
}
