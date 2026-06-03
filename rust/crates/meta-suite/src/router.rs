//! Axum router mounting the meta-suite catalog endpoints under
//! `/v1/meta/suite` (caller nests the prefix).

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{delete, get, post},
};
use bson::doc;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde::Deserialize;
use wachat_types::Project;

use crate::{catalog, state::MetaSuiteState};

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

#[derive(Deserialize)]
struct SearchQuery {
    #[serde(default)]
    search_term: Option<String>,
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MetaSuiteState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects/{id}/catalogs", get(list_catalogs))
        .route("/projects/{id}/catalogs/sync", post(sync_catalogs))
        .route(
            "/projects/{id}/catalogs/{catalog_id}/products",
            get(list_products).post(add_product),
        )
        .route(
            "/projects/{id}/catalogs/products/{product_id}",
            delete(delete_product).post(update_product),
        )
        .route(
            "/projects/{id}/catalogs/products/{product_id}/tagged-media",
            get(get_tagged_media),
        )
        .route(
            "/projects/{id}/catalogs/{catalog_id}/product-sets",
            get(list_product_sets).post(create_product_set),
        )
        .route(
            "/projects/{id}/catalogs/product-sets/{product_set_id}",
            delete(delete_product_set),
        )
}

async fn list_catalogs(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path(id): Path<String>,
) -> Result<Json<catalog::CatalogList>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(catalog::list_catalogs(&s.meta, &p).await?))
}

async fn list_products(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, catalog_id)): Path<(String, String)>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<catalog::ProductList>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::list_products(&s.meta, &p, &catalog_id, q.search_term.as_deref()).await?,
    ))
}

async fn add_product(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, catalog_id)): Path<(String, String)>,
    Json(body): Json<catalog::AddProductBody>,
) -> Result<Json<catalog::AckMessage>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::add_product(&s.meta, &p, &catalog_id, body).await?,
    ))
}

async fn delete_product(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, product_id)): Path<(String, String)>,
) -> Result<Json<catalog::DeleteAck>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::delete_product(&s.meta, &p, &product_id).await?,
    ))
}

async fn sync_catalogs(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path(id): Path<String>,
) -> Result<Json<catalog::AckMessage>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(catalog::sync_catalogs(&s.meta, &p).await?))
}

async fn update_product(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, product_id)): Path<(String, String)>,
    Json(body): Json<catalog::UpdateProductBody>,
) -> Result<Json<catalog::AckMessage>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::update_product(&s.meta, &p, &product_id, body).await?,
    ))
}

async fn list_product_sets(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, catalog_id)): Path<(String, String)>,
) -> Result<Json<catalog::ProductSetList>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::list_product_sets(&s.meta, &p, &catalog_id).await?,
    ))
}

async fn create_product_set(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, catalog_id)): Path<(String, String)>,
    Json(body): Json<catalog::CreateProductSetBody>,
) -> Result<Json<catalog::AckMessage>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::create_product_set(&s.meta, &p, &catalog_id, body).await?,
    ))
}

async fn delete_product_set(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, product_set_id)): Path<(String, String)>,
) -> Result<Json<catalog::DeleteAck>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::delete_product_set(&s.meta, &p, &product_set_id).await?,
    ))
}

async fn get_tagged_media(
    user: AuthUser,
    State(s): State<MetaSuiteState>,
    Path((id, product_id)): Path<(String, String)>,
) -> Result<Json<catalog::TaggedMediaList>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        catalog::get_tagged_media(&s.meta, &p, &product_id).await?,
    ))
}
