//! Axum router for identity endpoints, mounted at `/v1/wachat/identity`.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::post,
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{resolve, state::WachatIdentityState};

const PROJECTS_COLL: &str = "projects";

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
    WachatIdentityState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/projects/{id}/resolve", post(resolve_contact))
}

async fn resolve_contact(
    user: AuthUser,
    State(s): State<WachatIdentityState>,
    Path(id): Path<String>,
    Json(body): Json<resolve::ResolveBody>,
) -> Result<Json<resolve::ResolveResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(resolve::resolve(&s.mongo, &p.id, body).await?))
}
