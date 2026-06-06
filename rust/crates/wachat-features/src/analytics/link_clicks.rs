//! Recent link-click events.
//!
//! Mirrors `getLinkClicks`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::Value;
use tracing::instrument;

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

const COLL: &str = "wa_link_clicks";

#[derive(Debug, Serialize)]
pub struct ClicksResp {
    pub clicks: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearResp {
    pub success: bool,
    /// Number of link-click rows removed.
    pub deleted_count: i64,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ClicksResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "clickedAt": -1 })
        .limit(500)
        .build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(ClicksResp {
        clicks: docs_to_json(docs),
    }))
}

/// Clear all link-click history for the project.
#[instrument(skip_all)]
pub async fn clear(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ClearResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let res = coll
        .delete_many(doc! { "projectId": project.id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("wa_link_clicks.delete_many"))
        })?;
    Ok(Json(ClearResp {
        success: true,
        deleted_count: res.deleted_count as i64,
    }))
}
