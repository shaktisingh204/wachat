//! `/contacts` — contact directory mirroring Baileys contacts store.
//!
//! Implements server actions from SABWA_PLAN.md §13: `listContacts`,
//! `upsertContactTags`, `blockContact` / `unblockContact`.

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::error::AppError;
use crate::state::AppState;

/// Build the `/contacts` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_contacts))
        .route("/:jid", get(get_contact).patch(update_contact))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsQuery {
    pub session_id: String,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactDto {
    pub jid: String,
    pub phone_e164: Option<String>,
    pub name: Option<String>,
    pub push_name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub is_business: bool,
    pub is_blocked: bool,
    pub is_my_contact: bool,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub last_interaction_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListContactsResponse {
    pub contacts: Vec<ContactDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactSessionQuery {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactRequest {
    pub session_id: String,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
    pub custom_fields: Option<JsonValue>,
    /// `true` to block, `false` to unblock.
    pub block: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactResponse {
    pub jid: String,
    pub updated: bool,
    pub block_queued: bool,
}

// ---------- Handlers ----------

async fn list_contacts(
    State(state): State<AppState>,
    Query(q): Query<ListContactsQuery>,
) -> Result<Json<ListContactsResponse>, AppError> {
    tracing::info!(
        session_id = %q.session_id,
        search = ?q.search,
        tag = ?q.tag,
        "contacts: list"
    );

    let rows = crate::db::contacts::list(
        &state.db,
        &q.session_id,
        q.search.as_deref(),
        q.tag.as_deref(),
    )
    .await?;
    let contacts = rows.into_iter().map(into_dto).collect();
    Ok(Json(ListContactsResponse { contacts }))
}

async fn get_contact(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Query(q): Query<ContactSessionQuery>,
) -> Result<Json<ContactDto>, AppError> {
    tracing::info!(session_id = %q.session_id, jid = %jid, "contacts: get");

    let c = crate::db::contacts::get(&state.db, &q.session_id, &jid).await?;
    Ok(Json(into_dto(c)))
}

async fn update_contact(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Json(body): Json<UpdateContactRequest>,
) -> Result<Json<UpdateContactResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        jid = %jid,
        block = ?body.block,
        "contacts: update"
    );

    crate::db::contacts::update(
        &state.db,
        &body.session_id,
        &jid,
        body.tags.as_deref(),
        body.notes.as_deref(),
        body.custom_fields.as_ref(),
    )
    .await?;

    let mut block_queued = false;
    if let Some(block) = body.block {
        let queue_key = format!("sabwa:{}:outbound", body.session_id);
        let payload = serde_json::json!({
            "op": if block { "contact_block" } else { "contact_unblock" },
            "jid": jid,
        });
        crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;
        block_queued = true;
    }

    Ok(Json(UpdateContactResponse {
        jid,
        updated: true,
        block_queued,
    }))
}

// ---------- helpers ----------

fn into_dto(c: crate::db::contacts::ContactRow) -> ContactDto {
    ContactDto {
        jid: c.jid,
        phone_e164: c.phone_e164,
        name: c.name,
        push_name: c.push_name,
        profile_pic_url: c.profile_pic_url,
        is_business: c.is_business,
        is_blocked: c.is_blocked,
        is_my_contact: c.is_my_contact,
        tags: c.tags,
        notes: c.notes,
        last_interaction_at: c.last_interaction_at,
    }
}
