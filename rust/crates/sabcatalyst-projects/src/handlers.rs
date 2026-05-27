//! HTTP handlers for `/v1/sabcatalyst/projects/*`.
//!
//! Tenancy: every project is scoped to the authenticated SabNode user
//! (`userId == auth.user_id`). Cross-user reads/writes are impossible —
//! `not-found` is returned for ids that exist but belong to a different
//! owner, so existence is never leaked across owners.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::PROJECTS_COLL;
use crate::dto::{
    CreateProjectBody, ListProjectsQuery, ListProjectsResponse, MAX_LIMIT, UpdateProjectBody,
};
use crate::state::SabcatalystProjectsState;
use crate::types::{ProjectRuntime, ProjectStatus};

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim is not a valid ObjectId".to_owned()))
}

fn slug_is_valid(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

#[instrument(skip_all, fields(user = %user.user_id))]
pub async fn list_projects(
    user: AuthUser,
    State(state): State<SabcatalystProjectsState>,
    Query(q): Query<ListProjectsQuery>,
) -> Result<Json<ListProjectsResponse>> {
    let owner = owner_oid(&user)?;
    let mut filter = doc! { "userId": owner, "status": { "$ne": "deleted" } };
    if let Some(term) = q.q.as_deref().filter(|s| !s.is_empty()) {
        filter.insert(
            "$or",
            vec![
                doc! { "name": { "$regex": term, "$options": "i" } },
                doc! { "slug": { "$regex": term, "$options": "i" } },
            ],
        );
    }
    if let Some(cur) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(cur)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    };
    let items: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListProjectsResponse { items, next_cursor }))
}

#[instrument(skip_all, fields(user = %user.user_id, project_id = %id))]
pub async fn get_project(
    user: AuthUser,
    State(state): State<SabcatalystProjectsState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid, "userId": owner })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Project not found.".to_owned()))?;
    Ok(Json(document_to_clean_json(doc)))
}

#[instrument(skip_all, fields(user = %user.user_id, slug = %body.slug))]
pub async fn create_project(
    user: AuthUser,
    State(state): State<SabcatalystProjectsState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    if !slug_is_valid(&body.slug) {
        return Err(ApiError::BadRequest(
            "slug must be lowercase alnum, '-' or '_', 1..=64 chars".into(),
        ));
    }
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    let dup = coll
        .find_one(doc! { "userId": owner, "slug": &body.slug })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.dup_check")))?;
    if dup.is_some() {
        return Err(ApiError::Conflict("slug already in use".into()));
    }
    let now = Utc::now();
    let oid = ObjectId::new();
    let runtime = body.runtime.unwrap_or(ProjectRuntime::Nodejs20);
    let runtime_bson = to_bson(&runtime).unwrap_or_else(|_| bson::Bson::String("nodejs20".into()));
    let mut doc = doc! {
        "_id": oid,
        "userId": owner,
        "name": body.name.trim(),
        "slug": body.slug,
        "status": "active",
        "runtime": runtime_bson,
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    if let Some(d) = body.description {
        doc.insert("description", d);
    }
    if let Some(r) = body.region {
        doc.insert("region", r);
    }
    coll.insert_one(&doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(doc))))
}

#[instrument(skip_all, fields(user = %user.user_id, project_id = %id))]
pub async fn update_project(
    user: AuthUser,
    State(state): State<SabcatalystProjectsState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateProjectBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = body.name {
        set.insert("name", v);
    }
    if let Some(v) = body.description {
        set.insert("description", v);
    }
    if let Some(v) = body.status {
        let s = match v {
            ProjectStatus::Active => "active",
            ProjectStatus::Paused => "paused",
            ProjectStatus::Deleted => "deleted",
        };
        set.insert("status", s);
    }
    if let Some(v) = body.region {
        set.insert("region", v);
    }
    if let Some(v) = body.runtime {
        let s = match v {
            ProjectRuntime::Nodejs20 => "nodejs20",
            ProjectRuntime::Python311 => "python311",
            ProjectRuntime::Deno => "deno",
            ProjectRuntime::Bun => "bun",
        };
        set.insert("runtime", s);
    }
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    let res = coll
        .find_one_and_update(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.update")))?
        .ok_or_else(|| ApiError::NotFound("Project not found.".to_owned()))?;
    Ok(Json(document_to_clean_json(res)))
}

#[instrument(skip_all, fields(user = %user.user_id, project_id = %id))]
pub async fn delete_project(
    user: AuthUser,
    State(state): State<SabcatalystProjectsState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    // Soft-delete to preserve audit / billing history; the runtime
    // route handler refuses to serve `status: "deleted"`.
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": { "status": "deleted", "updatedAt": bson::DateTime::from_chrono(Utc::now()) } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.delete")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Project not found.".to_owned()));
    }
    Ok(StatusCode::NO_CONTENT)
}
