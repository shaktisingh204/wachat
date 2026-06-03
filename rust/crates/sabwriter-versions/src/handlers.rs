//! HTTP handlers for sabwriter-versions.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CreateVersionInput, CreateVersionResponse, ListQuery, ListResponse};
use crate::types::SabwriterDocumentVersion;

const COLL: &str = "sabwriter_document_versions";
const DOCS_COLL: &str = "sabwriter_documents";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

/// Confirm that `user_id` has access to the document (owner OR shared).
async fn assert_doc_access(
    mongo: &MongoHandle,
    user_id: ObjectId,
    document_id: ObjectId,
) -> Result<Document> {
    let coll = mongo.collection::<Document>(DOCS_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": document_id,
            "$or": [
                { "userId": user_id },
                { "sharedWithUserIds": user_id },
            ]
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    Ok(doc)
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_versions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&q.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "version": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabwriterDocumentVersion>(COLL);
    let cursor = coll
        .find(doc! { "documentId": doc_oid })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_versions.find"))
        })?;
    let mut rows: Vec<SabwriterDocumentVersion> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_versions.collect"))
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
) -> Result<Json<SabwriterDocumentVersion>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&version_id)?;
    let coll = mongo.collection::<SabwriterDocumentVersion>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_versions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_version".to_owned()))?;
    // Access check via parent document.
    assert_doc_access(&mongo, user_id, row.document_id).await?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_version(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVersionInput>,
) -> Result<Json<CreateVersionResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&input.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    // Look up the current version counter on the document and bump it.
    let docs = mongo.collection::<Document>(DOCS_COLL);
    let parent = docs
        .find_one_and_update(
            doc! { "_id": doc_oid },
            doc! {
                "$inc": { "version": 1 },
                "$set": { "updatedAt": now_bson(), "updatedBy": user_id },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.bump")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    // After `find_one_and_update` (default `ReturnDocument::Before`), the
    // existing version is in `parent.version`. New version is +1.
    let prev_version = parent.get_i32("version").unwrap_or(0) as u32;
    let new_version = prev_version + 1;

    let mut entity = SabwriterDocumentVersion {
        id: None,
        user_id,
        document_id: doc_oid,
        version: new_version,
        content_json: input.content_json.clone(),
        author_user_id: user_id,
        comment: input.comment,
        saved_at: now_bson(),
    };

    let coll = mongo.collection::<SabwriterDocumentVersion>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_versions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    // Stamp the document with its latest version reference + contentJson.
    let _ = docs
        .update_one(
            doc! { "_id": doc_oid },
            doc! { "$set": {
                "latestVersionId": new_id,
                "contentJson": bson::to_bson(&input.content_json).unwrap_or(bson::Bson::Null),
            }},
        )
        .await;

    Ok(Json(CreateVersionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}
