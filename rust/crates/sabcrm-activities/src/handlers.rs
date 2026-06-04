//! HTTP handlers for the SabCRM activities-timeline domain.
//!
//! CRUD over the `sabcrm_activities` Mongo collection.
//!
//! | Endpoint                              | TS source (`activities.server.ts`) |
//! |---------------------------------------|------------------------------------|
//! | `GET    /v1/sabcrm/activities`        | `listActivities`                   |
//! | `POST   /v1/sabcrm/activities`        | `createActivity`                   |
//! | `PATCH  /v1/sabcrm/activities/{id}`   | `updateActivity`                   |
//! | `DELETE /v1/sabcrm/activities/{id}`   | `deleteActivity`                   |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` / target filters as appropriate) — **not** `userId`. Every
//! handler requires the [`AuthUser`](sabnode_auth::AuthUser) extractor so
//! the surface is never anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ActivityResponse, AddCommentInput, Comment, CommentListResponse, CommentResponse,
    CreateActivityInput, EditCommentInput, ListQuery, ListResponse, OkResponse, ReactionGroup,
    ReactionsResponse, ScopeQuery, ToggleReactionInput, UpdateActivityInput,
};

/// The Mongo collection backing the activities timeline.
const ACTIVITIES_COLL: &str = "sabcrm_activities";

/// Default page size for the list endpoint when no `limit` is supplied.
const DEFAULT_LIMIT: u64 = 50;
/// Hard cap on `limit`.
const MAX_LIMIT: u64 = 200;

/// The activity kinds SabCRM recognises, mirroring Twenty's timeline entry
/// types. Stored uppercase verbatim.
const ALLOWED_KINDS: &[&str] = &["NOTE", "TASK", "CALL", "MEETING", "EMAIL", "COMMENT"];

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

/// Normalise and validate an activity `type`, returning the canonical
/// uppercase form. Unknown kinds are rejected so the timeline stays typed.
fn normalize_kind(raw: &str) -> Result<String> {
    let upper = raw.trim().to_uppercase();
    if ALLOWED_KINDS.contains(&upper.as_str()) {
        Ok(upper)
    } else {
        Err(ApiError::Validation(format!(
            "type must be one of {}.",
            ALLOWED_KINDS.join(" | ")
        )))
    }
}

/// Render a coarse, human-friendly relative time ("just now", "5m ago",
/// "3h ago", "2d ago", "4w ago", "5mo ago", "2y ago") from an RFC3339
/// timestamp. Falls back to the raw string when it cannot be parsed.
fn relative_time(rfc3339: &str) -> String {
    let Ok(then) = chrono::DateTime::parse_from_rfc3339(rfc3339) else {
        return rfc3339.to_owned();
    };
    let secs = (Utc::now() - then.with_timezone(&Utc)).num_seconds();
    if secs < 0 {
        return "just now".to_owned();
    }
    let s = secs as u64;
    if s < 45 {
        "just now".to_owned()
    } else if s < 3_600 {
        format!("{}m ago", (s / 60).max(1))
    } else if s < 86_400 {
        format!("{}h ago", s / 3_600)
    } else if s < 604_800 {
        format!("{}d ago", s / 86_400)
    } else if s < 2_592_000 {
        format!("{}w ago", s / 604_800)
    } else if s < 31_536_000 {
        format!("{}mo ago", s / 2_592_000)
    } else {
        format!("{}y ago", s / 31_536_000)
    }
}

/// Coerce a stored `reactions` array (raw BSON) into the wire [`ReactionGroup`]
/// shape. Skips malformed elements. Used for both activity- and comment-level
/// reactions.
fn reactions_from_bson(arr: Option<&Vec<Bson>>) -> Vec<ReactionGroup> {
    let Some(arr) = arr else {
        return Vec::new();
    };
    arr.iter()
        .filter_map(Bson::as_document)
        .filter_map(|r| {
            let emoji = r.get_str("emoji").ok()?.to_owned();
            let member_ids: Vec<String> = r
                .get_array("memberIds")
                .map(|a| {
                    a.iter()
                        .filter_map(|b| b.as_str().map(str::to_owned))
                        .collect()
                })
                .unwrap_or_default();
            let count = member_ids.len();
            Some(ReactionGroup {
                emoji,
                member_ids,
                count,
            })
        })
        .collect()
}

/// Toggle `member_id`'s reaction with `emoji` within an in-memory reaction set,
/// returning the new BSON array to persist plus the wire groups. Empty groups
/// are dropped so the stored array never accumulates orphans.
fn toggle_reaction(
    existing: Vec<ReactionGroup>,
    emoji: &str,
    member_id: &str,
) -> (Vec<Bson>, Vec<ReactionGroup>) {
    let mut groups = existing;
    if let Some(g) = groups.iter_mut().find(|g| g.emoji == emoji) {
        if let Some(pos) = g.member_ids.iter().position(|m| m == member_id) {
            g.member_ids.remove(pos);
        } else {
            g.member_ids.push(member_id.to_owned());
        }
    } else {
        groups.push(ReactionGroup {
            emoji: emoji.to_owned(),
            member_ids: vec![member_id.to_owned()],
            count: 1,
        });
    }
    groups.retain(|g| !g.member_ids.is_empty());
    for g in &mut groups {
        g.count = g.member_ids.len();
    }
    let bson = groups
        .iter()
        .map(|g| {
            Bson::Document(doc! {
                "emoji": &g.emoji,
                "memberIds": g.member_ids.iter().map(|m| Bson::String(m.clone())).collect::<Vec<_>>(),
            })
        })
        .collect();
    (bson, groups)
}

// ===========================================================================
// GET / — listActivities
// ===========================================================================

/// `GET /v1/sabcrm/activities` — timeline list scoped by `{ projectId }`,
/// newest first (`createdAt` desc). `targetObject` + `targetRecordId`
/// narrow to one record; `type` is an optional filter.
#[instrument(skip_all)]
pub async fn list_activities(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let limit = query
        .limit
        .filter(|l| *l > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);

    let mut filter = doc! { "projectId": project_id };
    if let Some(t) = query
        .target_object
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("targetObject", t);
    }
    if let Some(r) = query
        .target_record_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("targetRecordId", r);
    }
    if let Some(k) = query.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", k.to_uppercase());
    }

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.find")))?;

    let mut activities = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.cursor"))
    })? {
        activities.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { activities }))
}

// ===========================================================================
// POST / — createActivity
// ===========================================================================

/// `POST /v1/sabcrm/activities` — create a timeline entry. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateActivityInput>,
) -> Result<Json<ActivityResponse>> {
    let project_id = require_project(&body.project_id)?;

    if body.kind.trim().is_empty() {
        return Err(ApiError::Validation("type is required.".to_owned()));
    }
    let kind = normalize_kind(&body.kind)?;
    if body.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "projectId": project_id,
        "type": &kind,
        "title": body.title.trim(),
        "body": body.body.as_deref().unwrap_or("").to_owned(),
        "targetObject": body.target_object.trim(),
        "targetRecordId": body.target_record_id.trim(),
        "authorId": body.author_id.trim(),
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(s) = body.status.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("status", s);
    }
    if let Some(a) = body.assignee_id.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("assigneeId", a);
    }
    if let Some(d) = body.due_at.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("dueAt", d);
    }
    if let Some(attachments) = body.attachments.as_ref().filter(|a| !a.is_empty()) {
        let bson = bson::to_bson(attachments).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_activities.attachments.to_bson"),
            )
        })?;
        new_doc.insert("attachments", bson);
    }

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.insert_one"))
    })?;

    Ok(Json(ActivityResponse {
        activity: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateActivity
// ===========================================================================

/// `PATCH /v1/sabcrm/activities/{id}` — partial update (e.g. task status).
/// Each key in the flattened body (minus `projectId`) is `$set` verbatim;
/// `updatedAt` is always bumped. Returns the updated activity.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateActivityInput>,
) -> Result<Json<ActivityResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let patch = match bson::to_bson(&body.patch).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.patch.to_bson"))
    })? {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };

    let mut set = Document::new();
    for (k, v) in patch {
        // Guard against rewriting tenancy / identity keys.
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        set.insert(k, v);
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_activities.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("activity".to_owned()))?;

    Ok(Json(ActivityResponse {
        activity: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteActivity
// ===========================================================================

/// `DELETE /v1/sabcrm/activities/{id}` — scoped delete. Returns `404` if
/// no activity matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_activity(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// comments — stored as a `comments` array subdoc on the activity
// ===========================================================================

/// Coerce a stored `comments` array (raw BSON) into the wire `Comment`
/// shape. Skips any malformed element rather than failing the whole read.
fn comments_from_doc(doc: &Document) -> Vec<Comment> {
    let Ok(arr) = doc.get_array("comments") else {
        return Vec::new();
    };
    arr.iter()
        .filter_map(|b| b.as_document())
        .filter_map(comment_from_subdoc)
        .collect()
}

/// Coerce a single stored comment subdocument into the wire [`Comment`],
/// computing the relative time and grouping reactions. Returns `None` for a
/// comment with no `id`.
fn comment_from_subdoc(c: &Document) -> Option<Comment> {
    let created_at = c.get_str("createdAt").unwrap_or("").to_owned();
    let mention_ids = c
        .get_array("mentionIds")
        .map(|a| {
            a.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    let reactions = reactions_from_bson(c.get_array("reactions").ok());
    Some(Comment {
        id: c.get_str("id").ok()?.to_owned(),
        body: c.get_str("body").unwrap_or("").to_owned(),
        author_id: c.get_str("authorId").unwrap_or("").to_owned(),
        mention_ids,
        reactions,
        created_at_relative: relative_time(&created_at),
        edited_at: c.get_str("editedAt").ok().map(str::to_owned),
        created_at,
    })
}

/// Load one activity scoped by `{ projectId, _id }`, or `404`.
async fn find_activity_or_404(
    mongo: &MongoHandle,
    project_id: &str,
    oid: ObjectId,
) -> Result<Document> {
    mongo
        .collection::<Document>(ACTIVITIES_COLL)
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.find_one")))?
        .ok_or_else(|| ApiError::NotFound("activity".to_owned()))
}

/// `GET /v1/sabcrm/activities/{id}/comments` — the activity's comments
/// array (or `[]`). Scoped by `{ projectId, _id }`; `404` if no match.
#[instrument(skip_all, fields(id = %id))]
pub async fn list_comments(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<CommentListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let activity = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("activity".to_owned()))?;

    Ok(Json(CommentListResponse {
        comments: comments_from_doc(&activity),
    }))
}

/// `POST /v1/sabcrm/activities/{id}/comments` — `$push` a comment onto the
/// activity's `comments` array. Assigns a fresh comment id + `createdAt`.
/// Returns the created comment.
#[instrument(skip_all, fields(id = %id))]
pub async fn add_comment(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<AddCommentInput>,
) -> Result<Json<CommentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    if body.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required.".to_owned()));
    }
    if body.author_id.trim().is_empty() {
        return Err(ApiError::Validation("authorId is required.".to_owned()));
    }

    let mention_ids: Vec<String> = body
        .mention_ids
        .unwrap_or_default()
        .into_iter()
        .map(|m| m.trim().to_owned())
        .filter(|m| !m.is_empty())
        .collect();
    let created_at = Utc::now().to_rfc3339();
    let comment = Comment {
        id: ObjectId::new().to_hex(),
        body: body.body.trim().to_owned(),
        author_id: body.author_id.trim().to_owned(),
        mention_ids: mention_ids.clone(),
        reactions: Vec::new(),
        created_at_relative: relative_time(&created_at),
        edited_at: None,
        created_at: created_at.clone(),
    };

    let comment_doc = doc! {
        "id": &comment.id,
        "body": &comment.body,
        "authorId": &comment.author_id,
        "mentionIds": mention_ids.iter().map(|m| Bson::String(m.clone())).collect::<Vec<_>>(),
        "createdAt": &created_at,
    };

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .update_one(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$push": { "comments": comment_doc } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.comments.push"))
        })?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(CommentResponse { comment }))
}

/// Locate a comment subdocument by id within an activity document.
fn find_comment<'a>(activity: &'a Document, comment_id: &str) -> Option<&'a Document> {
    activity
        .get_array("comments")
        .ok()?
        .iter()
        .filter_map(Bson::as_document)
        .find(|c| c.get_str("id").ok() == Some(comment_id))
}

/// Ensure the authenticated user authored `comment` (delete/edit-own gate).
fn assert_comment_owner(comment: &Document, user_id: &str) -> Result<()> {
    if comment.get_str("authorId").ok() == Some(user_id) {
        Ok(())
    } else {
        Err(ApiError::Forbidden(
            "you can only modify your own comments.".to_owned(),
        ))
    }
}

/// `PATCH /v1/sabcrm/activities/{id}/comments/{commentId}` — edit one's own
/// comment in place. Only the original author (matched to the authenticated
/// user) may edit; `editedAt` is bumped. Returns the updated comment.
#[instrument(skip_all, fields(id = %id, comment_id = %comment_id))]
pub async fn edit_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((id, comment_id)): Path<(String, String)>,
    Json(body): Json<EditCommentInput>,
) -> Result<Json<CommentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    if body.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required.".to_owned()));
    }

    let activity = find_activity_or_404(&mongo, project_id, oid).await?;
    let existing =
        find_comment(&activity, &comment_id).ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    assert_comment_owner(existing, &user.user_id)?;

    let edited_at = Utc::now().to_rfc3339();
    let mut set = doc! {
        "comments.$[c].body": body.body.trim(),
        "comments.$[c].editedAt": &edited_at,
    };
    if let Some(mentions) = body.mention_ids {
        let cleaned: Vec<Bson> = mentions
            .into_iter()
            .map(|m| m.trim().to_owned())
            .filter(|m| !m.is_empty())
            .map(Bson::String)
            .collect();
        set.insert("comments.$[c].mentionIds", cleaned);
    }

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .array_filters(vec![doc! { "c.id": comment_id.as_str() }])
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.comments.edit"))
        })?
        .ok_or_else(|| ApiError::NotFound("activity".to_owned()))?;

    let comment = find_comment(&updated, &comment_id)
        .and_then(comment_from_subdoc)
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;

    Ok(Json(CommentResponse { comment }))
}

/// `DELETE /v1/sabcrm/activities/{id}/comments/{commentId}` — `$pull` the
/// comment with the given id from the activity's `comments` array. Only the
/// original author (matched to the authenticated user) may delete.
/// `404` if no matching activity/comment.
#[instrument(skip_all, fields(id = %id, comment_id = %comment_id))]
pub async fn delete_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((id, comment_id)): Path<(String, String)>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let activity = find_activity_or_404(&mongo, project_id, oid).await?;
    let existing =
        find_comment(&activity, &comment_id).ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    assert_comment_owner(existing, &user.user_id)?;

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .update_one(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$pull": { "comments": { "id": comment_id.as_str() } } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.comments.pull"))
        })?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// reactions — emoji reactions on an activity or one of its comments
// ===========================================================================

/// `POST /v1/sabcrm/activities/{id}/reactions` — toggle the authenticated
/// member's `emoji` reaction on the activity itself. Returns the updated
/// reaction groups.
#[instrument(skip_all, fields(id = %id))]
pub async fn toggle_activity_reaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<ToggleReactionInput>,
) -> Result<Json<ReactionsResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    let emoji = body.emoji.trim();
    if emoji.is_empty() {
        return Err(ApiError::Validation("emoji is required.".to_owned()));
    }

    let activity = find_activity_or_404(&mongo, project_id, oid).await?;
    let existing = reactions_from_bson(activity.get_array("reactions").ok());
    let (bson, groups) = toggle_reaction(existing, emoji, &user.user_id);

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .update_one(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": { "reactions": bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_activities.reactions.set"))
        })?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(ReactionsResponse { reactions: groups }))
}

/// `POST /v1/sabcrm/activities/{id}/comments/{commentId}/reactions` — toggle
/// the authenticated member's `emoji` reaction on a comment. Returns the
/// comment's updated reaction groups.
#[instrument(skip_all, fields(id = %id, comment_id = %comment_id))]
pub async fn toggle_comment_reaction(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((id, comment_id)): Path<(String, String)>,
    Json(body): Json<ToggleReactionInput>,
) -> Result<Json<ReactionsResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    let emoji = body.emoji.trim();
    if emoji.is_empty() {
        return Err(ApiError::Validation("emoji is required.".to_owned()));
    }

    let activity = find_activity_or_404(&mongo, project_id, oid).await?;
    let comment =
        find_comment(&activity, &comment_id).ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    let existing = reactions_from_bson(comment.get_array("reactions").ok());
    let (bson, groups) = toggle_reaction(existing, emoji, &user.user_id);

    let coll = mongo.collection::<Document>(ACTIVITIES_COLL);
    let result = coll
        .update_one(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": { "comments.$[c].reactions": bson } },
        )
        .array_filters(vec![doc! { "c.id": comment_id.as_str() }])
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_activities.comments.reactions.set"),
            )
        })?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("activity".to_owned()));
    }

    Ok(Json(ReactionsResponse { reactions: groups }))
}
