//! Axum router for carousel endpoints, mounted at `/v1/wachat/carousel`.

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

use crate::{list, send, state::WachatCarouselState, templates};

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
    WachatCarouselState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/templates", post(create_template))
        .route("/projects/{id}/send", post(send_carousel))
        .route("/projects/{id}/sent", get(list_sent))
}

async fn create_template(
    user: AuthUser,
    State(s): State<WachatCarouselState>,
    Path(id): Path<String>,
    Json(body): Json<templates::CreateCarouselTemplateBody>,
) -> Result<Json<templates::CreateCarouselTemplateResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(templates::create(&s.meta, &p, body).await?))
}

async fn send_carousel(
    user: AuthUser,
    State(s): State<WachatCarouselState>,
    Path(id): Path<String>,
    Json(body): Json<send::SendCarouselBody>,
) -> Result<Json<send::SendCarouselResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(send::send(&s.meta, &s.mongo, &p, body).await?))
}

async fn list_sent(
    user: AuthUser,
    State(s): State<WachatCarouselState>,
    Path(id): Path<String>,
) -> Result<Json<list::CarouselsResponse>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(list::list(&s.mongo, &p.id).await?))
}
