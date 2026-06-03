//! HTTP handlers for the wachat-facebook-agents router.
//!
//! Mirrors the **Agents / Knowledge / Moderation / Audience** slice of
//! `src/app/actions/facebook.actions.ts` — 14 server actions ported 1:1.
//!
//! Multipart `uploadKnowledgeDoc` stays in TS (binary upload to blob
//! storage); this surface accepts an already-parsed `content` string and
//! optional `blobUrl` reference.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AgentsResp, CommentAutoReplyBody, CreateAgentBody, DocsResp, MessageResp, OkResp, RulesResp,
    SaveAudienceSegmentBody, SaveModerationRuleBody, SegmentsResp, UpdateAgentBody,
    UploadKnowledgeDocBody,
};
use crate::state::WachatFacebookAgentsState;

const PROJECTS_COLL: &str = "projects";
const AGENTS_COLL: &str = "facebook_agents";
const KNOWLEDGE_COLL: &str = "knowledge_docs";
const MODERATION_COLL: &str = "fb_moderation_rules";
const AUDIENCE_COLL: &str = "fb_audience_segments";

// ---------------------------------------------------------------------------
// Tenancy gate — inlined per task spec.
// ---------------------------------------------------------------------------

/// Lightweight project handle used by this crate. We only need the project's
/// own `_id` for child-collection lookups; tenant ownership is verified during
/// load. Reading the raw `Document` (instead of `wachat_types::Project`) avoids
/// schema-drift deserialization failures on legacy/mixed-shape project rows.
pub(crate) struct ProjectRef {
    pub id: ObjectId,
}

/// Tenant gate for project-scoped routes. Returns 404 for missing
/// projects, 403 for non-owners. Reads the project document untyped so
/// stale/legacy fields cannot crash the handler.
#[instrument(skip_all, fields(project_id = %project_id_hex))]
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<ProjectRef> {
    let oid = ObjectId::parse_str(project_id_hex)
        .map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    let owner = project
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?;
    if user.tenant_id != owner.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(ProjectRef { id: oid })
}

/// Resolve a child document by `_id`, then verify the project that owns
/// it belongs to the caller. Used by the per-record DELETE / PATCH
/// endpoints (agent/doc/rule/segment) which take only their own id.
async fn resolve_child_and_check(
    user: &AuthUser,
    mongo: &MongoHandle,
    coll_name: &str,
    id_hex: &str,
    not_found_label: &str,
) -> Result<(ObjectId, Document)> {
    let oid = ObjectId::parse_str(id_hex)
        .map_err(|_| ApiError::BadRequest(format!("invalid {not_found_label} id")))?;
    let coll = mongo.collection::<Document>(coll_name);
    let record = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(not_found_label.to_owned()))?;

    let project_oid = record
        .get_object_id("projectId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("record missing projectId")))?;
    let _ = load_project_for(user, mongo, &project_oid.to_hex()).await?;
    Ok((oid, record))
}

async fn list_for_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
    coll_name: &str,
) -> Result<Vec<Value>> {
    let project = load_project_for(user, mongo, project_id).await?;
    let coll = mongo.collection::<Document>(coll_name);
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(docs.into_iter().map(document_to_clean_json).collect())
}

// ---------------------------------------------------------------------------
// AGENTS — getFacebookAgents / createFacebookAgent / update / delete
// ---------------------------------------------------------------------------

/// `GET /projects/{project_id}/agents` — `getFacebookAgents`.
pub async fn get_agents(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
) -> Result<Json<AgentsResp>> {
    let agents = list_for_project(&user, &state.mongo, &project_id, AGENTS_COLL).await?;
    Ok(Json(AgentsResp { agents }))
}

/// `POST /projects/{project_id}/agents` — `createFacebookAgent`.
pub async fn create_agent(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
    Json(body): Json<CreateAgentBody>,
) -> Result<Json<MessageResp>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Agent name is required.".to_owned()));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = state.mongo.collection::<Document>(AGENTS_COLL);
    let mut to_insert = doc! {
        "projectId": project.id,
        "name": &body.name,
        "personality": body.personality.unwrap_or_else(|| "friendly and helpful".to_owned()),
        "welcomeMessage": body.welcome_message.unwrap_or_else(|| "Hi! How can I help you today?".to_owned()),
        "fallbackMessage": body.fallback_message.unwrap_or_else(|| "Let me connect you with a human agent.".to_owned()),
        "isActive": body.is_active,
        "knowledgeSources": Vec::<Bson>::new(),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(model) = body.model.filter(|s| !s.is_empty()) {
        to_insert.insert("model", model);
    }
    coll.insert_one(to_insert)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(MessageResp {
        message: format!("Agent \"{}\" created successfully!", body.name),
    }))
}

/// `PATCH /agents/{agent_id}` — `updateFacebookAgent`.
pub async fn update_agent(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(agent_id): Path<String>,
    Json(body): Json<UpdateAgentBody>,
) -> Result<Json<OkResp>> {
    let (oid, _) =
        resolve_child_and_check(&user, &state.mongo, AGENTS_COLL, &agent_id, "agent").await?;

    // Convert the free-form $set payload from JSON to BSON so it round-trips
    // unchanged into the document.
    let mut set_doc = match bson::to_bson(&Value::Object(body.updates))
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        Bson::Document(d) => d,
        _ => Document::new(),
    };
    set_doc.insert("updatedAt", bson::DateTime::from_chrono(Utc::now()));

    let coll = state.mongo.collection::<Document>(AGENTS_COLL);
    coll.update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}

/// `DELETE /agents/{agent_id}` — `deleteFacebookAgent`.
pub async fn delete_agent(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(agent_id): Path<String>,
) -> Result<Json<OkResp>> {
    let (oid, _) =
        resolve_child_and_check(&user, &state.mongo, AGENTS_COLL, &agent_id, "agent").await?;
    let coll = state.mongo.collection::<Document>(AGENTS_COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}

// ---------------------------------------------------------------------------
// KNOWLEDGE BASE — get / upload / delete
// ---------------------------------------------------------------------------

/// `GET /projects/{project_id}/knowledge-docs` — `getKnowledgeDocs`.
pub async fn get_knowledge_docs(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
) -> Result<Json<DocsResp>> {
    let docs = list_for_project(&user, &state.mongo, &project_id, KNOWLEDGE_COLL).await?;
    Ok(Json(DocsResp { docs }))
}

/// `POST /projects/{project_id}/knowledge-docs` — `uploadKnowledgeDoc`.
///
/// Multipart binary stays in TS — the shim uploads to blob storage and
/// posts the parsed text + optional `blobUrl` reference here.
pub async fn upload_knowledge_doc(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
    Json(body): Json<UploadKnowledgeDocBody>,
) -> Result<Json<MessageResp>> {
    if body.title.trim().is_empty() || body.content.is_empty() {
        return Err(ApiError::BadRequest(
            "Title and content are required.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(KNOWLEDGE_COLL);
    let char_count = body.content.chars().count() as i64;
    let mut to_insert = doc! {
        "projectId": project.id,
        "title": &body.title,
        "content": &body.content,
        "docType": body.doc_type.unwrap_or_else(|| "text".to_owned()),
        "charCount": char_count,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(url) = body.blob_url.filter(|s| !s.is_empty()) {
        to_insert.insert("blobUrl", url);
    }
    coll.insert_one(to_insert)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(MessageResp {
        message: format!("Document \"{}\" added to knowledge base.", body.title),
    }))
}

/// `DELETE /knowledge-docs/{doc_id}` — `deleteKnowledgeDoc`.
pub async fn delete_knowledge_doc(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(doc_id): Path<String>,
) -> Result<Json<OkResp>> {
    let (oid, _) = resolve_child_and_check(
        &user,
        &state.mongo,
        KNOWLEDGE_COLL,
        &doc_id,
        "knowledge document",
    )
    .await?;
    let coll = state.mongo.collection::<Document>(KNOWLEDGE_COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}

// ---------------------------------------------------------------------------
// MODERATION RULES — get / save / delete
// ---------------------------------------------------------------------------

/// `GET /projects/{project_id}/moderation-rules` — `getModerationRules`.
pub async fn get_moderation_rules(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
) -> Result<Json<RulesResp>> {
    let rules = list_for_project(&user, &state.mongo, &project_id, MODERATION_COLL).await?;
    Ok(Json(RulesResp { rules }))
}

/// `POST /projects/{project_id}/moderation-rules` — `saveModerationRule`
/// (upsert-by-`ruleId`).
pub async fn save_moderation_rule(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveModerationRuleBody>,
) -> Result<Json<MessageResp>> {
    if body.keywords.trim().is_empty() || body.action.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Keywords and action are required.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = state.mongo.collection::<Document>(MODERATION_COLL);

    let keyword_list: Vec<String> = body
        .keywords
        .split(',')
        .map(|k| k.trim().to_lowercase())
        .filter(|k| !k.is_empty())
        .collect();

    let auto_reply_text = body.auto_reply_text.unwrap_or_default();

    let upsert_existing = body
        .rule_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());

    if let Some(rule_oid) = upsert_existing {
        let mut set_doc = doc! {
            "keywords": &keyword_list,
            "action": &body.action,
            "autoReplyText": &auto_reply_text,
            "isActive": body.is_active,
            "updatedAt": now,
        };
        // Only touch `name` when the caller actually sent it — `None`
        // means leave the existing title alone.
        if let Some(name) = body.name.as_ref() {
            set_doc.insert("name", name);
        }
        coll.update_one(doc! { "_id": rule_oid }, doc! { "$set": set_doc })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    } else {
        let mut to_insert = doc! {
            "projectId": project.id,
            "keywords": &keyword_list,
            "action": &body.action,
            "autoReplyText": &auto_reply_text,
            "isActive": body.is_active,
            "createdAt": now,
            "updatedAt": now,
        };
        if let Some(name) = body.name.as_ref() {
            to_insert.insert("name", name);
        }
        coll.insert_one(to_insert)
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    }
    Ok(Json(MessageResp {
        message: "Moderation rule saved.".to_owned(),
    }))
}

/// `DELETE /moderation-rules/{rule_id}` — `deleteModerationRule`.
pub async fn delete_moderation_rule(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(rule_id): Path<String>,
) -> Result<Json<OkResp>> {
    let (oid, _) = resolve_child_and_check(
        &user,
        &state.mongo,
        MODERATION_COLL,
        &rule_id,
        "moderation rule",
    )
    .await?;
    let coll = state.mongo.collection::<Document>(MODERATION_COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}

// ---------------------------------------------------------------------------
// COMMENT AUTO-REPLY — handleUpdateCommentAutoReply
// ---------------------------------------------------------------------------

/// `PUT /projects/{project_id}/comment-auto-reply` —
/// `handleUpdateCommentAutoReply`. Persists onto
/// `projects.facebookCommentAutoReply` as in the TS action.
pub async fn update_comment_auto_reply(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
    Json(body): Json<CommentAutoReplyBody>,
) -> Result<Json<OkResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    coll.update_one(
        doc! { "_id": project.id },
        doc! { "$set": {
            "facebookCommentAutoReply": {
                "enabled": body.enabled,
                "replyMode": &body.reply_mode,
                "staticReplyText": body.static_reply_text.unwrap_or_default(),
                "aiReplyPrompt": body.ai_reply_prompt.unwrap_or_default(),
                // Mirror the TS comment: moderation moved to the main automation settings.
                "moderationEnabled": false,
                "moderationPrompt": "",
            }
        } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}

// ---------------------------------------------------------------------------
// AUDIENCE SEGMENTS — get / save / delete
// ---------------------------------------------------------------------------

/// `GET /projects/{project_id}/audience-segments` — `getAudienceSegments`.
pub async fn get_audience_segments(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
) -> Result<Json<SegmentsResp>> {
    let segments = list_for_project(&user, &state.mongo, &project_id, AUDIENCE_COLL).await?;
    Ok(Json(SegmentsResp { segments }))
}

/// `POST /projects/{project_id}/audience-segments` —
/// `saveAudienceSegment`.
pub async fn save_audience_segment(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(project_id): Path<String>,
    Json(body): Json<SaveAudienceSegmentBody>,
) -> Result<Json<MessageResp>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Segment name is required.".to_owned()));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;

    let mut filters = Document::new();
    if let Some(c) = body.filter_city.filter(|s| !s.is_empty()) {
        filters.insert("city", c);
    }
    if let Some(c) = body.filter_country.filter(|s| !s.is_empty()) {
        filters.insert("country", c);
    }
    if let Some(g) = body.filter_gender.filter(|s| !s.is_empty() && s != "all") {
        filters.insert("gender", g);
    }
    if let Some(min) = body.filter_age_min {
        filters.insert("ageMin", min);
    }
    if let Some(max) = body.filter_age_max {
        filters.insert("ageMax", max);
    }

    let coll = state.mongo.collection::<Document>(AUDIENCE_COLL);
    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "description": body.description.unwrap_or_default(),
        "filters": filters,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(MessageResp {
        message: format!("Segment \"{}\" created.", body.name),
    }))
}

/// `DELETE /audience-segments/{segment_id}` — `deleteAudienceSegment`.
pub async fn delete_audience_segment(
    user: AuthUser,
    State(state): State<WachatFacebookAgentsState>,
    Path(segment_id): Path<String>,
) -> Result<Json<OkResp>> {
    let (oid, _) = resolve_child_and_check(
        &user,
        &state.mongo,
        AUDIENCE_COLL,
        &segment_id,
        "audience segment",
    )
    .await?;
    let coll = state.mongo.collection::<Document>(AUDIENCE_COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(OkResp { success: true }))
}
