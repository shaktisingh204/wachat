//! Axum router for the marketing endpoints, mounted at `/v1/wachat/marketing`
//! by the API crate (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::{get, post},
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{campaigns, send, state::WachatMarketingState};

const PROJECTS_COLL: &str = "projects";

/// Tenant-checked project loader. Mirrors `wachat_calling::router::load_project_for`.
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
    WachatMarketingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/send", post(send_marketing))
        .route("/projects/{id}/campaigns", get(list_campaigns))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn send_marketing(
    user: AuthUser,
    State(s): State<WachatMarketingState>,
    Path(id): Path<String>,
    Json(body): Json<send::SendMarketingBody>,
) -> Result<Json<send::SendMarketingResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(send::send(&s.meta, &s.mongo, &p, body).await?))
}

async fn list_campaigns(
    user: AuthUser,
    State(s): State<WachatMarketingState>,
    Path(id): Path<String>,
) -> Result<Json<campaigns::CampaignsResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(campaigns::list(&s.mongo, &p.id).await?))
}
