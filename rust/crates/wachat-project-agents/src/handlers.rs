//! HTTP handlers for the wachat project-agents domain.
//!
//! Each handler maps 1:1 to a function in
//! `src/app/wachat/settings/agents/actions.ts` (plus the project-scoped
//! add branch of `handleInviteAgent` in
//! `src/app/actions/team.actions.ts`):
//!
//! | Endpoint                                                  | TS source                    |
//! |-----------------------------------------------------------|------------------------------|
//! | `GET    /v1/wachat/project-agents/projects/{id}/agents`   | (reads `project.agents`)     |
//! | `POST   …/projects/{id}/agents/invite`                    | `handleInviteAgent` (add)    |
//! | `GET    …/projects/{id}/agents/{agentId}/open-tickets`    | `getAgentOpenTickets`        |
//! | `DELETE …/projects/{id}/agents/{agentId}`                 | `reassignAndRemoveAgent`     |
//! | `PATCH  …/projects/{id}/routing`                          | `updateProjectRoutingRules`  |
//! | `PUT    …/projects/{id}/agents/{agentId}/skills`          | `updateAgentSkills`          |
//!
//! ## Real collections (NO `wa_*` invented — data already exists)
//! - `projects`: embeds the `agents` array and `wachatSettings.routingStrategy`.
//! - `contacts`: carries `assignedAgentId` (a **string** userId) + `status`.
//! - `users`: invitee lookup by lowercased email.
//!
//! ## Tenancy
//! Mutations (invite / remove / routing / skills) use a **strict owner**
//! guard (`{ _id, userId: ObjectId(caller) }`), exactly matching the
//! legacy TS filters. The roster read uses an **owner-or-agent** guard so
//! members can view their own team. Every query is scoped to the caller.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    InviteAgentBody, InviteAgentResponse, ListAgentsResponse, OpenTicketsResponse, RemoveAgentBody,
    RoutingBody, SkillsBody, SuccessResponse,
};
use crate::state::WachatProjectAgentsState;

/// Real Mongo collection names — kept inline so review against the
/// legacy TS literal strings is trivial.
const PROJECTS_COLL: &str = "projects";
const CONTACTS_COLL: &str = "contacts";
const USERS_COLL: &str = "users";

/// `status` value that marks a resolved/closed ticket. Mirrors the TS
/// `status: { $ne: 'closed' }` predicate.
const CLOSED_STATUS: &str = "closed";

/// Allowed routing strategies (mirrors the page `Select` options).
const ROUTING_STRATEGIES: [&str; 3] = ["manual", "round-robin", "skill-based"];

// ===========================================================================
// Tenancy helpers
// ===========================================================================

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **strict owner** access — the filter used
/// by every TS mutation in `actions.ts`:
///
/// ```text
/// db.collection('projects').updateOne(
///   { _id: new ObjectId(projectId), userId: new ObjectId(session.user._id) }, ...)
/// ```
///
/// Returns `404` (collapsing not-found + not-owner) so project existence
/// is not leaked to non-owners.
async fn load_project_owned(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .find_one(doc! { "_id": project_oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one(owned)")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })
}

/// Load a project enforcing **owner-or-agent** access (read scope), so a
/// member can list their own project's roster.
async fn load_project_member(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .find_one(doc! {
            "_id": project_oid,
            "$or": [
                { "userId": uid },
                { "agents.userId": uid },
            ],
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.find_one(member)"))
        })?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })
}

// ===========================================================================
// GET /projects/{id}/agents
// ===========================================================================

/// `GET /projects/{id}/agents` — list the project's embedded `agents`.
///
/// The page renders `project.agents` directly; this exposes the same
/// array (cleaned for JSON) so the client no longer needs the raw
/// project document.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn list_agents(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(id): Path<String>,
) -> Result<Json<ListAgentsResponse>> {
    let project = load_project_member(&user, &state.mongo, &id).await?;

    let agents = match project.get_array("agents") {
        Ok(arr) => arr
            .iter()
            .filter_map(|b| b.as_document().cloned())
            .map(document_to_clean_json)
            .collect(),
        Err(_) => Vec::new(),
    };

    Ok(Json(ListAgentsResponse { agents }))
}

// ===========================================================================
// POST /projects/{id}/agents/invite
// ===========================================================================

/// `POST /projects/{id}/agents/invite` — add an existing registered user
/// as an agent on the project.
///
/// Mirrors the project-scoped add branch of `handleInviteAgent`
/// (team.actions.ts lines 256-288): strict-owner guard, look the user up
/// in `users` by lowercased email, dedupe against the current `agents`,
/// then `$addToSet` `{ userId, email, name, role }`.
///
/// NOTE: the e-mail invitation flow for *un-registered* addresses (the
/// `invitations` collection + nodemailer send) stays in the Next.js
/// action — it depends on the user's SMTP transporter and templated
/// HTML. This handler returns a clear `404` so the shim can fall back to
/// that path.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn invite_agent(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(id): Path<String>,
    Json(body): Json<InviteAgentBody>,
) -> Result<Json<InviteAgentResponse>> {
    let email = body.email.trim().to_lowercase();
    let role = body.role.trim();
    if email.is_empty() || role.is_empty() {
        return Err(ApiError::Validation("Missing required fields.".to_owned()));
    }

    // Strict-owner guard (matches `project.userId === session.user._id`).
    let project = load_project_owned(&user, &state.mongo, &id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;
    let caller_oid = user_oid(&user)?;

    // Find the invitee in `users` by lowercased email.
    let invitee = state
        .mongo
        .collection::<Document>(USERS_COLL)
        .find_one(doc! { "email": &email })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound(
                "No registered user with that email — send an email invitation instead.".to_owned(),
            )
        })?;

    let invitee_oid = invitee
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("user missing _id")))?;
    if invitee_oid == caller_oid {
        return Err(ApiError::Validation("You cannot invite yourself.".to_owned()));
    }
    let invitee_email = invitee.get_str("email").unwrap_or(&email).to_owned();
    let invitee_name = invitee.get_str("name").unwrap_or("").to_owned();

    // Dedupe against the existing agents array.
    let already = project
        .get_array("agents")
        .map(|arr| {
            arr.iter().any(|b| {
                b.as_document()
                    .and_then(|d| d.get_object_id("userId").ok())
                    .is_some_and(|oid| oid == invitee_oid)
            })
        })
        .unwrap_or(false);
    if already {
        return Err(ApiError::Conflict(
            "This user is already an agent on this project.".to_owned(),
        ));
    }

    let agent_doc = doc! {
        "userId": invitee_oid,
        "email": &invitee_email,
        "name": &invitee_name,
        "role": role,
    };

    state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid, "userId": caller_oid },
            doc! { "$addToSet": { "agents": agent_doc } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(addToSet agent)"))
        })?;

    Ok(Json(InviteAgentResponse {
        success: true,
        message: format!("{email} has been added to this project."),
    }))
}

// ===========================================================================
// GET /projects/{id}/agents/{agentId}/open-tickets
// ===========================================================================

/// `GET /projects/{id}/agents/{agentId}/open-tickets` — count the
/// non-closed contacts assigned to the agent.
///
/// Mirrors `getAgentOpenTickets`: `contacts.countDocuments({ projectId,
/// assignedAgentId: agentUserId, status: { $ne: 'closed' } })`. Note
/// `assignedAgentId` is stored as a **string** userId, so we filter by
/// the raw hex string (NOT an ObjectId).
#[instrument(skip_all, fields(project_id = %ids.0, agent_id = %ids.1))]
pub async fn open_tickets(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(ids): Path<(String, String)>,
) -> Result<Json<OpenTicketsResponse>> {
    let (project_id, agent_id) = ids;
    // Read-scope guard: caller must at least be an owner/agent of the project.
    let _ = load_project_member(&user, &state.mongo, &project_id).await?;
    let project_oid = oid_from_str(&project_id)?;

    let count = state
        .mongo
        .collection::<Document>(CONTACTS_COLL)
        .count_documents(doc! {
            "projectId": project_oid,
            "assignedAgentId": &agent_id,
            "status": { "$ne": CLOSED_STATUS },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.count(open-tickets)"))
        })?;

    Ok(Json(OpenTicketsResponse { count }))
}

// ===========================================================================
// DELETE /projects/{id}/agents/{agentId}
// ===========================================================================

/// `DELETE /projects/{id}/agents/{agentId}` — reassign the agent's open
/// tickets, then `$pull` them from the project's `agents` array.
///
/// Mirrors `reassignAndRemoveAgent`. `reassignToAgentId` is a **string**
/// userId; when absent the open tickets are unassigned
/// (`assignedAgentId: null`). The `$pull` matches the embedded agent by
/// `userId` (an `ObjectId`).
#[instrument(skip_all, fields(project_id = %ids.0, agent_id = %ids.1))]
pub async fn remove_agent(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(ids): Path<(String, String)>,
    Json(body): Json<RemoveAgentBody>,
) -> Result<Json<SuccessResponse>> {
    let (project_id, agent_id) = ids;

    // Strict-owner guard + delete permission.
    let project = load_project_owned(&user, &state.mongo, &project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;
    let caller_oid = user_oid(&user)?;

    // The agent id must be a valid ObjectId for the `$pull` on `agents.userId`.
    let agent_oid = oid_from_str(&agent_id)
        .map_err(|_| ApiError::BadRequest("Invalid agent id.".to_owned()))?;

    // ---- 1. Reassign / unassign the open tickets -----------------------
    //
    // `assignedAgentId` is a string userId; the new value is the
    // reassign target string, or BSON null to unassign.
    let new_assignee: Bson = match body
        .reassign_to_agent_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(target) => Bson::String(target.to_owned()),
        None => Bson::Null,
    };

    state
        .mongo
        .collection::<Document>(CONTACTS_COLL)
        .update_many(
            doc! {
                "projectId": project_oid,
                "assignedAgentId": &agent_id,
                "status": { "$ne": CLOSED_STATUS },
            },
            doc! { "$set": { "assignedAgentId": new_assignee } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.update_many(reassign)"))
        })?;

    // ---- 2. Pull the agent from the project ----------------------------
    let res = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid, "userId": caller_oid },
            doc! { "$pull": { "agents": { "userId": agent_oid } } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one($pull agent)"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound(
            "Project not found or you do not have permission.".to_owned(),
        ));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PATCH /projects/{id}/routing
// ===========================================================================

/// `PATCH /projects/{id}/routing` — set
/// `wachatSettings.routingStrategy` on the project.
///
/// Mirrors `updateProjectRoutingRules`. Validates the strategy against
/// the page's `Select` options before writing (the TS code did not, but
/// the closed enum makes a 422 the correct response for junk input).
#[instrument(skip_all, fields(project_id = %id))]
pub async fn update_routing(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(id): Path<String>,
    Json(body): Json<RoutingBody>,
) -> Result<Json<SuccessResponse>> {
    let strategy = body.routing_strategy.trim();
    if !ROUTING_STRATEGIES.contains(&strategy) {
        return Err(ApiError::Validation(
            "routingStrategy must be 'manual', 'round-robin', or 'skill-based'.".to_owned(),
        ));
    }
    let project_oid = oid_from_str(&id)?;
    let caller_oid = user_oid(&user)?;

    let res = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid, "userId": caller_oid },
            doc! { "$set": { "wachatSettings.routingStrategy": strategy } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(routing)"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound(
            "Project not found or you do not have permission.".to_owned(),
        ));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PUT /projects/{id}/agents/{agentId}/skills
// ===========================================================================

/// `PUT /projects/{id}/agents/{agentId}/skills` — replace the matched
/// agent's `skills` array (`agents.$.skills`).
///
/// Mirrors `updateAgentSkills`: filter by `{ _id, userId,
/// 'agents.userId': agentOid }` and `$set` `agents.$.skills`. A
/// `matched_count == 0` means the agent is not on the project (or the
/// caller is not the owner).
#[instrument(skip_all, fields(project_id = %ids.0, agent_id = %ids.1))]
pub async fn update_skills(
    user: AuthUser,
    State(state): State<WachatProjectAgentsState>,
    Path(ids): Path<(String, String)>,
    Json(body): Json<SkillsBody>,
) -> Result<Json<SuccessResponse>> {
    let (project_id, agent_id) = ids;
    let project_oid = oid_from_str(&project_id)?;
    let agent_oid = oid_from_str(&agent_id)
        .map_err(|_| ApiError::BadRequest("Invalid agent id.".to_owned()))?;
    let caller_oid = user_oid(&user)?;

    let skills: Vec<Bson> = body
        .skills
        .iter()
        .map(|s| Bson::String(s.clone()))
        .collect();

    let res = state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! {
                "_id": project_oid,
                "userId": caller_oid,
                "agents.userId": agent_oid,
            },
            doc! { "$set": { "agents.$.skills": Bson::Array(skills) } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(skills)"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound(
            "Agent not found on this project, or you do not have permission.".to_owned(),
        ));
    }

    Ok(Json(SuccessResponse::ok()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routing_strategies_match_page_select() {
        assert!(ROUTING_STRATEGIES.contains(&"manual"));
        assert!(ROUTING_STRATEGIES.contains(&"round-robin"));
        assert!(ROUTING_STRATEGIES.contains(&"skill-based"));
        assert!(!ROUTING_STRATEGIES.contains(&"bogus"));
    }
}
