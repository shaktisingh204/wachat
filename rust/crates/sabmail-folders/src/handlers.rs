//! HTTP handlers for SabMail folders.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateFolderInput, CreateFolderResponse, DeleteFolderResponse, ListQuery, UpdateFolderInput,
};
use crate::types::SabmailFolder;

const COLL: &str = "sabmail_folders";
const ENTITY_KIND: &str = "sabmail_folder";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabmailFolder>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_folders(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id, "status": { "$ne": "archived" } };
    if let Some(aid) = q
        .account_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?
    {
        filter.insert("accountId", aid);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmailFolder>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.find"))
        })?;
    let mut rows: Vec<SabmailFolder> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.collect"))
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
) -> Result<Json<SabmailFolder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&folder_id)?;
    let coll = mongo.collection::<SabmailFolder>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_folder".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFolderInput>,
) -> Result<Json<CreateFolderResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let account_oid = oid_from_str(&input.account_id)?;
    let parent_oid = input
        .parent_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?;

    let mut entity = SabmailFolder {
        id: None,
        user_id,
        account_id: account_oid,
        name: input.name.trim().to_owned(),
        parent_id: parent_oid,
        folder_type: input.folder_type.unwrap_or_else(|| "custom".to_owned()),
        unread_count: Some(0),
        total_count: Some(0),
        status: Some("active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<SabmailFolder>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(ev) = audit_for_create(
        &user,
        ENTITY_KIND,
        new_id,
        Some(bson::to_document(&entity).unwrap_or_default()),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateFolderResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, folder_id = %folder_id))]
pub async fn update_folder(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(folder_id): Path<String>,
    Json(patch): Json<UpdateFolderInput>,
) -> Result<Json<SabmailFolder>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&folder_id)?;
    let coll = mongo.collection::<SabmailFolder>(COLL);
    let before = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_folder".to_owned()))?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.parent_id {
        if v.is_empty() {
            set.insert("parentId", bson::Bson::Null);
        } else {
            set.insert("parentId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    coll.update_one(ownership(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.update")))?;
    let after = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabmail_folder".to_owned()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(bson::to_document(&before).unwrap_or_default()),
        Some(bson::to_document(&after).unwrap_or_default()),
    ) {
        write_audit(&mongo, ev).await;
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
    let coll = mongo.collection::<SabmailFolder>(COLL);
    let res = coll
        .update_one(
            ownership(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmail_folders.archive"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabmail_folder".to_owned()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteFolderResponse { deleted: true }))
}
