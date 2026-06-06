//! HTTP handlers for the wachat integrations-hub OAuth-connection domain.
//!
//! All endpoints are scoped to the authenticated user (`userId`). The
//! `/wachat/integrations` page (OAuth Connections tab) is the sole
//! consumer. This crate owns OAuth-connection bookkeeping ONLY — the
//! actual provider OAuth handoff stays in Next.js, and
//! razorpay / link-clicks / widget live in their own crates.
//!
//! | Endpoint                                          | Action               |
//! |---------------------------------------------------|----------------------|
//! | `GET    /v1/wachat/integrations/oauth`            | list connections     |
//! | `POST   /v1/wachat/integrations/oauth/{provider}/connect` | record intent |
//! | `DELETE /v1/wachat/integrations/oauth/{provider}` | remove connection    |
//!
//! Storage: `wa_oauth_connections`, keyed by `{ userId, provider }`.
//! Genuinely new data (no legacy collection existed), so a `wa_*` name
//! is used per the two-store policy.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::dto::{ConnectBody, ListConnectionsResponse, OauthConnection, SuccessResponse};
use crate::state::WachatIntegrationsHubState;

/// Mongo collection — new data, `wa_*`-prefixed. Keyed `{userId, provider}`.
const COLL: &str = "wa_oauth_connections";

/// Providers the OAuth Connections tab knows about. Anything else is a
/// 400 so we never persist a junk provider slug.
const KNOWN_PROVIDERS: [&str; 3] = ["facebook", "shopify", "google-analytics"];

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Validate the `{provider}` path segment against the known allowlist.
fn validate_provider(provider: &str) -> Result<()> {
    if KNOWN_PROVIDERS.contains(&provider) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "Unknown provider '{provider}'. Expected one of: facebook, shopify, google-analytics."
        )))
    }
}

// ===========================================================================
// GET /v1/wachat/integrations/oauth
// ===========================================================================

/// `GET /oauth` — list every known provider with its connection state
/// for the caller. Always returns all three known providers (connected
/// or not) so the page can render a stable grid.
#[instrument(skip_all)]
pub async fn list_connections(
    user: AuthUser,
    State(state): State<WachatIntegrationsHubState>,
) -> Result<Json<ListConnectionsResponse>> {
    let uid = user_oid(&user)?;
    let coll = state.mongo.collection::<Document>(COLL);

    let cursor = coll
        .find(doc! { "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth.collect")))?;

    let connections = KNOWN_PROVIDERS
        .iter()
        .map(|&provider| {
            let row = docs
                .iter()
                .find(|d| d.get_str("provider").ok() == Some(provider));
            match row {
                Some(d) => {
                    // A connection counts as "connected" unless it is
                    // still a pending intent that never completed.
                    let status = d.get_str("status").unwrap_or("connected");
                    let connected = status == "connected";
                    let account_label = d
                        .get_str("accountLabel")
                        .ok()
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned);
                    let connected_at = d
                        .get_datetime("connectedAt")
                        .ok()
                        .map(|dt| dt.to_chrono().to_rfc3339());
                    OauthConnection {
                        provider: provider.to_owned(),
                        connected,
                        account_label,
                        connected_at,
                    }
                }
                None => OauthConnection {
                    provider: provider.to_owned(),
                    connected: false,
                    account_label: None,
                    connected_at: None,
                },
            }
        })
        .collect();

    Ok(Json(ListConnectionsResponse { connections }))
}

// ===========================================================================
// POST /v1/wachat/integrations/oauth/{provider}/connect
// ===========================================================================

/// `POST /oauth/{provider}/connect` — record an initiated connection
/// intent (`status: "pending"`). The real OAuth handoff happens in
/// Next; this is bookkeeping only. Upserts on `{userId, provider}` so a
/// re-initiated connect refreshes the same row.
#[instrument(skip_all, fields(provider = %provider))]
pub async fn connect_provider(
    user: AuthUser,
    State(state): State<WachatIntegrationsHubState>,
    Path(provider): Path<String>,
    body: Option<Json<ConnectBody>>,
) -> Result<Json<SuccessResponse>> {
    validate_provider(&provider)?;
    let uid = user_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let Json(body) = body.unwrap_or_default();

    let mut set = doc! {
        "status": "pending",
        "updatedAt": now,
    };
    if let Some(label) = body.account_label.as_deref().filter(|s| !s.is_empty()) {
        set.insert("accountLabel", label);
    }

    state
        .mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "userId": uid, "provider": &provider },
            doc! {
                "$set": set,
                "$setOnInsert": {
                    "userId": uid,
                    "provider": &provider,
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth.upsert")))?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/wachat/integrations/oauth/{provider}
// ===========================================================================

/// `DELETE /oauth/{provider}` — remove the caller's connection record
/// for a provider. Idempotent: a missing record is a 404 so the UI can
/// distinguish "nothing to disconnect" if it cares.
#[instrument(skip_all, fields(provider = %provider))]
pub async fn disconnect_provider(
    user: AuthUser,
    State(state): State<WachatIntegrationsHubState>,
    Path(provider): Path<String>,
) -> Result<Json<SuccessResponse>> {
    validate_provider(&provider)?;
    let uid = user_oid(&user)?;

    let res = state
        .mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "userId": uid, "provider": &provider })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("oauth.delete_one")))?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Connection not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}
