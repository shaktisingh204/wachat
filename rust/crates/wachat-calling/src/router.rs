//! Axum router mounting the wachat-calling endpoints under
//! `/v1/wachat/calling` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::get,
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{logs, settings, state::WachatCallingState};

const PROJECTS_COLL: &str = "projects";

/// Tenant-checked project loader. Mirrors `wachat_config::router::load_project_for`.
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(project)
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatCallingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/projects/{id}/phone-numbers/{pnid}/settings",
            get(get_settings).post(save_settings),
        )
        .route("/projects/{id}/logs", get(list_logs))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn get_settings(
    user: AuthUser,
    State(s): State<WachatCallingState>,
    Path((id, pnid)): Path<(String, String)>,
) -> Result<Json<settings::GetSettingsResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(settings::get_settings(&s.meta, &p, &pnid).await?))
}

async fn save_settings(
    user: AuthUser,
    State(s): State<WachatCallingState>,
    Path((id, pnid)): Path<(String, String)>,
    Json(body): Json<settings::SaveSettingsBody>,
) -> Result<Json<serde_json::Value>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    settings::save_settings(&s.meta, &p, &pnid, body).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn list_logs(
    user: AuthUser,
    State(s): State<WachatCallingState>,
    Path(id): Path<String>,
) -> Result<Json<logs::CallLogsResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(logs::list(&s.mongo, &p.id).await?))
}
