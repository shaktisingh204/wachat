//! Distinct conversation tags (across all contacts in a project).
//!
//! Mirrors `getConversationTags`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;

use crate::{state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Serialize)]
pub struct TagsResp {
    pub tags: Vec<String>,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<TagsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("contacts");
    let raw = coll
        .distinct("tags", doc! { "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let tags: Vec<String> = raw
        .into_iter()
        .filter_map(|b| match b {
            Bson::String(s) if !s.is_empty() => Some(s),
            _ => None,
        })
        .collect();

    Ok(Json(TagsResp { tags }))
}
