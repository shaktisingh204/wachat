//! HTTP handlers for the wachat-ai-training domain.
//!
//! All endpoints are scoped to the authenticated user **and** the
//! `{projectId, phoneNumberId}` pair from the path. The `/wachat/automation`
//! page is the sole consumer today: a model picker (`meta-native` /
//! `sabnode-ai`) plus question/answer training samples.
//!
//! | Endpoint                                                      | Action            |
//! |---------------------------------------------------------------|-------------------|
//! | `GET    /v1/wachat/ai-training/model-config/{pid}/{phid}`     | read model config |
//! | `POST   /v1/wachat/ai-training/model-config/{pid}/{phid}`     | upsert model      |
//! | `GET    /v1/wachat/ai-training/samples/{pid}/{phid}`          | list samples      |
//! | `POST   /v1/wachat/ai-training/samples/{pid}/{phid}`          | create sample     |
//! | `DELETE /v1/wachat/ai-training/samples/{pid}/{phid}/{sid}`    | delete sample     |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ListSamplesResponse, ModelConfigBody, ModelConfigResponse, SampleBody, SuccessResponse,
};
use crate::state::WachatAiTrainingState;

const MODEL_COLL: &str = "wa_automation_model_config";
const SAMPLES_COLL: &str = "wa_ai_training_samples";

const DEFAULT_MODEL: &str = "meta-native";
const ALLOWED_MODELS: [&str; 2] = ["meta-native", "sabnode-ai"];

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Validate the `{project_id}` / `{phone_id}` path scope.
fn validate_scope(project_id: &str, phone_id: &str) -> Result<()> {
    if project_id.trim().is_empty() || phone_id.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "projectId and phoneNumberId are required.".to_owned(),
        ));
    }
    Ok(())
}

/// Build the tenancy filter shared by every query in this crate.
fn scope_filter(uid: ObjectId, project_id: &str, phone_id: &str) -> Document {
    doc! {
        "userId": uid,
        "projectId": project_id,
        "phoneNumberId": phone_id,
    }
}

// ===========================================================================
// GET /v1/wachat/ai-training/model-config/{project_id}/{phone_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn get_model_config(
    user: AuthUser,
    State(state): State<WachatAiTrainingState>,
    Path((project_id, phone_id)): Path<(String, String)>,
) -> Result<Json<ModelConfigResponse>> {
    validate_scope(&project_id, &phone_id)?;
    let uid = user_oid(&user)?;
    let existing = state
        .mongo
        .collection::<Document>(MODEL_COLL)
        .find_one(scope_filter(uid, &project_id, &phone_id))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("model_config.find_one")))?;
    let model = existing
        .and_then(|d| d.get_str("model").ok().map(str::to_owned))
        .unwrap_or_else(|| DEFAULT_MODEL.to_owned());
    Ok(Json(ModelConfigResponse { model }))
}

// ===========================================================================
// POST /v1/wachat/ai-training/model-config/{project_id}/{phone_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn upsert_model_config(
    user: AuthUser,
    State(state): State<WachatAiTrainingState>,
    Path((project_id, phone_id)): Path<(String, String)>,
    Json(body): Json<ModelConfigBody>,
) -> Result<Json<SuccessResponse>> {
    validate_scope(&project_id, &phone_id)?;
    let model = body.model.trim();
    if !ALLOWED_MODELS.contains(&model) {
        return Err(ApiError::Validation(
            "model must be 'meta-native' or 'sabnode-ai'.".to_owned(),
        ));
    }
    let uid = user_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    state
        .mongo
        .collection::<Document>(MODEL_COLL)
        .update_one(
            scope_filter(uid, &project_id, &phone_id),
            doc! {
                "$set": { "model": model, "updatedAt": now },
                "$setOnInsert": {
                    "userId": uid,
                    "projectId": &project_id,
                    "phoneNumberId": &phone_id,
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("model_config.update_one"))
        })?;
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/wachat/ai-training/samples/{project_id}/{phone_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_samples(
    user: AuthUser,
    State(state): State<WachatAiTrainingState>,
    Path((project_id, phone_id)): Path<(String, String)>,
) -> Result<Json<ListSamplesResponse>> {
    validate_scope(&project_id, &phone_id)?;
    let uid = user_oid(&user)?;
    let cursor = state
        .mongo
        .collection::<Document>(SAMPLES_COLL)
        .find(scope_filter(uid, &project_id, &phone_id))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("samples.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("samples.collect")))?;
    let samples = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListSamplesResponse { samples }))
}

// ===========================================================================
// POST /v1/wachat/ai-training/samples/{project_id}/{phone_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_sample(
    user: AuthUser,
    State(state): State<WachatAiTrainingState>,
    Path((project_id, phone_id)): Path<(String, String)>,
    Json(body): Json<SampleBody>,
) -> Result<Json<Value>> {
    validate_scope(&project_id, &phone_id)?;
    if body.question.trim().is_empty() || body.answer.trim().is_empty() {
        return Err(ApiError::Validation(
            "Question and answer are required.".to_owned(),
        ));
    }
    let uid = user_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_doc = doc! {
        "_id": ObjectId::new(),
        "userId": uid,
        "projectId": &project_id,
        "phoneNumberId": &phone_id,
        "question": body.question.trim(),
        "answer": body.answer.trim(),
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(SAMPLES_COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("samples.insert_one")))?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// DELETE /v1/wachat/ai-training/samples/{project_id}/{phone_id}/{sample_id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_sample(
    user: AuthUser,
    State(state): State<WachatAiTrainingState>,
    Path((project_id, phone_id, sample_id)): Path<(String, String, String)>,
) -> Result<Json<SuccessResponse>> {
    validate_scope(&project_id, &phone_id)?;
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&sample_id)?;
    let mut filter = scope_filter(uid, &project_id, &phone_id);
    filter.insert("_id", oid);
    let res = state
        .mongo
        .collection::<Document>(SAMPLES_COLL)
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("samples.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Training sample not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}
