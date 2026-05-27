//! HTTP handlers for sabwriter-documents.

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
    CreateDocumentInput, CreateDocumentResponse, DeleteDocumentResponse, ListQuery, ListResponse,
    ShareInput, UpdateDocumentInput,
};
use crate::types::{DocumentStatus, SabwriterDocument};

const COLL: &str = "sabwriter_documents";
const ENTITY_KIND: &str = "sabwriter_document";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

/// Visibility filter — owner OR explicitly shared.
fn visibility_filter(user_id: ObjectId, include_shared: bool) -> Document {
    if include_shared {
        doc! { "$or": [
            { "userId": user_id },
            { "sharedWithUserIds": user_id },
        ]}
    } else {
        doc! { "userId": user_id }
    }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, include_shared: bool) -> Document {
    let mut filter = visibility_filter(user_id, include_shared);
    match status.unwrap_or("all") {
        "all" => {}
        "shared" => {
            filter = doc! { "sharedWithUserIds": user_id };
        }
        s if matches!(
            s,
            "draft" | "in_review" | "approved" | "sent_for_signature"
        ) =>
        {
            filter.insert("status", s);
        }
        _ => {}
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "$or": [
        { "userId": user_id },
        { "sharedWithUserIds": user_id },
    ]}
}

fn owner_only_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn doc_for_audit(d: &SabwriterDocument) -> Document {
    bson::to_document(d).unwrap_or_default()
}

fn parse_oid_list(raw: &[String]) -> Vec<ObjectId> {
    raw.iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

fn entity_from_create(
    input: CreateDocumentInput,
    user_id: ObjectId,
    created_by: Option<ObjectId>,
) -> Result<SabwriterDocument> {
    let title = input.title.trim().to_owned();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(SabwriterDocument {
        id: None,
        user_id,
        project_id: None,
        tenant_id: None,
        owner_user_id: user_id,
        title,
        shared_with_user_ids: parse_oid_list(&input.shared_with_user_ids),
        content_json: input
            .content_json
            .unwrap_or_else(|| serde_json::json!({ "type": "doc", "content": [] })),
        status: DocumentStatus::Draft,
        version: 0,
        latest_version_id: None,
        envelope_id: None,
        created_at: now_bson(),
        updated_at: None,
        created_by,
        updated_by: created_by,
    })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_documents(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let include_shared = q.include_shared.unwrap_or(true);
    let mut filter = list_filter(user_id, q.status.as_deref(), include_shared);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabwriterDocument>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find")))?;
    let mut rows: Vec<SabwriterDocument> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn get_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
) -> Result<Json<SabwriterDocument>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<SabwriterDocument>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDocumentInput>,
) -> Result<Json<CreateDocumentResponse>> {
    let user_id = user_oid(&user)?;
    let created_by = user_oid(&user).ok();
    let mut entity = entity_from_create(input, user_id, created_by)?;
    let coll = mongo.collection::<SabwriterDocument>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateDocumentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn update_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
    Json(patch): Json<UpdateDocumentInput>,
) -> Result<Json<SabwriterDocument>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<SabwriterDocument>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;

    let mut set = doc! { "updatedAt": now_bson(), "updatedBy": user_id };
    if let Some(v) = patch.title {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation("title cannot be empty".to_owned()));
        }
        set.insert("title", t);
    }
    if let Some(v) = patch.content_json {
        let b = bson::to_bson(&v).unwrap_or(bson::Bson::Null);
        set.insert("contentJson", b);
    }
    if let Some(v) = patch.status {
        let s = match v {
            DocumentStatus::Draft => "draft",
            DocumentStatus::InReview => "in_review",
            DocumentStatus::Approved => "approved",
            DocumentStatus::SentForSignature => "sent_for_signature",
        };
        set.insert("status", s);
    }
    if let Some(v) = patch.shared_with_user_ids {
        // Only the owner may change the share list.
        if before.owner_user_id != user_id {
            return Err(ApiError::Validation(
                "only the document owner can change collaborators".to_owned(),
            ));
        }
        let arr: Vec<ObjectId> = v
            .iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect();
        set.insert(
            "sharedWithUserIds",
            bson::to_bson(&arr).unwrap_or(bson::Bson::Array(vec![])),
        );
    }
    if let Some(v) = patch.envelope_id {
        set.insert("envelopeId", v);
    }

    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.update")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn delete_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
) -> Result<Json<DeleteDocumentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<SabwriterDocument>(COLL);
    // Only the owner can delete.
    let res = coll
        .delete_one(owner_only_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.delete")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("sabwriter_document".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDocumentResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn share_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
    Json(input): Json<ShareInput>,
) -> Result<Json<SabwriterDocument>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<SabwriterDocument>(COLL);
    let arr: Vec<ObjectId> = input
        .user_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect();
    let res = coll
        .update_one(
            owner_only_filter(user_id, oid),
            doc! { "$set": {
                "sharedWithUserIds": bson::to_bson(&arr).unwrap_or(bson::Bson::Array(vec![])),
                "updatedAt": now_bson(),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.share")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("sabwriter_document".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    Ok(Json(after))
}
