//! Bulk message sending — best-effort text loop over Meta's `/messages`.
//!
//! Mirrors `sendBulkMessages`. Uses the project's first phone number as
//! the sender (matches the legacy code). Errors are tallied per recipient
//! rather than aborting the whole batch — the legacy contract was
//! `{ success, failed, total }`.

use axum::{
    Json,
    extract::{Path, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Deserialize)]
pub struct BulkBody {
    pub phones: Vec<String>,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkResp {
    pub success: u32,
    pub failed: u32,
    pub total: u32,
}

pub async fn send_bulk(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<BulkBody>,
) -> Result<Json<BulkResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("Access token missing.".to_owned()))?;
    let pn = project
        .phone_numbers
        .first()
        .ok_or_else(|| ApiError::BadRequest("No phone number configured.".to_owned()))?;
    let phone_number_id = pn
        .id
        .clone()
        .ok_or_else(|| ApiError::BadRequest("Phone number id missing.".to_owned()))?;
    let total = body.phones.len() as u32;

    let mut success = 0u32;
    let mut failed = 0u32;
    for phone in body.phones.iter() {
        let trimmed = phone.trim();
        if trimmed.is_empty() {
            continue;
        }
        let payload = json!({
            "messaging_product": "whatsapp",
            "to": trimmed,
            "type": "text",
            "text": { "body": body.message },
        });
        let path = format!("{}/messages", phone_number_id);
        match state
            .meta
            .post_json::<_, serde_json::Value>(&path, token, &payload)
            .await
        {
            Ok(_) => success += 1,
            Err(_) => failed += 1,
        }
    }
    Ok(Json(BulkResp {
        success,
        failed,
        total,
    }))
}
