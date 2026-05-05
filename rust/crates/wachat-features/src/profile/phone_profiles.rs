//! Phone-number summary list + Meta `whatsapp_business_profile` update.
//!
//! Mirrors `getPhoneNumberProfiles`, `updatePhoneProfile`. Note: a richer
//! `phone-numbers/{pnid}/profile` endpoint already exists in
//! `wachat-config-router` — the variant here is the legacy "blob" surface
//! that took a free-form `Record<string, any>` and forwarded it verbatim.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::{Map, Value, json};

use crate::{state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhonesResp {
    pub phone_numbers: Value,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<PhonesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let v = serde_json::to_value(&project.phone_numbers)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(PhonesResp { phone_numbers: v }))
}

pub async fn update(
    user: AuthUser,
    Path((project_id, phone_number_id)): Path<(String, String)>,
    State(state): State<WachatFeaturesState>,
    Json(profile): Json<Map<String, Value>>,
) -> Result<Json<MsgResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Access token missing.".to_owned()))?;

    let mut payload = profile.clone();
    payload.insert("messaging_product".into(), json!("whatsapp"));

    let path = format!("{}/whatsapp_business_profile", phone_number_id);
    state
        .meta
        .post_json::<_, serde_json::Value>(&path, token, &payload)
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok(Json(MsgResp {
        message: "Profile updated.".to_owned(),
    }))
}
