//! `/groups` — group lifecycle, participants, admins and invite links.
//!
//! Implements server actions from SABWA_PLAN.md §13: `createGroup`,
//! `addParticipants` / `removeParticipants`, `promoteAdmin` / `demoteAdmin`,
//! `updateGroupSubject` / `updateGroupDescription` / `updateGroupIcon`,
//! `getInviteCode` / `revokeInviteCode`, `setGroupCategory`.

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::audit::{self, AuditEntry};
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/groups` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_groups).post(create_group))
        .route("/:jid", get(get_group).patch(update_group))
        .route(
            "/:jid/participants",
            post(add_participants).delete(remove_participants),
        )
        .route("/:jid/admins", post(promote_admin))
        .route("/:jid/admins/:participant_jid", delete(demote_admin))
        .route("/:jid/invite-link", get(invite_link))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRequest {
    pub session_id: String,
    pub subject: String,
    pub participants: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupResponse {
    pub queued: bool,
    pub queue_key: String,
    pub temp_request_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListGroupsQuery {
    pub session_id: String,
    #[serde(default)]
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSummary {
    pub jid: String,
    pub subject: String,
    pub description: Option<String>,
    pub participant_count: u32,
    pub category: Option<String>,
    pub announcement: bool,
    pub restrict: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListGroupsResponse {
    pub groups: Vec<GroupSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSessionQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupParticipant {
    pub jid: String,
    pub is_admin: bool,
    pub is_super_admin: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDetail {
    pub jid: String,
    pub subject: String,
    pub description: Option<String>,
    pub creator: Option<String>,
    pub announcement: bool,
    pub restrict: bool,
    pub ephemeral_duration: Option<u32>,
    pub category: Option<String>,
    pub participants: Vec<GroupParticipant>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupRequest {
    pub session_id: String,
    pub subject: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub announcement: Option<bool>,
    pub restrict: Option<bool>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupResponse {
    pub jid: String,
    pub queued: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantsRequest {
    pub session_id: String,
    pub jids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantsResponse {
    pub jid: String,
    pub op: String,
    pub queued: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteLinkQuery {
    pub session_id: String,
    #[serde(default)]
    pub revoke: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteLinkResponse {
    pub jid: String,
    pub invite_link: Option<String>,
    pub revoked: bool,
    pub queued: bool,
}

// ---------- Handlers ----------

async fn create_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateGroupRequest>,
) -> Result<Json<CreateGroupResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        subject = %body.subject,
        participant_count = body.participants.len(),
        "groups: create"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let temp_request_id = format!("grp_{}", uuid::Uuid::new_v4());
    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "group_create",
        "tempRequestId": temp_request_id,
        "subject": body.subject,
        "participants": body.participants,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "group.create".into(),
            target_kind: Some("group".into()),
            target_id: Some(temp_request_id.clone()),
            metadata: serde_json::json!({
                "subject": body.subject,
                "participantCount": body.participants.len(),
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(CreateGroupResponse {
        queued: true,
        queue_key,
        temp_request_id,
    }))
}

async fn list_groups(
    State(state): State<AppState>,
    Query(q): Query<ListGroupsQuery>,
) -> Result<Json<ListGroupsResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, category = ?q.category, "groups: list");

    let rows = crate::db::groups::list(&state.db, &q.session_id, q.category.as_deref()).await?;
    let groups = rows
        .into_iter()
        .map(|g| GroupSummary {
            jid: g.jid,
            subject: g.subject,
            description: g.description,
            participant_count: g.participant_count,
            category: g.category,
            announcement: g.announcement,
            restrict: g.restrict,
        })
        .collect();
    Ok(Json(ListGroupsResponse { groups }))
}

async fn get_group(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Query(q): Query<GroupSessionQuery>,
) -> Result<Json<GroupDetail>, AppError> {
    tracing::info!(session_id = %q.session_id, jid = %jid, "groups: get");

    let g = crate::db::groups::get(&state.db, &q.session_id, &jid).await?;
    Ok(Json(GroupDetail {
        jid: g.jid,
        subject: g.subject,
        description: g.description,
        creator: g.creator,
        announcement: g.announcement,
        restrict: g.restrict,
        ephemeral_duration: g.ephemeral_duration,
        category: g.category,
        participants: g
            .participants
            .into_iter()
            .map(|p| GroupParticipant {
                jid: p.jid,
                is_admin: p.is_admin,
                is_super_admin: p.is_super_admin,
            })
            .collect(),
    }))
}

async fn update_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(jid): Path<String>,
    Json(body): Json<UpdateGroupRequest>,
) -> Result<Json<UpdateGroupResponse>, AppError> {
    tracing::info!(session_id = %body.session_id, jid = %jid, "groups: update");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    // Category is a SabWa-side concept and never hits WA — write it directly.
    if let Some(category) = body.category.as_deref() {
        crate::db::groups::set_category(&state.db, &body.session_id, &jid, category).await?;
    }

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "group_update",
        "jid": jid,
        "subject": body.subject,
        "description": body.description,
        "iconUrl": body.icon_url,
        "announcement": body.announcement,
        "restrict": body.restrict,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "group.update".into(),
            target_kind: Some("group".into()),
            target_id: Some(jid.clone()),
            metadata: serde_json::json!({
                "subject": body.subject,
                "description": body.description,
                "iconUrl": body.icon_url,
                "announcement": body.announcement,
                "restrict": body.restrict,
                "category": body.category,
            }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(UpdateGroupResponse {
        jid,
        queued: true,
    }))
}

async fn add_participants(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(jid): Path<String>,
    Json(body): Json<ParticipantsRequest>,
) -> Result<Json<ParticipantsResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        jid = %jid,
        count = body.jids.len(),
        "groups: add participants"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "group_participants_add",
        "jid": jid,
        "jids": body.jids,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "group.add_participants".into(),
            target_kind: Some("group".into()),
            target_id: Some(jid.clone()),
            metadata: serde_json::json!({ "jids": body.jids }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(ParticipantsResponse {
        jid,
        op: "add".into(),
        queued: true,
    }))
}

async fn remove_participants(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(jid): Path<String>,
    Json(body): Json<ParticipantsRequest>,
) -> Result<Json<ParticipantsResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        jid = %jid,
        count = body.jids.len(),
        "groups: remove participants"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "group_participants_remove",
        "jid": jid,
        "jids": body.jids,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "group.remove_participants".into(),
            target_kind: Some("group".into()),
            target_id: Some(jid.clone()),
            metadata: serde_json::json!({ "jids": body.jids }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(ParticipantsResponse {
        jid,
        op: "remove".into(),
        queued: true,
    }))
}

async fn promote_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(jid): Path<String>,
    Json(body): Json<ParticipantsRequest>,
) -> Result<Json<ParticipantsResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        jid = %jid,
        count = body.jids.len(),
        "groups: promote"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "group_admin_promote",
        "jid": jid,
        "jids": body.jids,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(body.session_id.clone()),
            action: "group.promote_admin".into(),
            target_kind: Some("group".into()),
            target_id: Some(jid.clone()),
            metadata: serde_json::json!({ "jids": body.jids }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(ParticipantsResponse {
        jid,
        op: "promote".into(),
        queued: true,
    }))
}

async fn demote_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((jid, participant_jid)): Path<(String, String)>,
    Query(q): Query<GroupSessionQuery>,
) -> Result<Json<ParticipantsResponse>, AppError> {
    tracing::info!(
        session_id = %q.session_id,
        jid = %jid,
        participant_jid = %participant_jid,
        "groups: demote"
    );

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", q.session_id);
    let payload = serde_json::json!({
        "op": "group_admin_demote",
        "jid": jid,
        "jids": [&participant_jid],
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    let _ = audit::record(
        &state,
        AuditEntry {
            project_id: String::new(),
            user_id: None,
            session_id: Some(q.session_id.clone()),
            action: "group.demote_admin".into(),
            target_kind: Some("group".into()),
            target_id: Some(jid.clone()),
            metadata: serde_json::json!({ "participantJid": participant_jid }),
            actor_ip,
            user_agent,
            ts: chrono::Utc::now(),
        },
    )
    .await;

    Ok(Json(ParticipantsResponse {
        jid,
        op: "demote".into(),
        queued: true,
    }))
}

async fn invite_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(jid): Path<String>,
    Query(q): Query<InviteLinkQuery>,
) -> Result<Json<InviteLinkResponse>, AppError> {
    let revoke = q.revoke.unwrap_or(false);
    tracing::info!(session_id = %q.session_id, jid = %jid, revoke, "groups: invite link");

    let (actor_ip, user_agent) = audit::extract_context(&headers);

    let queue_key = format!("sabwa:{}:outbound", q.session_id);
    let payload = serde_json::json!({
        "op": if revoke { "group_invite_revoke" } else { "group_invite_get" },
        "jid": jid,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    // Best-effort return of the cached invite code; worker will refresh.
    let cached = crate::db::groups::get_invite_code(&state.db, &q.session_id, &jid).await?;
    let invite_link = cached.map(|code| format!("https://chat.whatsapp.com/{}", code));

    // Only audit the mutating branch (revoke); plain reads stay quiet.
    if revoke {
        let _ = audit::record(
            &state,
            AuditEntry {
                project_id: String::new(),
                user_id: None,
                session_id: Some(q.session_id.clone()),
                action: "group.revoke_invite".into(),
                target_kind: Some("group".into()),
                target_id: Some(jid.clone()),
                metadata: serde_json::json!({}),
                actor_ip,
                user_agent,
                ts: chrono::Utc::now(),
            },
        )
        .await;
    }

    Ok(Json(InviteLinkResponse {
        jid,
        invite_link,
        revoked: revoke,
        queued: true,
    }))
}
