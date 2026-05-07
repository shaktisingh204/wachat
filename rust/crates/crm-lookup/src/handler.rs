//! Axum route handler for `GET /api/crm/lookup/{entity}`. Mirrors the
//! TS API contract — same query string, same JSON envelope.

use crate::context::TenantCtx;
use crate::search;
use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::get,
};
use bson::oid::ObjectId;
use crm_lookup_types::{EntityKey, LookupParams, LookupResult, Scope};
use sabnode_common::{ApiError, Result};
use sabnode_db::MongoHandle;
use serde::Deserialize;

/// Mountable router. Mount under `/v1/crm/lookup` from the host
/// `api` crate:
///
/// ```ignore
/// .nest("/v1/crm/lookup", crm_lookup::router::<AppState>())
/// ```
///
/// The state extractor only needs `MongoHandle: FromRef<S>` — Redis
/// caching for `recent` will require a second `RedisHandle` bound when
/// it lands.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new().route("/{entity}", get(lookup_route))
}

/// Query params accepted by the route. Matches the TS shape
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
    /// Tenant root (24-char hex). In production this comes from the
    /// session middleware; exposed as a query param so the route can
    /// be invoked stand-alone in tests.
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

/// Parse the URL `entity` segment into our typed enum. Unknown entities
/// fall back to a 400 with the offending value embedded.
fn parse_entity(raw: &str) -> Result<EntityKey> {
    serde_json::from_value::<EntityKey>(serde_json::Value::String(raw.to_owned()))
        .map_err(|_| ApiError::BadRequest(format!("unknown lookup entity: `{raw}`")))
}

pub async fn lookup_route(
    State(mongo): State<MongoHandle>,
    Path(entity_raw): Path<String>,
    Query(q): Query<LookupQuery>,
) -> Result<Json<LookupResult>> {
    let entity = parse_entity(&entity_raw)?;

    /* ---- shape the params --------------------------------------- */
    let ids: Vec<String> = q
        .ids
        .as_deref()
        .map(|s| s.split(',').filter(|x| !x.is_empty()).map(str::to_owned).collect())
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
    let user_id_str = q.user_id.as_deref().ok_or_else(|| {
        ApiError::Unauthorized(
            "no tenant root resolved; ensure session middleware ran before this route".into(),
        )
    })?;
    let user_id = ObjectId::parse_str(user_id_str)
        .map_err(|e| ApiError::BadRequest(format!("invalid userId: {e}")))?;

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

    let result = search::search(&mongo, entity, &params, &ctx).await?;
    Ok(Json(result))
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
}
