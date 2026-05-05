//! HTTP handlers for the public-API surface.
//!
//! Conventions:
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Auth: [`ApiKeyAuth`] (the API-key extractor). 401 on missing /
//!   invalid / revoked.
//! - Per-project tenancy is enforced after loading the project — the
//!   `project.userId` must match the API key's `tenantId`.
//! - Per-API-key rate-limit runs before scope / project lookups so a
//!   spamming key burns its own bucket and never reaches Mongo.

use axum::{Json, extract::State};
use bson::doc;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;
use wachat_rate_limit::AcquireResult;
use wachat_types::Project;

use crate::auth::{ApiKeyAuth, RateLimitTier};
use crate::dto::{SendMessageBody, SendResponse};
use crate::state::PublicApiState;

/// Required scope for the send endpoint. Mirrors the TS
/// `withApiV1(handler, { scope: 'messages:write' })` declaration on the
/// ported route.
const REQUIRED_SCOPE: &str = "messages:write";

/// Mongo collection name for projects.
const PROJECTS_COLL: &str = "projects";

// ===========================================================================
// POST /v1/wachat/public/messages — send a WA message via API key
// ===========================================================================

/// `POST /messages` (mounted under `/v1/wachat/public`) — send a
/// WhatsApp message authenticated by an API key.
///
/// Pipeline (mirrors the TS `withApiV1` chain):
///
/// 1. **Auth** — the [`ApiKeyAuth`] extractor runs before the handler
///    body, so by the time we're here the key is valid + non-revoked.
/// 2. **Rate limit** — per-API-key token bucket. 429 on exhaustion.
/// 3. **Scope** — require `messages:write`. 403 on missing.
/// 4. **Project lookup** — load by `projectId` and verify
///    `project.userId.to_hex() == auth.tenant_id`. 404 / 403 otherwise.
/// 5. **Send** — delegate to [`wachat_send::MessageSender`]. The engine
///    handles Meta API calls + the `outgoing_messages` log insert.
#[instrument(
    skip_all,
    fields(
        key_id = %auth.0.key_id,
        tenant_id = %auth.0.tenant_id,
        project_id = body.project_id(),
    )
)]
pub async fn send_message(
    auth: ApiKeyAuth,
    State(state): State<PublicApiState>,
    Json(body): Json<SendMessageBody>,
) -> Result<Json<SendResponse>> {
    let auth = auth.0;

    // ---- 2. Rate limit ----------------------------------------------------
    // Per-key bucket, sized off the tier's RPM. Capacity = RPM, refill =
    // RPM/60 per second (clamped to at least 1 to stay above the
    // limiter's `> 0` invariants on the smallest tiers).
    let rpm = auth.tier.rpm();
    let refill_per_sec = (rpm / 60).max(1);
    let bucket_key = auth.rate_limit_bucket();
    let acquired = state
        .rate_limit
        .try_acquire(&bucket_key, rpm, refill_per_sec, 1)
        .await?;
    if let AcquireResult::Denied { retry_after_ms } = acquired {
        return Err(ApiError::BadRequest(format!(
            "rate limit exceeded; retry after {retry_after_ms}ms"
        )));
        // NB: ApiError doesn't currently carry a 429 variant; surface as
        // 400 with a clear retry hint until a `TooManyRequests` variant
        // lands in `sabnode-common`. The TS side returns 429 — callers
        // that depend on the status code should use the `retry after`
        // hint in the message rather than the numeric status.
    }

    // ---- 3. Scope ---------------------------------------------------------
    if !auth.has_scope(REQUIRED_SCOPE) {
        return Err(ApiError::Forbidden(format!(
            "API key is missing required scope: {REQUIRED_SCOPE}"
        )));
    }

    // ---- 4. Project lookup + tenancy guard --------------------------------
    let project = load_project_for_tenant(&state.mongo, body.project_id(), &auth.tenant_id).await?;

    // ---- 5. Delegate to the send engine -----------------------------------
    let req = body.into_engine();
    let outcome = state.message.send(&project, req).await?;

    Ok(Json(SendResponse::ok(
        outcome.message_log_id.to_hex(),
        outcome.wamid,
    )))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Load a project by hex id and enforce that `tenant_id` matches its
/// `userId`. The API-key auth context's `tenant_id` is the owning user's
/// hex `_id`, mirroring the JWT auth context in the JWT-auth router.
///
/// Returns `404 NOT_FOUND` if the project doesn't exist (rather than
/// 403, which would leak project existence) and `403 FORBIDDEN` if the
/// caller is not its owner.
#[instrument(skip(mongo))]
async fn load_project_for_tenant(
    mongo: &MongoHandle,
    project_id_hex: &str,
    tenant_id: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    if project.user_id.to_hex() != tenant_id {
        return Err(ApiError::Forbidden(
            "API key does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}

// Silence the unused-import warning when `RateLimitTier` is only referenced
// in cfg(test); the `auth.tier.rpm()` call above keeps it live in normal
// builds, but keep the import explicit.
#[allow(dead_code)]
fn _assert_tier_used(t: RateLimitTier) -> u32 {
    t.rpm()
}
