//! Per-contact chat history export.
//!
//! Mirrors `exportChatHistory`.

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

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Serialize)]
pub struct ExportResp {
    pub messages: Value,
}

pub async fn export_history(
    user: AuthUser,
    Path((project_id, contact_id)): Path<(String, String)>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ExportResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("messages");
    let opts = FindOptions::builder().sort(doc! { "timestamp": 1 }).build();
    let cursor = coll
        .find(doc! { "contactId": &contact_id, "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(ExportResp {
        messages: docs_to_json(docs),
    }))
}
