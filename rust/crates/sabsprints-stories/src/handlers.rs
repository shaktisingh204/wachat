//! HTTP handlers for the Story entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateStoryInput, CreateStoryResponse, DeleteStoryResponse, ListQuery, ReorderInput,
    ReorderResponse, UpdateStoryInput,
};
use crate::types::SabsprintsStory;

const COLL: &str = "sabsprints_stories";
const ENTITY_KIND: &str = "sabsprints_story";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    project_id: Option<&str>,
    sprint_id: Option<&str>,
    sprint_filter: Option<&str>,
    epic_id: Option<&str>,
    assignee_id: Option<&str>,
    priority: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "todo" | "in_progress" | "review" | "done" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(pid) = project_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    if let Some(sid) = sprint_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("sprintId", sid);
    } else if matches!(sprint_filter.map(str::trim), Some("null") | Some("backlog")) {
        filter.insert("sprintId", doc! { "$exists": false });
    }
    if let Some(eid) = epic_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("epicId", eid);
    }
    if let Some(aid) = assignee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("assigneeId", aid);
    }
    if let Some(p) = priority.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("priority", p);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn story_from_create(input: CreateStoryInput, user_id: ObjectId) -> Result<SabsprintsStory> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    let project_id = ObjectId::parse_str(input.project_id.trim())
        .map_err(|_| ApiError::Validation("projectId must be a valid ObjectId".to_owned()))?;
    let status = input.status.unwrap_or_else(|| "todo".to_owned());
    let completed_at = if status == "done" {
        Some(BsonDateTime::from_chrono(Utc::now()))
    } else {
        None
    };
    Ok(SabsprintsStory {
        id: None,
        user_id,
        project_id,
        sprint_id: input
            .sprint_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        epic_id: input
            .epic_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        title: input.title.trim().to_owned(),
        description: input.description,
        points: input.points,
        status,
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        assignee_id: input
            .assignee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        acceptance_criteria: input.acceptance_criteria.unwrap_or_default(),
        rank: input.rank,
        completed_at,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateStoryInput, before_status: &str) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let mut unset = Document::new();
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(s) = patch.sprint_id {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            unset.insert("sprintId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("sprintId", oid);
        }
    }
    if let Some(s) = patch.epic_id {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            unset.insert("epicId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("epicId", oid);
        }
    }
    if let Some(v) = patch.points {
        set.insert("points", v);
    }
    if let Some(ref v) = patch.status {
        set.insert("status", v.clone());
        if v == "done" && before_status != "done" {
            set.insert("completedAt", BsonDateTime::from_chrono(Utc::now()));
        }
        if v != "done" && before_status == "done" {
            unset.insert("completedAt", "");
        }
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(s) = patch.assignee_id {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            unset.insert("assigneeId", "");
        } else if let Ok(oid) = ObjectId::parse_str(trimmed) {
            set.insert("assigneeId", oid);
        }
    }
    if let Some(v) = patch.acceptance_criteria {
        set.insert("acceptanceCriteria", v);
    }
    if let Some(v) = patch.rank {
        set.insert("rank", v);
    }
    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }
    update
}

fn doc_for_audit(entity: &SabsprintsStory) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsprintsStory>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_stories(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.project_id.as_deref(),
        q.sprint_id.as_deref(),
        q.sprint_filter.as_deref(),
        q.epic_id.as_deref(),
        q.assignee_id.as_deref(),
        q.priority.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "rank": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.find"))
    })?;
    let mut rows: Vec<SabsprintsStory> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %story_id))]
pub async fn get_story(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(story_id): Path<String>,
) -> Result<Json<SabsprintsStory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&story_id)?;
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.find_one")))?
        .ok_or_else(|| ApiError::NotFound("story".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_story(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStoryInput>,
) -> Result<Json<CreateStoryResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = story_from_create(input, user_id)?;
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateStoryResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %story_id))]
pub async fn update_story(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(story_id): Path<String>,
    Json(patch): Json<UpdateStoryInput>,
) -> Result<Json<SabsprintsStory>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&story_id)?;
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.find_one")))?
        .ok_or_else(|| ApiError::NotFound("story".to_owned()))?;
    let update = build_update_doc(patch, &before.status);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("story".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.refetch")))?
        .ok_or_else(|| ApiError::NotFound("story".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %story_id))]
pub async fn delete_story(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(story_id): Path<String>,
) -> Result<Json<DeleteStoryResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&story_id)?;
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("story".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteStoryResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn reorder_stories(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<ReorderInput>,
) -> Result<Json<ReorderResponse>> {
    let user_id = user_oid(&user)?;
    let coll = mongo.collection::<SabsprintsStory>(COLL);
    let mut updated: u64 = 0;
    for entry in input.items {
        if let Ok(oid) = ObjectId::parse_str(entry.id.trim()) {
            let res = coll
                .update_one(
                    ownership_filter(user_id, oid),
                    doc! { "$set": {
                        "rank": Bson::Double(entry.rank),
                        "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                    }},
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("sabsprints_stories.reorder"))
                })?;
            updated += res.modified_count;
        }
    }
    Ok(Json(ReorderResponse { updated }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None, None, None);
        let s = f.get("status").unwrap();
        assert!(s.as_document().is_some());
    }

    #[test]
    fn list_filter_backlog_only_when_sprint_filter_is_null() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, Some("null"), None, None, None);
        let s = f.get("sprintId").unwrap();
        assert!(s.as_document().is_some());
    }

    #[test]
    fn story_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateStoryInput {
            project_id: ObjectId::new().to_hex(),
            title: "   ".into(),
            ..Default::default()
        };
        assert!(story_from_create(input, user_id).is_err());
    }

    #[test]
    fn build_update_doc_unsets_sprint_when_empty_string() {
        let patch = UpdateStoryInput {
            sprint_id: Some(String::new()),
            ..Default::default()
        };
        let d = build_update_doc(patch, "todo");
        assert!(d.get_document("$unset").unwrap().contains_key("sprintId"));
    }

    #[test]
    fn build_update_doc_stamps_completed_at_on_done() {
        let patch = UpdateStoryInput {
            status: Some("done".into()),
            ..Default::default()
        };
        let d = build_update_doc(patch, "in_progress");
        assert!(d.get_document("$set").unwrap().contains_key("completedAt"));
    }
}
