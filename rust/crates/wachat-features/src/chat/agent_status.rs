//! Agent presence + status.
//!
//! Mirrors `getAgentStatuses`, `setAgentStatus`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

#[derive(Debug, Serialize)]
pub struct AgentsResp {
    pub agents: Value,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<AgentsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("agents");
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(AgentsResp {
        agents: docs_to_json(docs),
    }))
}

#[derive(Debug, Deserialize)]
pub struct SetStatusBody {
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn set_status(
    _user: AuthUser,
    Path(agent_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SetStatusBody>,
) -> Result<Json<OkResp>> {
    let aid = opt_oid(&agent_id)?;
    let coll = state.mongo.collection::<Document>("agents");
    coll.update_one(
        doc! { "_id": aid },
        doc! { "$set": {
            "status": body.status,
            "statusUpdatedAt": bson::DateTime::from_chrono(Utc::now()),
        } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
