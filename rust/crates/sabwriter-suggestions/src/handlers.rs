//! HTTP handlers for sabwriter-suggestions.

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

use crate::dto::{
    CreateSuggestionInput, CreateSuggestionResponse, ListQuery, ListResponse, ReviewResponse,
};
use crate::types::{SabwriterSuggestion, SuggestionStatus};

const COLL: &str = "sabwriter_suggestions";
const DOCS_COLL: &str = "sabwriter_documents";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

/// Returns the parent document doc — used to check whether the caller is
/// the owner (only owners can accept/reject).
async fn fetch_parent_doc(
    mongo: &MongoHandle,
    user_id: ObjectId,
    document_id: ObjectId,
) -> Result<Document> {
    let coll = mongo.collection::<Document>(DOCS_COLL);
    coll.find_one(doc! {
        "_id": document_id,
        "$or": [
            { "userId": user_id },
            { "sharedWithUserIds": user_id },
        ]
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one")))?
    .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))
}

fn parent_owner_id(parent: &Document) -> Option<ObjectId> {
    parent
        .get_object_id("ownerUserId")
        .ok()
        .or_else(|| parent.get_object_id("userId").ok())
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_suggestions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&q.document_id)?;
    let _ = fetch_parent_doc(&mongo, user_id, doc_oid).await?;

    let mut filter = doc! { "documentId": doc_oid };
    match q.status.as_deref().unwrap_or("all") {
        "pending" => {
            filter.insert("status", "pending");
        }
        "accepted" => {
            filter.insert("status", "accepted");
        }
        "rejected" => {
            filter.insert("status", "rejected");
        }
        _ => {}
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabwriterSuggestion>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.find")))?;
    let mut rows: Vec<SabwriterSuggestion> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %suggestion_id))]
pub async fn get_suggestion(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<SabwriterSuggestion>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&suggestion_id)?;
    let coll = mongo.collection::<SabwriterSuggestion>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_suggestion".to_owned()))?;
    let _ = fetch_parent_doc(&mongo, user_id, row.document_id).await?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_suggestion(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSuggestionInput>,
) -> Result<Json<CreateSuggestionResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&input.document_id)?;
    let _ = fetch_parent_doc(&mongo, user_id, doc_oid).await?;

    let mut entity = SabwriterSuggestion {
        id: None,
        user_id,
        document_id: doc_oid,
        anchor: input.anchor,
        author_user_id: user_id,
        proposal_json: input.proposal_json,
        status: SuggestionStatus::Pending,
        reviewed_by: None,
        reviewed_at: None,
        created_at: now_bson(),
        updated_at: None,
    };

    let coll = mongo.collection::<SabwriterSuggestion>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(CreateSuggestionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

async fn transition(
    mongo: &MongoHandle,
    user_id: ObjectId,
    suggestion_id: ObjectId,
    to: SuggestionStatus,
) -> Result<SabwriterSuggestion> {
    let coll = mongo.collection::<SabwriterSuggestion>(COLL);
    let before = coll
        .find_one(doc! { "_id": suggestion_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_suggestion".to_owned()))?;

    let parent = fetch_parent_doc(mongo, user_id, before.document_id).await?;
    // Only the document owner can accept/reject.
    let owner = parent_owner_id(&parent)
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("document missing ownerUserId/userId")))?;
    if owner != user_id {
        return Err(ApiError::Validation(
            "only the document owner can review suggestions".to_owned(),
        ));
    }
    if !matches!(before.status, SuggestionStatus::Pending) {
        return Err(ApiError::Validation(
            "suggestion has already been reviewed".to_owned(),
        ));
    }
    let status_str = match to {
        SuggestionStatus::Pending => "pending",
        SuggestionStatus::Accepted => "accepted",
        SuggestionStatus::Rejected => "rejected",
    };
    coll.update_one(
        doc! { "_id": suggestion_id },
        doc! { "$set": {
            "status": status_str,
            "reviewedBy": user_id,
            "reviewedAt": now_bson(),
            "updatedAt": now_bson(),
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.review")))?;
    let after = coll
        .find_one(doc! { "_id": suggestion_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_suggestions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabwriter_suggestion".to_owned()))?;
    Ok(after)
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %suggestion_id))]
pub async fn accept_suggestion(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<ReviewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&suggestion_id)?;
    let after = transition(&mongo, user_id, oid, SuggestionStatus::Accepted).await?;
    Ok(Json(ReviewResponse {
        ok: true,
        entity: after,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %suggestion_id))]
pub async fn reject_suggestion(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<ReviewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&suggestion_id)?;
    let after = transition(&mongo, user_id, oid, SuggestionStatus::Rejected).await?;
    Ok(Json(ReviewResponse {
        ok: true,
        entity: after,
    }))
}
