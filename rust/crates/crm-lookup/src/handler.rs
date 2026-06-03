//! Axum route handlers:
//!
//! - `GET /{entity}` — main lookup. Mirrors the TS API contract; on
//!   empty-state queries (no `q`, `page=0`, no `ids`) the handler
//!   additionally fetches the tenant's recents from Redis and hydrates
//!   them via the same dispatch.
//! - `POST /{entity}/recent/{itemId}` — record a pick. Pushes the id
//!   to the head of the per-tenant LRU list.

use crate::context::TenantCtx;
use crate::recents;
use crate::search;
use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use bson::oid::ObjectId;
use crm_lookup_types::{EntityKey, LookupParams, LookupResult, Scope};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{MongoHandle, RedisHandle};
use serde::Deserialize;
use std::sync::Arc;

/// Mountable router. Mount under `/v1/crm/lookup` from the host
/// `api` crate:
///
/// ```ignore
/// .nest("/v1/crm/lookup", crm_lookup::router::<AppState>())
/// ```
///
/// **Authenticated** — both routes require a valid `Authorization:
/// Bearer <jwt>` and resolve the tenant root from the verified
/// [`AuthUser`] (the `userId` query param is no longer trusted in
/// production; it is retained only as a debug-build fallback so tests
/// that don't wire the JWT verifier continue to work).
///
/// The state extractor needs `MongoHandle: FromRef<S>` (for the
/// executor), `RedisHandle: FromRef<S>` (for the §13.9 recents LRU),
/// and `Arc<AuthConfig>: FromRef<S>` (for the JWT verifier the
/// [`AuthUser`] extractor reads). `sabnode-api`'s `AppState` already
/// implements all three.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    RedisHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{entity}", get(lookup_route))
        .route("/{entity}/recent/{item_id}", post(record_recent_route))
}

/// Query params accepted by the GET route. Matches the TS shape
/// (`q=&page=&limit=&scope=&projectId=&ids=<csv>&filter=<json>`).
#[derive(Debug, Deserialize)]
pub struct LookupQuery {
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// Comma-separated id list. The route splits and forwards as
    /// `LookupParams::ids`.
    #[serde(default)]
    pub ids: Option<String>,
    /// JSON-encoded extra filter. Optional — the route parses to
    /// `serde_json::Value` and forwards.
    #[serde(default)]
    pub filter: Option<String>,
    #[serde(default)]
    pub scope: Option<Scope>,
    /// Tenant root (24-char hex).
    ///
    /// **Production:** ignored — the tenant root is resolved from the
    /// verified [`AuthUser`] (the `sabnode-auth` JWT extractor) and this
    /// field is no longer trusted on the wire.
    ///
    /// **Debug builds only:** kept as an optional fallback so tests and
    /// stand-alone invocations that don't wire the JWT verifier (and
    /// therefore have no `Authorization` header) can still drive the
    /// route. Release builds reject any caller that lacks a valid JWT.
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

/// Query params accepted by the POST `/recent` route.
///
/// `userId` is retained for backward compatibility with debug-build
/// tests only; in production the tenant root comes from the verified
/// [`AuthUser`] extractor (see [`LookupQuery::user_id`] for the same
/// rationale).
#[derive(Debug, Deserialize)]
pub struct RecentQuery {
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
}

/// Parse the URL `entity` segment into our typed enum. Unknown entities
/// fall back to a 400 with the offending value embedded.
fn parse_entity(raw: &str) -> Result<EntityKey> {
    serde_json::from_value::<EntityKey>(serde_json::Value::String(raw.to_owned()))
        .map_err(|_| ApiError::BadRequest(format!("unknown lookup entity: `{raw}`")))
}

/// Resolve the tenant-root `ObjectId` for the request.
///
/// Production path: take `auth.user_id` from the verified JWT and parse
/// it as a 24-char hex `ObjectId`. The `q_user_id` argument is ignored.
///
/// Debug-build fallback: when `auth` is `None` (test invocation that
/// didn't wire the JWT verifier), fall back to the `userId` query
/// param. This branch is **test-only** and is compiled out of release
/// builds via `cfg(debug_assertions)`.
fn resolve_user_id(auth: Option<&AuthUser>, q_user_id: Option<&str>) -> Result<ObjectId> {
    if let Some(user) = auth {
        return ObjectId::parse_str(&user.user_id)
            .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()));
    }

    // Test-only fallback: only available in debug builds so production
    // can never accept a query-string `userId`.
    #[cfg(debug_assertions)]
    {
        let s = q_user_id.ok_or_else(|| {
            ApiError::Unauthorized(
                "no tenant root resolved; ensure the JWT extractor ran before this route".into(),
            )
        })?;
        return ObjectId::parse_str(s)
            .map_err(|e| ApiError::BadRequest(format!("invalid userId: {e}")));
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = q_user_id;
        Err(ApiError::Unauthorized(
            "no tenant root resolved; missing or invalid Authorization header".into(),
        ))
    }
}

/// Empty-state heuristic — when the picker hasn't typed anything yet,
/// we want to surface recents. Hard-coded behavior (rather than a
/// query flag) so the wire contract stays clean.
fn is_empty_state(params: &LookupParams) -> bool {
    params.q.as_deref().is_none_or(str::is_empty)
        && params.ids.is_empty()
        && params.page.unwrap_or(0) == 0
}

pub async fn lookup_route(
    auth: AuthUser,
    State(mongo): State<MongoHandle>,
    State(redis): State<RedisHandle>,
    Path(entity_raw): Path<String>,
    Query(q): Query<LookupQuery>,
) -> Result<Json<LookupResult>> {
    let entity = parse_entity(&entity_raw)?;

    /* ---- shape the params --------------------------------------- */
    let ids: Vec<String> = q
        .ids
        .as_deref()
        .map(|s| {
            s.split(',')
                .filter(|x| !x.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();

    let filter = q
        .filter
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(serde_json::from_str::<serde_json::Value>)
        .transpose()
        .map_err(|e| ApiError::BadRequest(format!("invalid filter JSON: {e}")))?
        .unwrap_or(serde_json::Value::Null);

    let params = LookupParams {
        q: q.q,
        page: q.page,
        limit: q.limit,
        ids,
        filter,
        scope: q.scope,
        project_id: q.project_id.clone(),
    };

    /* ---- shape the tenant ctx ----------------------------------- */
    let user_id = resolve_user_id(Some(&auth), q.user_id.as_deref())?;
    let mut ctx = TenantCtx::new(user_id);
    if let Some(pid) = q.project_id.as_deref()
        && !pid.is_empty()
    {
        let oid = ObjectId::parse_str(pid)
            .map_err(|e| ApiError::BadRequest(format!("invalid projectId: {e}")))?;
        ctx = ctx.with_project(oid);
    }
    if let Some(s) = params.scope {
        ctx = ctx.with_scope(s);
    }

    let mut result = search::search(&mongo, entity, &params, &ctx).await?;

    /* ---- §13.9 recents — populate on empty-state only ----------- */
    if is_empty_state(&params) {
        // Best-effort. If Redis is briefly unreachable, log & drop —
        // the result is still useful without recents.
        match recents::fetch_recent(&redis, &user_id, entity, 5).await {
            Ok(ids) if !ids.is_empty() => {
                let hydrate_params = LookupParams {
                    ids,
                    ..Default::default()
                };
                match search::search(&mongo, entity, &hydrate_params, &ctx).await {
                    Ok(r) => {
                        result.recent = r.items;
                    }
                    Err(e) => {
                        tracing::warn!(
                            entity = entity.as_str(),
                            error = %e,
                            "recents hydration failed; returning result without recent",
                        );
                    }
                }
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!(
                    entity = entity.as_str(),
                    error = %e,
                    "recents fetch failed; returning result without recent",
                );
            }
        }
    }

    Ok(Json(result))
}

/// Record a pick. The frontend calls this when the user clicks a
/// result; we push the id to the head of the per-tenant LRU.
///
/// Returns `204 No Content` on success — the body is intentionally
/// empty since the picker doesn't need the rebuilt list (it'll re-
/// fetch via the GET route on the next mount).
pub async fn record_recent_route(
    auth: AuthUser,
    State(redis): State<RedisHandle>,
    Path((entity_raw, item_id)): Path<(String, String)>,
    Query(q): Query<RecentQuery>,
) -> Result<StatusCode> {
    let entity = parse_entity(&entity_raw)?;
    let user_id = resolve_user_id(Some(&auth), q.user_id.as_deref())?;
    if item_id.is_empty() {
        return Err(ApiError::BadRequest("itemId is required".into()));
    }
    recents::record_pick(&redis, &user_id, entity, &item_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_entity_accepts_canonical_keys() {
        assert_eq!(parse_entity("client").unwrap(), EntityKey::Client);
        assert_eq!(parse_entity("bankAccount").unwrap(), EntityKey::BankAccount);
        assert_eq!(parse_entity("salesOrder").unwrap(), EntityKey::SalesOrder);
    }

    #[test]
    fn parse_entity_rejects_unknown() {
        let err = parse_entity("not-a-real-entity").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(_)));
    }

    #[test]
    fn empty_state_detection() {
        let mut p = LookupParams::default();
        assert!(is_empty_state(&p), "default params are empty-state");

        p.q = Some("acme".into());
        assert!(!is_empty_state(&p), "non-empty q disables empty-state");

        p = LookupParams {
            q: Some(String::new()),
            page: Some(1),
            ..Default::default()
        };
        assert!(!is_empty_state(&p), "non-zero page disables empty-state");

        p = LookupParams {
            ids: vec!["123".into()],
            ..Default::default()
        };
        assert!(!is_empty_state(&p), "explicit ids disable empty-state");
    }
}
