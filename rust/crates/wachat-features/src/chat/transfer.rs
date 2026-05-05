//! Conversation transfer + transfer history.
//!
//! Mirrors `transferConversation`, `getTransferHistory`.

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferBody {
    pub from_agent_id: String,
    pub to_agent_id: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn transfer(
    _user: AuthUser,
    Path(contact_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<TransferBody>,
) -> Result<Json<OkResp>> {
    let cid = opt_oid(&contact_id)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let contacts = state.mongo.collection::<Document>("contacts");
    contacts
        .update_one(
            doc! { "_id": cid },
            doc! { "$set": { "assignedAgentId": &body.to_agent_id, "transferredAt": now } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let history = state.mongo.collection::<Document>("wa_transfer_history");
    history
        .insert_one(doc! {
            "contactId": &contact_id,
            "fromAgentId": &body.from_agent_id,
            "toAgentId": &body.to_agent_id,
            "note": body.note.unwrap_or_default(),
            "transferredAt": now,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}

#[derive(Debug, Serialize)]
pub struct HistoryResp {
    pub history: Value,
}

pub async fn history(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<HistoryResp>> {
    // Mirror legacy: tenancy gate is on the project (history collection
    // itself is not project-scoped per the legacy query, which read
    // `find({})`). We still gate the *call* on project membership so the
    // endpoint is not anonymous.
    let _project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("wa_transfer_history");
    let opts = FindOptions::builder()
        .sort(doc! { "transferredAt": -1 })
        .limit(50)
        .build();
    let cursor = coll
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(HistoryResp {
        history: docs_to_json(docs),
    }))
}
