//! Conversation assignment to a specific agent.
//!
//! Mirrors `getUnassignedConversations`, `assignConversation`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
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
pub struct UnassignedResp {
    pub contacts: Value,
}

pub async fn unassigned(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<UnassignedResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("contacts");
    let opts = FindOptions::builder()
        .sort(doc! { "lastMessageTimestamp": -1 })
        .limit(50)
        .build();
    let cursor = coll
        .find(doc! {
            "projectId": project.id,
            "$or": [
                { "assignedAgentId": null },
                { "assignedAgentId": { "$exists": false } },
            ],
            "status": { "$ne": "resolved" },
        })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(UnassignedResp {
        contacts: docs_to_json(docs),
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignBody {
    pub agent_id: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn assign(
    _user: AuthUser,
    Path(contact_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<AssignBody>,
) -> Result<Json<OkResp>> {
    let cid = opt_oid(&contact_id)?;
    let coll = state.mongo.collection::<Document>("contacts");
    coll.update_one(
        doc! { "_id": cid },
        doc! { "$set": {
            "assignedAgentId": &body.agent_id,
            "assignedAt": bson::DateTime::from_chrono(Utc::now()),
        } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
