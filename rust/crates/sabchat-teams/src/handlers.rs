//! HTTP handlers for the SabChat **teams + skills + presence** domain.
//!
//! Each handler maps 1:1 to a route mounted under `/v1/sabchat/teams`.
//! Four collections back this surface:
//!
//! - `sabchat_teams`           — one doc per team, with member + inbox arrays.
//! - `sabchat_skills`          — flat skill catalog (tenant-scoped).
//! - `sabchat_agent_skills`    — agent ⇄ skill matrix rows (`level: 1..5`).
//! - `sabchat_agent_presence`  — one row per agent, current status + audit.
//!
//! ## Tenancy
//!
//! Every read and write filters on `tenantId = ObjectId(auth.tenant_id)`.
//! A malformed JWT subject yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized) — no
//! cross-tenant access is possible from the wire.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AddTeamInboxBody, AddTeamMemberBody, CreateSkillBody, CreateSkillResponse, CreateTeamBody,
    CreateTeamResponse, GetSkillResponse, GetTeamResponse, ListAgentSkillsResponse,
    ListPresenceResponse, ListSkillsResponse, ListTeamsResponse, SetPresenceBody, SuccessResponse,
    UpdateSkillBody, UpdateTeamBody, UpsertAgentSkillBody,
};
use crate::state::SabChatTeamsState;

/// Mongo collection names — inline so each handler's I/O target is greppable.
const TEAMS_COLL: &str = "sabchat_teams";
const SKILLS_COLL: &str = "sabchat_skills";
const AGENT_SKILLS_COLL: &str = "sabchat_agent_skills";
const PRESENCE_COLL: &str = "sabchat_agent_presence";

/// Whitelist of accepted presence `status` values. Anything else is a 400.
const VALID_PRESENCE_STATUSES: &[&str] = &["online", "away", "busy", "offline"];

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the JWT tenant claim into an `ObjectId`. A malformed claim yields
/// `401 Unauthorized` — the token is structurally invalid, not the request.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Same shape as [`tenant_oid`] but for the user / actor id on the JWT.
fn actor_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Parse a comma-free list of hex object ids; empty strings are skipped.
fn parse_oid_list(ids: &[String]) -> Result<Vec<ObjectId>> {
    ids.iter()
        .map(String::as_str)
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .collect()
}

// ===========================================================================
// POST /v1/sabchat/teams — create_team
// ===========================================================================

/// `POST /v1/sabchat/teams` — create a new team under the calling tenant.
///
/// `memberIds` and `inboxIds` may be supplied at create-time. Both are
/// validated as hex object ids; empty strings are filtered out.
#[instrument(skip_all)]
pub async fn create_team(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Json(body): Json<CreateTeamBody>,
) -> Result<Json<CreateTeamResponse>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;

    let member_oids = parse_oid_list(&body.member_ids)?;
    let inbox_oids = parse_oid_list(&body.inbox_ids)?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let team_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_id,
        "name": body.name.trim(),
        "memberIds": Bson::Array(member_oids.into_iter().map(Bson::ObjectId).collect()),
        "inboxIds": Bson::Array(inbox_oids.into_iter().map(Bson::ObjectId).collect()),
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .insert_one(team_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.insert_one"))
        })?;

    Ok(Json(CreateTeamResponse {
        team_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /v1/sabchat/teams — list_teams
// ===========================================================================

/// `GET /v1/sabchat/teams` — list every team the calling tenant owns,
/// sorted by `createdAt` descending.
#[instrument(skip_all)]
pub async fn list_teams(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
) -> Result<Json<ListTeamsResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();

    let cursor = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .find(doc! { "tenantId": tenant_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.collect")))?;

    let teams: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListTeamsResponse { teams }))
}

// ===========================================================================
// GET /v1/sabchat/teams/{id} — get_team
// ===========================================================================

/// `GET /v1/sabchat/teams/{id}` — fetch a single team by id.
#[instrument(skip_all, fields(team_id = %id))]
pub async fn get_team(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
) -> Result<Json<GetTeamResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;

    let team = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .find_one(doc! { "_id": team_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.find_one")))?
        .ok_or_else(|| ApiError::NotFound("team not found".to_owned()))?;

    Ok(Json(GetTeamResponse {
        team: document_to_clean_json(team),
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/teams/{id} — update_team
// ===========================================================================

/// `PATCH /v1/sabchat/teams/{id}` — partial update (currently only `name`).
/// Member / inbox arrays are mutated through their dedicated endpoints so
/// the audit story for membership changes stays tight.
#[instrument(skip_all, fields(team_id = %id))]
pub async fn update_team(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTeamBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;

    let mut set_doc = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(name) = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set_doc.insert("name", name);
    }

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .update_one(
            doc! { "_id": team_oid, "tenantId": tenant_id },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.update_one"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/teams/{id} — delete_team
// ===========================================================================

/// `DELETE /v1/sabchat/teams/{id}` — hard delete a team. Memberships /
/// inbox bindings live on the team doc itself, so removing it removes the
/// edges; nothing else references team ids except routing rules, which
/// resolve lazily.
#[instrument(skip_all, fields(team_id = %id))]
pub async fn delete_team(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .delete_one(doc! { "_id": team_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.delete_one"))
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/teams/{id}/members — add_team_member
// ===========================================================================

/// `POST /v1/sabchat/teams/{id}/members` — append an agent to `memberIds`
/// via `$addToSet` (re-adding is a no-op).
#[instrument(skip_all, fields(team_id = %id))]
pub async fn add_team_member(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
    Json(body): Json<AddTeamMemberBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;
    let agent_oid = oid_from_str(&body.agent_id)?;

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .update_one(
            doc! { "_id": team_oid, "tenantId": tenant_id },
            doc! {
                "$addToSet": { "memberIds": agent_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_teams.update_one(add_member)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/teams/{id}/members/{agentId} — remove_team_member
// ===========================================================================

/// `DELETE /v1/sabchat/teams/{id}/members/{agentId}` — drop an agent from
/// `memberIds` via `$pull`. Removing a missing agent is a no-op.
#[instrument(skip_all, fields(team_id = %id, agent_id = %agent_id))]
pub async fn remove_team_member(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path((id, agent_id)): Path<(String, String)>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;
    let agent_oid = oid_from_str(&agent_id)?;

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .update_one(
            doc! { "_id": team_oid, "tenantId": tenant_id },
            doc! {
                "$pull": { "memberIds": agent_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_teams.update_one(remove_member)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/teams/{id}/inboxes — add_team_inbox
// ===========================================================================

/// `POST /v1/sabchat/teams/{id}/inboxes` — attach an inbox to `inboxIds`
/// via `$addToSet`.
#[instrument(skip_all, fields(team_id = %id))]
pub async fn add_team_inbox(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
    Json(body): Json<AddTeamInboxBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;
    let inbox_oid = oid_from_str(&body.inbox_id)?;

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .update_one(
            doc! { "_id": team_oid, "tenantId": tenant_id },
            doc! {
                "$addToSet": { "inboxIds": inbox_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_teams.update_one(add_inbox)"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/teams/{id}/inboxes/{inboxId} — remove_team_inbox
// ===========================================================================

/// `DELETE /v1/sabchat/teams/{id}/inboxes/{inboxId}` — detach an inbox
/// from `inboxIds` via `$pull`.
#[instrument(skip_all, fields(team_id = %id, inbox_id = %inbox_id))]
pub async fn remove_team_inbox(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path((id, inbox_id)): Path<(String, String)>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let team_oid = oid_from_str(&id)?;
    let inbox_oid = oid_from_str(&inbox_id)?;

    let res = state
        .mongo
        .collection::<Document>(TEAMS_COLL)
        .update_one(
            doc! { "_id": team_oid, "tenantId": tenant_id },
            doc! {
                "$pull": { "inboxIds": inbox_oid },
                "$set": { "updatedAt": bson::DateTime::from_chrono(Utc::now()) },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_teams.update_one(remove_inbox)"),
            )
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("team not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/teams/skills — create_skill
// ===========================================================================

/// `POST /v1/sabchat/teams/skills` — create a skill in the tenant catalog.
#[instrument(skip_all)]
pub async fn create_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Json(body): Json<CreateSkillBody>,
) -> Result<Json<CreateSkillResponse>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let mut skill_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_id,
        "name": body.name.trim(),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(desc) = body.description.as_deref().filter(|s| !s.is_empty()) {
        skill_doc.insert("description", desc);
    }

    state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .insert_one(skill_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.insert_one"))
        })?;

    Ok(Json(CreateSkillResponse {
        skill_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /v1/sabchat/teams/skills — list_skills
// ===========================================================================

/// `GET /v1/sabchat/teams/skills` — list every skill in the tenant catalog,
/// sorted by `name` ascending.
#[instrument(skip_all)]
pub async fn list_skills(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
) -> Result<Json<ListSkillsResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let opts = FindOptions::builder().sort(doc! { "name": 1 }).build();

    let cursor = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .find(doc! { "tenantId": tenant_id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.collect")))?;

    let skills: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListSkillsResponse { skills }))
}

// ===========================================================================
// GET /v1/sabchat/teams/skills/{id} — get_skill
// ===========================================================================

/// `GET /v1/sabchat/teams/skills/{id}` — fetch a single skill.
#[instrument(skip_all, fields(skill_id = %id))]
pub async fn get_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
) -> Result<Json<GetSkillResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let skill_oid = oid_from_str(&id)?;

    let skill = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .find_one(doc! { "_id": skill_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.find_one")))?
        .ok_or_else(|| ApiError::NotFound("skill not found".to_owned()))?;

    Ok(Json(GetSkillResponse {
        skill: document_to_clean_json(skill),
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/teams/skills/{id} — update_skill
// ===========================================================================

/// `PATCH /v1/sabchat/teams/skills/{id}` — partial update of name and / or
/// description.
#[instrument(skip_all, fields(skill_id = %id))]
pub async fn update_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSkillBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let skill_oid = oid_from_str(&id)?;

    let mut set_doc = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(name) = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        set_doc.insert("name", name);
    }
    if let Some(desc) = body.description.as_ref() {
        if desc.is_empty() {
            set_doc.insert("description", Bson::Null);
        } else {
            set_doc.insert("description", desc.as_str());
        }
    }

    let res = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .update_one(
            doc! { "_id": skill_oid, "tenantId": tenant_id },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.update_one"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("skill not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/teams/skills/{id} — delete_skill
// ===========================================================================

/// `DELETE /v1/sabchat/teams/skills/{id}` — hard delete a skill. Any
/// agent-skill matrix rows referencing the skill are cleaned up so the
/// matrix doesn't accumulate orphans.
#[instrument(skip_all, fields(skill_id = %id))]
pub async fn delete_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let skill_oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .delete_one(doc! { "_id": skill_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.delete_one"))
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("skill not found".to_owned()));
    }

    // Best-effort matrix cleanup; the skill is already gone so a failure
    // here just leaves rows that no longer resolve — not a 5xx for the
    // caller's primary mutation.
    if let Err(e) = state
        .mongo
        .collection::<Document>(AGENT_SKILLS_COLL)
        .delete_many(doc! { "tenantId": tenant_id, "skillId": skill_oid })
        .await
    {
        tracing::error!(error = %e, "failed to clean sabchat_agent_skills rows after skill delete");
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/teams/skills/{skillId}/agents — upsert_agent_skill
// ===========================================================================

/// `POST /v1/sabchat/teams/skills/{skillId}/agents` — upsert one row in
/// the agent ⇄ skill matrix. Uniqueness is enforced at the application
/// layer: `(tenantId, agentId, skillId)`. Existing rows have their `level`
/// updated in place; new rows are inserted with a fresh `_id`.
#[instrument(skip_all, fields(skill_id = %skill_id))]
pub async fn upsert_agent_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(skill_id): Path<String>,
    Json(body): Json<UpsertAgentSkillBody>,
) -> Result<Json<SuccessResponse>> {
    if !(1..=5).contains(&body.level) {
        return Err(ApiError::Validation(format!(
            "level must be in 1..=5, got {}",
            body.level
        )));
    }

    let tenant_id = tenant_oid(&user)?;
    let skill_oid = oid_from_str(&skill_id)?;
    let agent_oid = oid_from_str(&body.agent_id)?;

    // Confirm the skill belongs to this tenant before we touch the matrix.
    let exists = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .find_one(doc! { "_id": skill_oid, "tenantId": tenant_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_skills.find_one(upsert_agent_skill)"),
            )
        })?;
    if exists.is_none() {
        return Err(ApiError::NotFound("skill not found".to_owned()));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = state.mongo.collection::<Document>(AGENT_SKILLS_COLL);

    let filter = doc! {
        "tenantId": tenant_id,
        "agentId": agent_oid,
        "skillId": skill_oid,
    };
    let update = doc! {
        "$set": { "level": body.level },
        "$setOnInsert": {
            "_id": ObjectId::new(),
            "tenantId": tenant_id,
            "agentId": agent_oid,
            "skillId": skill_oid,
            "createdAt": now,
        },
    };

    coll.update_one(filter, update)
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_agent_skills.update_one(upsert)"),
            )
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/teams/skills/{skillId}/agents/{agentId} — remove_agent_skill
// ===========================================================================

/// `DELETE /v1/sabchat/teams/skills/{skillId}/agents/{agentId}` — drop a
/// single row from the agent ⇄ skill matrix. Missing rows yield 404 so
/// callers can distinguish "already gone" from silent success.
#[instrument(skip_all, fields(skill_id = %skill_id, agent_id = %agent_id))]
pub async fn remove_agent_skill(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path((skill_id, agent_id)): Path<(String, String)>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let skill_oid = oid_from_str(&skill_id)?;
    let agent_oid = oid_from_str(&agent_id)?;

    let res = state
        .mongo
        .collection::<Document>(AGENT_SKILLS_COLL)
        .delete_one(doc! {
            "tenantId": tenant_id,
            "agentId": agent_oid,
            "skillId": skill_oid,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_agent_skills.delete_one"))
        })?;

    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("agent-skill row not found".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/sabchat/teams/agents/{agentId}/skills — list_agent_skills
// ===========================================================================

/// `GET /v1/sabchat/teams/agents/{agentId}/skills` — list this agent's
/// skill matrix rows joined with the skill catalog so each row carries
/// `{ skillId, name, level }`.
///
/// Implemented as an in-process join (one matrix query + one catalog
/// lookup) — the typical skill catalog is small enough that this is
/// faster and simpler than an aggregation pipeline.
#[instrument(skip_all, fields(agent_id = %agent_id))]
pub async fn list_agent_skills(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Path(agent_id): Path<String>,
) -> Result<Json<ListAgentSkillsResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let agent_oid = oid_from_str(&agent_id)?;

    // ---- Matrix rows ------------------------------------------------
    let cursor = state
        .mongo
        .collection::<Document>(AGENT_SKILLS_COLL)
        .find(doc! { "tenantId": tenant_id, "agentId": agent_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_agent_skills.find"))
        })?;
    let rows: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_agent_skills.collect"))
    })?;

    if rows.is_empty() {
        return Ok(Json(ListAgentSkillsResponse { skills: Vec::new() }));
    }

    // ---- Catalog lookup by `_id $in [...]` --------------------------
    let skill_oids: Vec<Bson> = rows
        .iter()
        .filter_map(|r| r.get_object_id("skillId").ok().map(Bson::ObjectId))
        .collect();

    let skill_cursor = state
        .mongo
        .collection::<Document>(SKILLS_COLL)
        .find(doc! {
            "tenantId": tenant_id,
            "_id": { "$in": Bson::Array(skill_oids) },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.find($in)"))
        })?;
    let skill_docs: Vec<Document> = skill_cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_skills.collect($in)"))
    })?;

    // Build a hex -> name map for the in-process join.
    let mut name_by_skill: std::collections::HashMap<String, String> =
        std::collections::HashMap::with_capacity(skill_docs.len());
    for sd in skill_docs {
        if let (Ok(oid), Ok(name)) = (sd.get_object_id("_id"), sd.get_str("name")) {
            name_by_skill.insert(oid.to_hex(), name.to_owned());
        }
    }

    // ---- Stitch ------------------------------------------------------
    let skills: Vec<Value> = rows
        .into_iter()
        .filter_map(|row| {
            let skill_oid = row.get_object_id("skillId").ok()?;
            let level = row.get_i32("level").ok().unwrap_or_default();
            let hex = skill_oid.to_hex();
            let name = name_by_skill.get(&hex).cloned().unwrap_or_default();
            Some(serde_json::json!({
                "skillId": hex,
                "name": name,
                "level": level,
            }))
        })
        .collect();

    Ok(Json(ListAgentSkillsResponse { skills }))
}

// ===========================================================================
// POST /v1/sabchat/teams/presence — set_presence (self)
// ===========================================================================

/// `POST /v1/sabchat/teams/presence` — agent self-sets their availability.
///
/// `setBy` is hard-coded to `"agent"` on this path; HRM / system writes
/// go through an internal helper that is not exposed over this router so
/// the source of every status change stays unambiguous in the audit row.
#[instrument(skip_all)]
pub async fn set_presence(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
    Json(body): Json<SetPresenceBody>,
) -> Result<Json<SuccessResponse>> {
    let status = body.status.trim();
    if !VALID_PRESENCE_STATUSES.contains(&status) {
        return Err(ApiError::BadRequest(format!(
            "invalid status `{status}`; expected one of: {}",
            VALID_PRESENCE_STATUSES.join(", "),
        )));
    }

    let tenant_id = tenant_oid(&user)?;
    let agent_id = actor_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let filter = doc! { "agentId": agent_id, "tenantId": tenant_id };
    let update = doc! {
        "$set": {
            "status": status,
            "setAt": now,
            "setBy": "agent",
            "tenantId": tenant_id,
            "agentId": agent_id,
        },
        "$setOnInsert": { "_id": ObjectId::new() },
    };

    state
        .mongo
        .collection::<Document>(PRESENCE_COLL)
        .update_one(filter, update)
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_agent_presence.update_one(upsert)"),
            )
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/sabchat/teams/presence — list_presence
// ===========================================================================

/// `GET /v1/sabchat/teams/presence` — list every presence row for the
/// calling tenant, newest `setAt` first. The inbox UI uses this to paint
/// availability dots next to agent avatars.
#[instrument(skip_all)]
pub async fn list_presence(
    user: AuthUser,
    State(state): State<SabChatTeamsState>,
) -> Result<Json<ListPresenceResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let opts = FindOptions::builder().sort(doc! { "setAt": -1 }).build();

    let cursor = state
        .mongo
        .collection::<Document>(PRESENCE_COLL)
        .find(doc! { "tenantId": tenant_id })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_agent_presence.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_agent_presence.collect"))
    })?;

    let presence: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListPresenceResponse { presence }))
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presence_whitelist_is_closed() {
        for s in VALID_PRESENCE_STATUSES {
            assert!(!s.is_empty());
        }
        assert!(!VALID_PRESENCE_STATUSES.contains(&"unknown"));
    }

    #[test]
    fn parse_oid_list_skips_empty() {
        let ids = vec!["".to_owned(), ObjectId::new().to_hex()];
        let out = parse_oid_list(&ids).expect("valid oid list");
        assert_eq!(out.len(), 1);
    }
}
