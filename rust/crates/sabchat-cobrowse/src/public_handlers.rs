use axum::{
    extract::{Path, State},
    Json,
};
use bson::{doc, Document};
use chrono::Utc;

use sabnode_common::{ApiError, Result};

use crate::{
    dto::{ConsentBody, PublicCobrowseStatus},
    state::SabChatCobrowseState,
};

#[tracing::instrument(skip(state))]
pub async fn grant_consent(
    State(state): State<SabChatCobrowseState>,
    Path(visitor_token): Path<String>,
    Json(body): Json<ConsentBody>,
) -> Result<Json<PublicCobrowseStatus>> {
    let sessions_coll = state
        .mongo
        .collection::<Document>("sabchat_cobrowse_sessions");

    let session = sessions_coll
        .find_one(doc! { "visitorToken": &visitor_token })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;

    let current_status = session.get_str("status").unwrap_or("pending");
    if current_status == "ended" {
        return Ok(Json(PublicCobrowseStatus {
            status: "ended".into(),
            consent_granted: session.get_bool("consentGranted").unwrap_or(false),
            mask_password_fields: session.get_bool("maskPasswordFields").unwrap_or(true),
        }));
    }

    let now = Utc::now();
    let new_status = if body.granted { "active" } else { "ended" };
    let mut update_doc = doc! {
        "consentGranted": body.granted,
        "status": new_status,
    };

    if new_status == "ended" {
        update_doc.insert("endedAt", bson::DateTime::from_chrono(now));
    } else if current_status == "pending" && new_status == "active" {
        update_doc.insert("startedAt", bson::DateTime::from_chrono(now));
    }

    let _updated = sessions_coll
        .find_one_and_update(
            doc! { "visitorToken": &visitor_token },
            doc! { "$set": update_doc },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;

    // Return the state post-update
    Ok(Json(PublicCobrowseStatus {
        status: new_status.into(),
        consent_granted: body.granted,
        mask_password_fields: session.get_bool("maskPasswordFields").unwrap_or(true),
    }))
}

#[tracing::instrument(skip(state))]
pub async fn session_status(
    State(state): State<SabChatCobrowseState>,
    Path(visitor_token): Path<String>,
) -> Result<Json<PublicCobrowseStatus>> {
    let sessions_coll = state
        .mongo
        .collection::<Document>("sabchat_cobrowse_sessions");

    let session = sessions_coll
        .find_one(doc! { "visitorToken": &visitor_token })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;

    let status = session.get_str("status").unwrap_or("pending").to_string();
    let consent_granted = session.get_bool("consentGranted").unwrap_or(false);
    let mask_password_fields = session.get_bool("maskPasswordFields").unwrap_or(true);

    Ok(Json(PublicCobrowseStatus {
        status,
        consent_granted,
        mask_password_fields,
    }))
}
