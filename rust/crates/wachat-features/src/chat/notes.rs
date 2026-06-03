//! Per-contact chat notes.
//!
//! Mirrors `getContactNotes`, `addContactNote`, `deleteContactNote`.
//! Matches the legacy semantics: notes are not gated by a project lookup
//! (the legacy code only validated by `contactId`), so we keep the same
//! contract here — `AuthUser` is still required.

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
};

const COLL: &str = "wa_contact_notes";

#[derive(Debug, Serialize)]
pub struct NotesResp {
    pub notes: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddNoteBody {
    #[serde(default)]
    pub project_id: Option<String>,
    pub text: String,
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
    _user: AuthUser,
    Path(contact_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<NotesResp>> {
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let cursor = coll
        .find(doc! { "contactId": &contact_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(NotesResp {
        notes: docs_to_json(docs),
    }))
}

pub async fn add(
    _user: AuthUser,
    Path(contact_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<AddNoteBody>,
) -> Result<Json<MsgResp>> {
    if body.text.trim().is_empty() {
        return Err(ApiError::BadRequest("Note text is required.".to_owned()));
    }
    let coll = state.mongo.collection::<Document>(COLL);
    let mut doc = doc! {
        "contactId": &contact_id,
        "text": &body.text,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(p) = body.project_id {
        doc.insert("projectId", p);
    }
    coll.insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Note added.".to_owned(),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(note_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&note_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
