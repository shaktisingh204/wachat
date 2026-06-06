//! Message tags.
//!
//! Mirrors `getMessageTags`, `saveMessageTag`, `deleteMessageTag`.
//!
//! Additive surface (Wave D):
//! - `PATCH /message-tags/{tag_id}` — rename / recolor a tag.
//! - `POST /projects/{project_id}/message-tags/bulk-apply` — stamp a tag
//!   onto every `conversations` row matching simple criteria.
//! - `GET /projects/{project_id}/message-tags/{tag_id}/analytics` — daily
//!   usage counts of the tag, read from the `messages` log.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::instrument;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

const COLL: &str = "wa_message_tags";
/// Conversation inbox rows the bulk-apply handler stamps tags onto.
const CONVERSATIONS_COLL: &str = "conversations";
/// Message log the tag-analytics handler aggregates over.
const MESSAGES_COLL: &str = "messages";

#[derive(Debug, Serialize)]
pub struct TagsResp {
    pub tags: Value,
}

#[derive(Debug, Deserialize)]
pub struct SaveBody {
    pub name: String,
    pub color: String,
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
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<TagsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder().sort(doc! { "name": 1 }).build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(TagsResp {
        tags: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "color": &body.color,
        "usageCount": 0i32,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: format!("Tag \"{}\" created.", body.name),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(tag_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&tag_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}

// ---------------------------------------------------------------------------
// Additive: update / bulk-apply / analytics
// ---------------------------------------------------------------------------

/// Body for `PATCH /message-tags/{tag_id}`. Both fields optional so the
/// caller may change only the name, only the color, or both.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

/// Rename / recolor a single tag in `wa_message_tags`.
#[instrument(skip_all)]
pub async fn update(
    _user: AuthUser,
    Path(tag_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&tag_id)?;

    let mut set = Document::new();
    if let Some(name) = body.name.as_deref() {
        let name = name.trim();
        if name.is_empty() {
            return Err(ApiError::BadRequest(
                "Tag name cannot be empty.".to_owned(),
            ));
        }
        set.insert("name", name);
    }
    if let Some(color) = body.color.as_deref() {
        let color = color.trim();
        if color.is_empty() {
            return Err(ApiError::BadRequest(
                "Tag color cannot be empty.".to_owned(),
            ));
        }
        set.insert("color", color);
    }
    if set.is_empty() {
        return Err(ApiError::BadRequest(
            "Provide at least one of: name, color.".to_owned(),
        ));
    }
    set.insert("updatedAt", bson::DateTime::from_chrono(Utc::now()));

    let coll = state.mongo.collection::<Document>(COLL);
    let res = coll
        .update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("wa_message_tags.update_one"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("tag {tag_id}")));
    }
    Ok(Json(OkResp { success: true }))
}

/// Body for `POST /projects/{project_id}/message-tags/bulk-apply`. The
/// match criteria are intentionally narrow (assigned-agent and/or
/// unread-only) so the stamp targets a well-scoped slice of the inbox.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkApplyBody {
    /// Tag to stamp. Stored as the hex string id (mirrors `labelIds` on
    /// `contacts`, which the existing label-assign handler `$addToSet`s).
    pub tag_id: String,
    /// Optional: only conversations currently assigned to this agent
    /// (hex ObjectId string).
    #[serde(default)]
    pub assigned_agent: Option<String>,
    /// Optional: only conversations with at least one unread message.
    #[serde(default)]
    pub unread_only: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkApplyResp {
    pub success: bool,
    /// Conversations that gained the tag.
    pub modified_count: i64,
    /// Conversations that matched the criteria.
    pub matched_count: i64,
}

/// Stamp a tag onto every `conversations` row in the project matching the
/// supplied criteria. Idempotent via `$addToSet` on a `tagIds` array.
#[instrument(skip_all)]
pub async fn bulk_apply(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<BulkApplyBody>,
) -> Result<Json<BulkApplyResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;

    let tag_id = body.tag_id.trim();
    if tag_id.is_empty() {
        return Err(ApiError::BadRequest("tagId is required.".to_owned()));
    }
    // Validate the tag exists in this project before stamping.
    let tag_oid = opt_oid(tag_id)?;
    let tags = state.mongo.collection::<Document>(COLL);
    let exists = tags
        .find_one(doc! { "_id": tag_oid, "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wa_message_tags.find_one")))?;
    if exists.is_none() {
        return Err(ApiError::NotFound(format!("tag {tag_id}")));
    }

    let mut filter = doc! { "projectId": project.id };
    if let Some(agent) = body.assigned_agent.as_deref() {
        filter.insert("assignedAgent", opt_oid(agent)?);
    }
    if body.unread_only.unwrap_or(false) {
        filter.insert("unreadCount", doc! { "$gt": 0i32 });
    }

    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let res = conversations
        .update_many(filter, doc! { "$addToSet": { "tagIds": tag_id } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("conversations.update_many"))
        })?;

    Ok(Json(BulkApplyResp {
        success: true,
        modified_count: res.modified_count as i64,
        matched_count: res.matched_count as i64,
    }))
}

#[derive(Debug, Deserialize)]
pub struct DaysQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagAnalyticsResp {
    /// `[{ "_id": "YYYY-MM-DD", "count": N }, ...]` ascending by date.
    pub daily_usage: Value,
    /// Total tagged messages over the window.
    pub total: i64,
}

/// Daily usage counts of a tag, aggregated from the `messages` log. Counts
/// messages whose `tagIds` array contains the tag, grouped by calendar day
/// over the last `?days` (default 30).
#[instrument(skip_all)]
pub async fn analytics(
    user: AuthUser,
    Path((project_id, tag_id)): Path<(String, String)>,
    Query(qs): Query<DaysQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<TagAnalyticsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    // Tags are stamped by hex-string id (see bulk_apply), so match the raw
    // string — but validate it is a well-formed ObjectId first.
    opt_oid(&tag_id)?;

    let days = qs.days.unwrap_or(30).clamp(1, 365);
    let since = Utc::now() - Duration::days(days);
    let since_b = bson::DateTime::from_chrono(since);

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "tagIds": &tag_id,
            "timestamp": { "$gte": since_b },
        } },
        doc! { "$group": {
            "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$timestamp" } },
            "count": { "$sum": 1 },
        } },
        doc! { "$sort": { "_id": 1 } },
    ];
    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.aggregate")))?;
    let rows: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("messages.aggregate")))?;

    let total: i64 = rows
        .iter()
        .map(|d| d.get_i32("count").map(i64::from).unwrap_or_else(|_| d.get_i64("count").unwrap_or(0)))
        .sum();

    Ok(Json(TagAnalyticsResp {
        daily_usage: docs_to_json(rows),
        total,
    }))
}
