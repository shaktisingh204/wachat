use std::sync::Arc;

use axum::{
    extract::{Query, State},
    Json,
};
use mongodb::bson::{doc, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    db,
    errors::{EngineError, EngineResult},
    routing,
    state::AppState,
};

pub async fn health() -> Json<Value> {
    Json(json!({
        "ok": true,
        "version": env!("CARGO_PKG_VERSION"),
        "service": "sabsms-engine",
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvidersHealthQuery {
    pub workspace_id: String,
}

/// GET /v1/health/providers?workspaceId= — per-account rolling delivery
/// health (service-token). Merges the workspace's provider-account list
/// from Mongo with the Redis health window + circuit state:
///
/// ```json
/// { "accounts": [{ "accountId", "provider", "isDefault", "status",
///   "byCountry": [{ "country", "sent", "delivered", "failed",
///                   "score", "lastDlrMs", "circuit" }] }] }
/// ```
pub async fn providers_health(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ProvidersHealthQuery>,
) -> EngineResult<Json<Value>> {
    if q.workspace_id.is_empty() {
        return Err(EngineError::BadRequest("workspaceId required".into()));
    }

    let col = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);
    let mut cursor = col.find(doc! { "workspaceId": &q.workspace_id }).await?;

    let mut redis = state.redis.clone();
    let mut accounts: Vec<Value> = Vec::new();
    while cursor.advance().await? {
        let d: Document = cursor.deserialize_current()?;
        let account_id = d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .or_else(|_| d.get_str("_id").map(|s| s.to_string()))
            .unwrap_or_default();
        if account_id.is_empty() {
            continue;
        }
        let provider = d.get_str("provider").unwrap_or("").to_string();
        let is_default = d.get_bool("isDefault").unwrap_or(false);
        let status = d.get_str("status").unwrap_or("active").to_string();

        let mut by_country: Vec<Value> = Vec::new();
        for country in routing::health::countries_for_account(&mut redis, &account_id).await {
            let stats = routing::health::read_stats(&mut redis, &account_id, &country).await;
            let circuit =
                routing::circuit::current_state(&mut redis, &account_id, &country).await;
            by_country.push(json!({
                "country": country,
                "sent": stats.sent,
                "delivered": stats.delivered,
                "failed": stats.failed,
                "score": stats.score(),
                "lastDlrMs": stats.last_dlr_ms,
                "circuit": circuit.as_str(),
            }));
        }

        accounts.push(json!({
            "accountId": account_id,
            "provider": provider,
            "isDefault": is_default,
            "status": status,
            "byCountry": by_country,
        }));
    }

    Ok(Json(json!({ "accounts": accounts })))
}
