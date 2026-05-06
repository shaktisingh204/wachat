//! HTTP handlers for the broadcast-counter endpoint.
//!
//! Single endpoint:
//!
//! `POST /v1/wachat/webhook-status/broadcast-statuses`
//!
//! Request body (JSON):
//!
//! ```json
//! {
//!   "statuses": [
//!     { "id": "wamid.HBgL...", "status": "delivered", "timestamp": "1717000000" },
//!     { "id": "wamid.HBgL...", "status": "read",      "timestamp": "1717000010" }
//!   ]
//! }
//! ```
//!
//! Response body (JSON):
//!
//! ```json
//! {
//!   "ok": true,
//!   "outcome": {
//!     "contactsUpdated": 2,
//!     "deliveredInc": 1,
//!     "readInc": 1,
//!     "unmatched": 0
//!   }
//! }
//! ```
//!
//! ## Why only broadcast counters
//!
//! The Node webhook receiver still owns the Meta `outgoing_messages` write
//! today — that path is well-trodden and not on the critical path for the
//! broadcast-worker cutover. We keep it on Node and only migrate the
//! broadcast-side counters here, which is the slice the new Rust
//! broadcast worker actually competes with.
//!
//! ## Auth
//!
//! Every call uses [`AuthUser`]. The Node call site mints a server-to-server
//! JWT via `rustFetch` (see `src/lib/rust-client/fetcher.ts`), so this
//! endpoint is server-only — there is no anonymous access.

use axum::{Json, extract::State};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use tracing::{debug, instrument};

use crate::broadcast::{BroadcastStatusOutcome, StatusInput};
use crate::state::WachatWebhookStatusState;

/// Request body. Open-ended on purpose — extra fields on individual
/// statuses (`recipient_id`, `errors`, ...) are accepted and ignored.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BroadcastStatusesBody {
    /// Subset of the Meta webhook `value.statuses[]` payload. The Node
    /// receiver forwards these verbatim after parsing; we accept any
    /// length (empty is a no-op).
    pub statuses: Vec<StatusInput>,
}

/// Success envelope. Matches the `{ ok: true, ... }` style used by the
/// other Rust handlers — keeps the response shape predictable for the TS
/// client wrapper.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastStatusesResponse {
    pub ok: bool,
    pub outcome: BroadcastStatusOutcome,
}

/// `POST /v1/wachat/webhook-status/broadcast-statuses`.
///
/// Applies broadcast-counter side effects for a batch of Meta status
/// webhook entries. Idempotent: the underlying writer only applies a
/// `broadcast_contacts.status` change when the new status strictly
/// outranks the current one (see [`crate::broadcast`]).
#[instrument(skip_all, fields(user = %user.user_id, n = body.statuses.len()))]
pub async fn broadcast_statuses(
    user: AuthUser,
    State(state): State<WachatWebhookStatusState>,
    Json(body): Json<BroadcastStatusesBody>,
) -> Result<Json<BroadcastStatusesResponse>> {
    if body.statuses.is_empty() {
        return Ok(Json(BroadcastStatusesResponse {
            ok: true,
            outcome: BroadcastStatusOutcome::default(),
        }));
    }

    let outcome = state
        .broadcast
        .process(&body.statuses)
        .await
        .map_err(|e| match e {
            ApiError::Internal(err) => ApiError::Internal(err.context("broadcast_statuses")),
            other => other,
        })?;

    debug!(
        contacts_updated = outcome.contacts_updated,
        delivered_inc = outcome.delivered_inc,
        read_inc = outcome.read_inc,
        unmatched = outcome.unmatched,
        "broadcast-counter batch applied",
    );

    Ok(Json(BroadcastStatusesResponse { ok: true, outcome }))
}
