use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::FILE_STORE_COLL;
use crate::dto::{CreateEntryBody, ListEntriesQuery, ListEntriesResponse, MAX_LIMIT};
use crate::state::SabcatalystFileStoreState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_entries(
    user: AuthUser,
    State(state): State<SabcatalystFileStoreState>,
    Query(q): Query<ListEntriesQuery>,
) -> Result<Json<ListEntriesResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let mut filter = doc! { "userId": owner, "projectId": project };
    if let Some(p) = q.key_prefix.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("key", doc! { "$regex": format!("^{}", regex_escape(p)) });
    }
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();
    let cur = state
        .mongo
        .collection::<Document>(FILE_STORE_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("file_store.find")))?;
    let docs: Vec<Document> = cur
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("file_store.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    };
    Ok(Json(ListEntriesResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn create_entry(
    user: AuthUser,
    State(state): State<SabcatalystFileStoreState>,
    Json(body): Json<CreateEntryBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.key.trim().is_empty() {
        return Err(ApiError::BadRequest("key required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let coll = state.mongo.collection::<Document>(FILE_STORE_COLL);
    let dup = coll
        .find_one(doc! { "projectId": project, "key": &body.key })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("file_store.dup")))?;
    if dup.is_some() {
        return Err(ApiError::Conflict("key already exists in project".into()));
    }
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project,
        "key": body.key,
        "sabfilesFileId": body.sabfiles_file_id,
        "sizeBytes": body.size_bytes,
        "contentType": body.content_type,
        "public": body.public.unwrap_or(false),
        "uploadedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    coll.insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("file_store.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn delete_entry(
    user: AuthUser,
    State(state): State<SabcatalystFileStoreState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state
        .mongo
        .collection::<Document>(FILE_STORE_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("file_store.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("File entry not found.".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '.' | '+' | '*' | '?' | '^' | '$' | '(' | ')' | '[' | ']' | '{' | '}' | '|' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}
