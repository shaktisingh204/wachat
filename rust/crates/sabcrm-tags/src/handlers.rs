//! HTTP handlers for the SabCRM tags domain.
//!
//! CRUD over the `sabcrm_tags` Mongo collection plus a join table,
//! `sabcrm_tag_assignments`, that links tags to records (Twenty parity:
//! tags are applied to / removed from records, and each tag reports a
//! usage count).
//!
//! | Endpoint                                      | Action                       |
//! |-----------------------------------------------|------------------------------|
//! | `GET    /v1/sabcrm/tags`                      | list (with usage counts)     |
//! | `POST   /v1/sabcrm/tags`                      | create                       |
//! | `GET    /v1/sabcrm/tags/counts`              | per-tag usage counts         |
//! | `GET    /v1/sabcrm/tags/for-record`          | tags applied to one record   |
//! | `GET    /v1/sabcrm/tags/{id}`                | get one (with usage count)   |
//! | `PATCH  /v1/sabcrm/tags/{id}`                | update                       |
//! | `DELETE /v1/sabcrm/tags/{id}`                | delete (+ cascade assigns)   |
//! | `POST   /v1/sabcrm/tags/{id}/apply`         | apply tag to a record        |
//! | `DELETE /v1/sabcrm/tags/{id}/apply`         | remove tag from a record     |
//! | `GET    /v1/sabcrm/tags/{id}/records`       | records a tag is applied to  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint. A per-project unique tag `name` is enforced in application
//! code: `create` (and a `name`-changing `update`) reject a duplicate with
//! `409 Conflict`. Tag→record assignments are unique on
//! `(projectId, tagId, object, recordId)` and applied idempotently.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{
    bson_helpers::{oid_from_str, oid_to_str},
    document_to_clean_json,
    mongo::MongoHandle,
};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ApplyTagInput, AssignmentResponse, CountsResponse, CreateTagInput, ListQuery, ListResponse,
    OkResponse, RemoveTagQuery, ScopeQuery, TagCount, TagResponse, TaggedRecordsQuery,
    TaggedRecordsResponse, TagsForRecordQuery, TagsForRecordResponse, UpdateTagInput,
};

/// The Mongo collection backing tag definitions.
const TAGS_COLL: &str = "sabcrm_tags";
/// The Mongo collection backing tag→record assignments (the join table).
const ASSIGN_COLL: &str = "sabcrm_tag_assignments";

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

/// Trim a required free-text field, mapping empty → `422 Validation`.
fn require_field<'a>(value: &'a str, field: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{field} is required.")));
    }
    Ok(v)
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

/// Attach a `usageCount` field to an already-cleaned tag JSON object.
fn with_usage_count(mut tag: Value, count: u64) -> Value {
    if let Value::Object(map) = &mut tag {
        map.insert("usageCount".to_owned(), Value::from(count));
    }
    tag
}

/// Return `true` when a tag with `name` already exists in `project_id`,
/// optionally excluding the document with id `exclude`.
async fn name_taken(
    coll: &mongodb::Collection<Document>,
    project_id: &str,
    name: &str,
    exclude: Option<&ObjectId>,
) -> Result<bool> {
    let mut filter = doc! { "projectId": project_id, "name": name };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    let existing = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one")))?;
    Ok(existing.is_some())
}

/// Count the records a single tag is applied to within a project.
async fn usage_count(
    assign: &mongodb::Collection<Document>,
    project_id: &str,
    tag_id: &ObjectId,
) -> Result<u64> {
    assign
        .count_documents(doc! { "projectId": project_id, "tagId": oid_to_str(tag_id) })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.count"))
        })
}

/// Confirm a tag exists in the project, returning its id; `404` otherwise.
async fn require_tag(
    tags: &mongodb::Collection<Document>,
    project_id: &str,
    tag_oid: &ObjectId,
) -> Result<()> {
    let found = tags
        .find_one(doc! { "projectId": project_id, "_id": tag_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one(require)"))
        })?;
    if found.is_none() {
        return Err(ApiError::NotFound("tag".to_owned()));
    }
    Ok(())
}

// ===========================================================================
// GET / — list
// ===========================================================================

/// `GET /v1/sabcrm/tags` — list the tags for a project, newest first
/// (`createdAt` desc). Each tag carries a derived `usageCount` computed
/// from `sabcrm_tag_assignments`.
#[instrument(skip_all)]
pub async fn list_tags(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find")))?;

    // Build a single counts map up front so the list is one aggregation,
    // not N count queries.
    let counts = counts_map(&mongo, project_id).await?;

    let mut tags = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.cursor")))?
    {
        let id_hex = d.get_object_id("_id").map(|o| oid_to_str(&o)).ok();
        let count = id_hex.and_then(|h| counts.get(&h).copied()).unwrap_or(0);
        tags.push(with_usage_count(record_to_wire(d), count));
    }

    Ok(Json(ListResponse { tags }))
}

// ===========================================================================
// POST / — create
// ===========================================================================

/// `POST /v1/sabcrm/tags` — create a tag. Rejects a duplicate `name`
/// within the project with `409 Conflict`. `createdAt` is set server-side
/// (RFC3339). A freshly created tag reports `usageCount: 0`.
#[instrument(skip_all)]
pub async fn create_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateTagInput>,
) -> Result<Json<TagResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = require_field(&body.name, "name")?;
    let color = body.color.as_deref().unwrap_or("").trim().to_owned();

    let coll = mongo.collection::<Document>(TAGS_COLL);

    if name_taken(&coll, project_id, name, None).await? {
        return Err(ApiError::Conflict(
            "A tag with that name already exists.".to_owned(),
        ));
    }

    let new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "name": name,
        "color": color,
        "createdAt": Utc::now().to_rfc3339(),
    };

    coll.insert_one(&new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.insert_one")))?;

    Ok(Json(TagResponse {
        tag: with_usage_count(record_to_wire(new_doc), 0),
    }))
}

// ===========================================================================
// GET /{id} — get one
// ===========================================================================

/// `GET /v1/sabcrm/tags/{id}` — fetch one tag (with `usageCount`), scoped
/// by `{ projectId, _id }`. `404` if none matched.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<TagResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one(get)"))
        })?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;

    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    let count = usage_count(&assign, project_id, &oid).await?;

    Ok(Json(TagResponse {
        tag: with_usage_count(record_to_wire(found), count),
    }))
}

// ===========================================================================
// PATCH /{id} — update
// ===========================================================================

/// `PATCH /v1/sabcrm/tags/{id}` — partial update of `name` / `color`,
/// scoped by `{ projectId, _id }`. A `name` change that collides with
/// another tag in the project fails with `409 Conflict`. Returns the
/// updated tag (with `usageCount`), or `404` if none matched.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTagInput>,
) -> Result<Json<TagResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let assign = mongo.collection::<Document>(ASSIGN_COLL);

    let mut set = Document::new();
    if let Some(name) = body.name.as_deref() {
        let name = name.trim();
        if name.is_empty() {
            return Err(ApiError::Validation("name cannot be empty.".to_owned()));
        }
        if name_taken(&coll, project_id, name, Some(&oid)).await? {
            return Err(ApiError::Conflict(
                "A tag with that name already exists.".to_owned(),
            ));
        }
        set.insert("name", name);
    }
    if let Some(color) = body.color.as_deref() {
        set.insert("color", color.trim());
    }

    if set.is_empty() {
        // Nothing to change — just return the current document (or 404).
        let current = coll
            .find_one(doc! { "projectId": project_id, "_id": oid })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one(current)"))
            })?
            .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;
        let count = usage_count(&assign, project_id, &oid).await?;
        return Ok(Json(TagResponse {
            tag: with_usage_count(record_to_wire(current), count),
        }));
    }

    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;

    let count = usage_count(&assign, project_id, &oid).await?;

    Ok(Json(TagResponse {
        tag: with_usage_count(record_to_wire(updated), count),
    }))
}

// ===========================================================================
// DELETE /{id} — delete
// ===========================================================================

/// `DELETE /v1/sabcrm/tags/{id}` — scoped delete. Cascades by removing all
/// of the tag's assignments in `sabcrm_tag_assignments`. Returns `404` if
/// no tag matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TAGS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.delete_one")))?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("tag".to_owned()));
    }

    // Cascade: drop every assignment pointing at this tag.
    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    assign
        .delete_many(doc! { "projectId": project_id, "tagId": oid_to_str(&oid) })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_tag_assignments.delete_many(cascade)"),
            )
        })?;

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{id}/apply — apply tag to a record
// ===========================================================================

/// `POST /v1/sabcrm/tags/{id}/apply` — apply a tag to one record.
/// Idempotent on `(projectId, tagId, object, recordId)`; `createdAt` is
/// set once (`$setOnInsert`). `404` if the tag does not exist.
#[instrument(skip_all, fields(id = %id))]
pub async fn apply_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<ApplyTagInput>,
) -> Result<Json<AssignmentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    let object = require_field(&body.object, "object")?;
    let record_id = require_field(&body.record_id, "recordId")?;

    let tags = mongo.collection::<Document>(TAGS_COLL);
    require_tag(&tags, project_id, &oid).await?;

    let tag_id = oid_to_str(&oid);
    let key = doc! {
        "projectId": project_id,
        "tagId": &tag_id,
        "object": object,
        "recordId": record_id,
    };

    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    let upserted = assign
        .find_one_and_update(
            key,
            doc! {
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "createdAt": Utc::now().to_rfc3339(),
                },
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_tag_assignments.find_one_and_update(upsert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!(
                "sabcrm_tag_assignments.upsert returned no document"
            ))
        })?;

    Ok(Json(AssignmentResponse {
        assignment: record_to_wire(upserted),
    }))
}

// ===========================================================================
// DELETE /{id}/apply — remove tag from a record
// ===========================================================================

/// `DELETE /v1/sabcrm/tags/{id}/apply` — remove a tag from one record.
/// Idempotent: returns `{ ok: true }` whether or not an assignment matched.
#[instrument(skip_all, fields(id = %id))]
pub async fn remove_tag(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<RemoveTagQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;
    let object = require_field(&query.object, "object")?;
    let record_id = require_field(&query.record_id, "recordId")?;

    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    assign
        .delete_one(doc! {
            "projectId": project_id,
            "tagId": oid_to_str(&oid),
            "object": object,
            "recordId": record_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.delete_one"))
        })?;

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// GET /{id}/records — records a tag is applied to
// ===========================================================================

/// `GET /v1/sabcrm/tags/{id}/records` — list the assignments for a tag
/// (newest first), optionally filtered to one `object` slug. `404` if the
/// tag does not exist.
#[instrument(skip_all, fields(id = %id))]
pub async fn tagged_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<TaggedRecordsQuery>,
) -> Result<Json<TaggedRecordsResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let tags = mongo.collection::<Document>(TAGS_COLL);
    require_tag(&tags, project_id, &oid).await?;

    let mut filter = doc! { "projectId": project_id, "tagId": oid_to_str(&oid) };
    if let Some(object) = query.object.as_deref() {
        let object = object.trim();
        if !object.is_empty() {
            filter.insert("object", object);
        }
    }

    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    let mut cursor = assign
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.find"))
        })?;

    let mut records = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.cursor"))
    })? {
        records.push(record_to_wire(d));
    }

    Ok(Json(TaggedRecordsResponse { records }))
}

// ===========================================================================
// GET /for-record — tags applied to one record
// ===========================================================================

/// `GET /v1/sabcrm/tags/for-record` — list the tag definitions applied to
/// one record `(object, recordId)`, newest assignment first. Each returned
/// tag carries the matching `usageCount`.
#[instrument(skip_all)]
pub async fn tags_for_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<TagsForRecordQuery>,
) -> Result<Json<TagsForRecordResponse>> {
    let project_id = require_project(&query.project_id)?;
    let object = require_field(&query.object, "object")?;
    let record_id = require_field(&query.record_id, "recordId")?;

    // Collect this record's tag ids (newest assignment first).
    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    let mut cursor = assign
        .find(doc! { "projectId": project_id, "object": object, "recordId": record_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_tag_assignments.find(for-record)"),
            )
        })?;

    let mut tag_ids: Vec<String> = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabcrm_tag_assignments.cursor(for-record)"),
        )
    })? {
        if let Ok(tid) = d.get_str("tagId") {
            tag_ids.push(tid.to_owned());
        }
    }

    if tag_ids.is_empty() {
        return Ok(Json(TagsForRecordResponse { tags: Vec::new() }));
    }

    // Hydrate the tag definitions, preserving assignment order.
    let oids: Vec<ObjectId> = tag_ids.iter().filter_map(|h| oid_from_str(h).ok()).collect();
    let tags = mongo.collection::<Document>(TAGS_COLL);
    let mut tag_cursor = tags
        .find(doc! { "projectId": project_id, "_id": { "$in": oids } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.find(for-record)"))
        })?;

    let counts = counts_map(&mongo, project_id).await?;

    let mut by_id: HashMap<String, Value> = HashMap::new();
    while let Some(d) = tag_cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tags.cursor(for-record)"))
    })? {
        if let Ok(o) = d.get_object_id("_id") {
            let hex = oid_to_str(&o);
            let count = counts.get(&hex).copied().unwrap_or(0);
            by_id.insert(hex, with_usage_count(record_to_wire(d), count));
        }
    }

    let ordered: Vec<Value> = tag_ids.iter().filter_map(|h| by_id.remove(h)).collect();
    Ok(Json(TagsForRecordResponse { tags: ordered }))
}

// ===========================================================================
// GET /counts — per-tag usage counts
// ===========================================================================

/// Aggregate `sabcrm_tag_assignments` into a `tagId → count` map for a
/// project. Shared by the list / get / counts surfaces.
async fn counts_map(mongo: &MongoHandle, project_id: &str) -> Result<HashMap<String, u64>> {
    let assign = mongo.collection::<Document>(ASSIGN_COLL);
    let pipeline = vec![
        doc! { "$match": { "projectId": project_id } },
        doc! { "$group": { "_id": "$tagId", "count": { "$sum": 1 } } },
    ];

    let mut cursor = assign.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.aggregate"))
    })?;

    let mut map: HashMap<String, u64> = HashMap::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_tag_assignments.aggregate.cursor"))
    })? {
        let tag_id = match d.get("_id") {
            Some(Bson::String(s)) => s.clone(),
            _ => continue,
        };
        let count = match d.get("count") {
            Some(Bson::Int32(n)) => (*n).max(0) as u64,
            Some(Bson::Int64(n)) => (*n).max(0) as u64,
            Some(Bson::Double(n)) => n.max(0.0) as u64,
            _ => 0,
        };
        map.insert(tag_id, count);
    }
    Ok(map)
}

/// `GET /v1/sabcrm/tags/counts` — per-tag usage counts for a project,
/// derived from `sabcrm_tag_assignments`. Tags with no assignments are
/// omitted; pair with `GET /` for the full set (which fills zeros).
#[instrument(skip_all)]
pub async fn tag_counts(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<CountsResponse>> {
    let project_id = require_project(&query.project_id)?;
    let map = counts_map(&mongo, project_id).await?;
    let counts = map
        .into_iter()
        .map(|(tag_id, usage_count)| TagCount { tag_id, usage_count })
        .collect();
    Ok(Json(CountsResponse { counts }))
}
