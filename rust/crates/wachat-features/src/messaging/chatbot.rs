//! Chatbot trigger/response rules.
//!
//! Mirrors `getChatbotResponses`, `saveChatbotResponse`, `deleteChatbotResponse`.

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

const COLL: &str = "wa_chatbot_responses";

#[derive(Debug, Serialize)]
pub struct ResponsesResp {
    pub responses: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBody {
    #[serde(default)]
    pub response_id: Option<String>,
    pub trigger: String,
    pub response: String,
    #[serde(default)]
    pub match_type: Option<String>,
    #[serde(default)]
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ResponsesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder().sort(doc! { "trigger": 1 }).build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(ResponsesResp {
        responses: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    if body.trigger.trim().is_empty() || body.response.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Trigger and response are required.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "projectId": project.id,
        "trigger": body.trigger.to_lowercase(),
        "response": &body.response,
        "matchType": body.match_type.unwrap_or_else(|| "contains".to_owned()),
        "isActive": body.is_active,
        "updatedAt": now,
    };

    if let Some(rid) = body.response_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = opt_oid(rid)?;
        coll.update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    } else {
        set_doc.insert("createdAt", now);
        coll.insert_one(set_doc)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    }

    Ok(Json(MsgResp {
        message: "Chatbot response saved.".to_owned(),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(response_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&response_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
