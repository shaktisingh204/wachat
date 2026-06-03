//! HTTP handlers for the TaskTag entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateTaskTagInput, CreateTaskTagResponse, DeleteTaskTagResponse, ListQuery, UpdateTaskTagInput,
};
use crate::types::CrmTaskTag;

const COLL: &str = "crm_task_tags";
const ENTITY_KIND: &str = "task_tag";

fn list_filter(user_id: ObjectId, status: Option<&str>, is_active: Option<bool>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(active) = is_active {
        filter.insert("isActive", active);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Regex-escape a string for safe insertion into a Mongo `$regex` clause.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '.' | '*' | '+' | '?' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}

/// Case-insensitive name match for this tenant among non-archived tags.
/// Used to enforce per-tenant unique tag names regardless of case.
fn duplicate_name_filter(user_id: ObjectId, name: &str, exclude: Option<ObjectId>) -> Document {
    let pattern = format!("^{}$", regex_escape(name));
    let mut filter = doc! {
        "userId": user_id,
        "name": { "$regex": pattern, "$options": "i" },
        "status": { "$ne": "archived" },
    };
    if let Some(oid) = exclude {
        filter.insert("_id", doc! { "$ne": oid });
    }
    filter
}

fn tag_from_create(input: CreateTaskTagInput, user_id: ObjectId) -> Result<CrmTaskTag> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmTaskTag {
        id: None,
        user_id,
        name: name.to_owned(),
        color: input.color,
        description: input.description,
        tasks_count: 0,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTaskTagInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTaskTag) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTaskTag>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_task_tags(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.is_active);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmTaskTag>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.find")))?;
    let mut rows: Vec<CrmTaskTag> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tag_id))]
pub async fn get_task_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
) -> Result<Json<CrmTaskTag>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;
    let coll = mongo.collection::<CrmTaskTag>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.find_one")))?
        .ok_or_else(|| ApiError::NotFound("task_tag".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_task_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaskTagInput>,
) -> Result<Json<CreateTaskTagResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = tag_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTaskTag>(COLL);

    // Case-insensitive unique-name guard.
    let dup = coll
        .find_one(duplicate_name_filter(user_id, &entity.name, None))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.dup_check"))
        })?;
    if dup.is_some() {
        return Err(ApiError::Validation(format!(
            "task tag '{}' already exists",
            entity.name
        )));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTaskTagResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tag_id))]
pub async fn update_task_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
    Json(patch): Json<UpdateTaskTagInput>,
) -> Result<Json<CrmTaskTag>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;

    let coll = mongo.collection::<CrmTaskTag>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.find_one")))?
        .ok_or_else(|| ApiError::NotFound("task_tag".to_owned()))?;

    // Validate rename uniqueness (case-insensitive, excludes self).
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
        if new_name.to_lowercase() != before.name.to_lowercase() {
            let dup = coll
                .find_one(duplicate_name_filter(user_id, new_name, Some(oid)))
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.dup_check"))
                })?;
            if dup.is_some() {
                return Err(ApiError::Validation(format!(
                    "task tag '{new_name}' already exists"
                )));
            }
        }
    }

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_tag".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.refetch")))?
        .ok_or_else(|| ApiError::NotFound("task_tag".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tag_id))]
pub async fn delete_task_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
) -> Result<Json<DeleteTaskTagResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;

    let coll = mongo.collection::<CrmTaskTag>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_task_tags.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("task_tag".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTaskTagResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        let status = f.get_document("status").unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn tag_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateTaskTagInput {
            name: "  Urgent  ".into(),
            color: Some("#FF0000".into()),
            ..Default::default()
        };
        let t = tag_from_create(input, user_id).unwrap();
        assert_eq!(t.name, "Urgent");
        assert_eq!(t.status, "active");
        assert!(t.is_active);
        assert_eq!(t.tasks_count, 0);
    }

    #[test]
    fn tag_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateTaskTagInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(tag_from_create(input, user_id).is_err());
    }

    #[test]
    fn regex_escape_escapes_metacharacters() {
        assert_eq!(regex_escape("a.b*c"), "a\\.b\\*c");
        assert_eq!(regex_escape("plain"), "plain");
        assert_eq!(regex_escape("(grp)|alt"), "\\(grp\\)\\|alt");
    }
}
