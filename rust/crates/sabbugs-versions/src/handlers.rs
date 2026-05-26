//! HTTP handlers for the BugVersion entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateVersionInput, CreateVersionResponse, DeleteVersionResponse, ListQuery, UpdateVersionInput,
};
use crate::types::BugVersion;

const COLL: &str = "sabbugs_versions";
const ENTITY_KIND: &str = "bug_version";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "planned" | "released" => {
            filter.insert("status", q.status.as_deref().unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(pid) = q
        .project_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("projectId", pid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn version_from_create(input: CreateVersionInput, user_id: ObjectId) -> Result<BugVersion> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(BugVersion {
        id: None,
        user_id,
        project_id: input
            .project_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        name: input.name.trim().to_owned(),
        notes: input.notes,
        released_at: input.released_at.as_deref().and_then(parse_date),
        status: input.status.unwrap_or_else(|| "planned".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateVersionInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.released_at.as_deref().and_then(parse_date) {
        set.insert("releasedAt", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &BugVersion) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BugVersion>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_versions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BugVersion>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.find"))
    })?;
    let mut rows: Vec<BugVersion> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %version_id))]
pub async fn get_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(version_id): Path<String>,
) -> Result<Json<BugVersion>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&version_id)?;
    let coll = mongo.collection::<BugVersion>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("version".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVersionInput>,
) -> Result<Json<CreateVersionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = version_from_create(input, user_id)?;
    let coll = mongo.collection::<BugVersion>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.insert"))
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
    Ok(Json(CreateVersionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %version_id))]
pub async fn update_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(version_id): Path<String>,
    Json(patch): Json<UpdateVersionInput>,
) -> Result<Json<BugVersion>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&version_id)?;
    let coll = mongo.collection::<BugVersion>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("version".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("version".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("version".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %version_id))]
pub async fn delete_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(version_id): Path<String>,
) -> Result<Json<DeleteVersionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&version_id)?;
    let coll = mongo.collection::<BugVersion>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_versions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("version".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteVersionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_from_create_defaults_planned() {
        let user_id = ObjectId::new();
        let v = version_from_create(
            CreateVersionInput {
                name: "v1.2.0".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        assert_eq!(v.status, "planned");
        assert!(v.released_at.is_none());
    }

    #[test]
    fn version_rejects_empty_name() {
        let user_id = ObjectId::new();
        assert!(
            version_from_create(
                CreateVersionInput {
                    name: " ".into(),
                    ..Default::default()
                },
                user_id,
            )
            .is_err()
        );
    }
}
