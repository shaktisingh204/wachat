//! SabVault folder hierarchy CRUD.

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
    CreateFolderInput, CreateFolderResponse, DeleteFolderResponse, ListQuery, ListResponse,
    UpdateFolderInput,
};
use crate::types::SabvaultFolder;

pub const FOLDERS_COLL: &str = "sabvault_folders";
const ENTITY_KIND: &str = "sabvault_folder";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
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
    filter
}

fn ownership_filter(user_id: ObjectId, folder_oid: ObjectId) -> Document {
    doc! { "_id": folder_oid, "userId": user_id }
}

fn folder_from_create(input: CreateFolderInput, user_id: ObjectId) -> Result<SabvaultFolder> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let parent_oid = match input.parent_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabvaultFolder {
        id: None,
        user_id,
        name: input.name,
        parent_id: parent_oid,
        color: input.color,
        icon: input.icon,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    })
}

fn build_update_doc(patch: UpdateFolderInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.parent_id {
        if v.is_empty() {
            set.insert("parentId", Bson::Null);
        } else {
            set.insert("parentId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_folders(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    if let Some(p) = q.parent_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentId", oid);
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabvaultFolder>(FOLDERS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.find"))
        })?;
    let mut rows: Vec<SabvaultFolder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, folder_id = %folder_id))]
pub async fn get_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(folder_id): Path<String>,
) -> Result<Json<SabvaultFolder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&folder_id)?;
    let coll = mongo.collection::<SabvaultFolder>(FOLDERS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_folder".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFolderInput>,
) -> Result<Json<CreateFolderResponse>> {
    let user_id = user_oid(&user)?;
    let mut folder = folder_from_create(input, user_id)?;
    let coll = mongo.collection::<SabvaultFolder>(FOLDERS_COLL);
    let inserted = coll
        .insert_one(&folder)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    folder.id = Some(new_id);

    if let Some(event) = audit_for_create(
        &user,
        ENTITY_KIND,
        new_id,
        Some(bson::to_document(&folder).unwrap_or_default()),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateFolderResponse {
        id: new_id.to_hex(),
        entity: folder,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, folder_id = %folder_id))]
pub async fn update_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(folder_id): Path<String>,
    Json(patch): Json<UpdateFolderInput>,
) -> Result<Json<SabvaultFolder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&folder_id)?;
    let coll = mongo.collection::<SabvaultFolder>(FOLDERS_COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_folder".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabvault_folder".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_folder".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(bson::to_document(&before).unwrap_or_default()),
        Some(bson::to_document(&after).unwrap_or_default()),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, folder_id = %folder_id))]
pub async fn delete_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(folder_id): Path<String>,
) -> Result<Json<DeleteFolderResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&folder_id)?;
    let coll = mongo.collection::<SabvaultFolder>(FOLDERS_COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_folders.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabvault_folder".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteFolderResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_empty_name() {
        let input = CreateFolderInput {
            name: " ".into(),
            ..Default::default()
        };
        assert!(folder_from_create(input, ObjectId::new()).is_err());
    }

    #[test]
    fn create_stamps_active() {
        let input = CreateFolderInput {
            name: "Work".into(),
            ..Default::default()
        };
        let f = folder_from_create(input, ObjectId::new()).unwrap();
        assert_eq!(f.status.as_deref(), Some("active"));
    }
}
