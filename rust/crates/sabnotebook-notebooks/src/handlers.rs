//! HTTP handlers for SabNotebook notebooks.

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
    CreateNotebookInput, CreateNotebookResponse, DeleteNotebookResponse, ListQuery,
    UpdateNotebookInput,
};
use crate::types::SabnotebookNotebook;

const COLL: &str = "sabnotebook_notebooks";
const ENTITY_KIND: &str = "sabnotebook_notebook";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, parent_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("archived", true);
        }
        _ => {
            filter.insert("archived", doc! { "$ne": true });
        }
    }
    if let Some(p) = parent_id.map(str::trim).filter(|s| !s.is_empty()) {
        if p == "root" || p == "null" {
            filter.insert("parentId", doc! { "$exists": false });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
        }
    }
    filter
}

fn notebook_from_create(
    input: CreateNotebookInput,
    user_id: ObjectId,
) -> Result<SabnotebookNotebook> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabnotebookNotebook {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        color: input.color,
        cover_file_id: input
            .cover_file_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        parent_id: input
            .parent_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        description: input.description,
        archived: input.archived.unwrap_or(false),
        note_count: 0,
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateNotebookInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    let mut unset = Document::new();
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.cover_file_id {
        if v.is_empty() {
            unset.insert("coverFileId", "");
        } else if let Ok(oid) = ObjectId::parse_str(&v) {
            set.insert("coverFileId", oid);
        }
    }
    if let Some(v) = patch.parent_id {
        if v.is_empty() {
            unset.insert("parentId", "");
        } else if let Ok(oid) = ObjectId::parse_str(&v) {
            set.insert("parentId", oid);
        }
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.archived {
        set.insert("archived", v);
    }
    if let Some(v) = patch.note_count {
        set.insert("noteCount", v);
    }
    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }
    update
}

fn doc_for_audit(entity: &SabnotebookNotebook) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabnotebookNotebook>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_notebooks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.parent_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<SabnotebookNotebook>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.find"))
    })?;
    let mut rows: Vec<SabnotebookNotebook> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notebook_id))]
pub async fn get_notebook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notebook_id): Path<String>,
) -> Result<Json<SabnotebookNotebook>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notebook_id)?;
    let coll = mongo.collection::<SabnotebookNotebook>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("notebook".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_notebook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateNotebookInput>,
) -> Result<Json<CreateNotebookResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = notebook_from_create(input, user_id)?;
    let coll = mongo.collection::<SabnotebookNotebook>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateNotebookResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notebook_id))]
pub async fn update_notebook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notebook_id): Path<String>,
    Json(patch): Json<UpdateNotebookInput>,
) -> Result<Json<SabnotebookNotebook>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notebook_id)?;
    let coll = mongo.collection::<SabnotebookNotebook>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("notebook".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("notebook".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("notebook".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notebook_id))]
pub async fn delete_notebook(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notebook_id): Path<String>,
) -> Result<Json<DeleteNotebookResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notebook_id)?;
    let coll = mongo.collection::<SabnotebookNotebook>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "archived": true,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_notebooks.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("notebook".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteNotebookResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("archived"));
    }

    #[test]
    fn list_filter_archived_status_includes_only_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("archived"), None);
        assert_eq!(f.get_bool("archived").unwrap(), true);
    }

    #[test]
    fn notebook_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateNotebookInput {
            name: "  ".into(),
            ..Default::default()
        };
        assert!(notebook_from_create(input, user_id).is_err());
    }

    #[test]
    fn notebook_from_create_defaults_archived_false() {
        let user_id = ObjectId::new();
        let input = CreateNotebookInput {
            name: "Inbox".into(),
            ..Default::default()
        };
        let n = notebook_from_create(input, user_id).unwrap();
        assert!(!n.archived);
        assert_eq!(n.note_count, 0);
    }

    #[test]
    fn update_doc_clears_cover_when_empty() {
        let patch = UpdateNotebookInput {
            cover_file_id: Some(String::new()),
            ..Default::default()
        };
        let doc = build_update_doc(patch);
        assert!(doc.contains_key("$unset"));
    }
}
