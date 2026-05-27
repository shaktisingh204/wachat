//! HTTP handlers for the SabWebinar Q&A entity.

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
    AnswerInput, AskQuestionInput, AskQuestionResponse, ListQuery, ListResponse, UpvoteInput,
};
use crate::types::QnaItem;

const COLL: &str = "sabwebinar_qna";
const WEBINARS_COLL: &str = "sabwebinar_webinars";

#[derive(serde::Deserialize)]
struct WebinarLite {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(rename = "userId")]
    user_id: ObjectId,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_qna(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(w) = q
        .webinar_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("webinarId", w);
    }
    match q.filter.as_deref() {
        Some("answered") => {
            filter.insert("answered", true);
        }
        Some("open") => {
            filter.insert("answered", false);
        }
        _ => {}
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "upvotes": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<QnaItem>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.find")))?;
    let mut rows: Vec<QnaItem> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.collect"))
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

#[instrument(skip_all)]
pub async fn list_qna_public(
    State(mongo): State<MongoHandle>,
    Path(webinar_id): Path<String>,
) -> Result<Json<ListResponse>> {
    let oid = oid_from_str(&webinar_id)?;
    let coll = mongo.collection::<QnaItem>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "upvotes": -1, "createdAt": -1 })
        .limit(200)
        .build();
    let cursor = coll
        .find(doc! { "webinarId": oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.public")))?;
    let rows: Vec<QnaItem> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.collect"))
    })?;
    Ok(Json(ListResponse {
        items: rows,
        page: 0,
        limit: 200,
        has_more: false,
    }))
}

#[instrument(skip_all)]
pub async fn ask_question_public(
    State(mongo): State<MongoHandle>,
    Json(input): Json<AskQuestionInput>,
) -> Result<Json<AskQuestionResponse>> {
    if input.question.trim().is_empty() {
        return Err(ApiError::Validation("question is required".to_owned()));
    }
    let webinar_oid = oid_from_str(&input.webinar_id)?;
    let webinars = mongo.collection::<WebinarLite>(WEBINARS_COLL);
    let webinar = webinars
        .find_one(doc! { "_id": webinar_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.lookup_webinar"))
        })?
        .ok_or_else(|| ApiError::NotFound("webinar".to_owned()))?;

    let mut entity = QnaItem {
        id: None,
        user_id: webinar.user_id,
        webinar_id: webinar.id,
        asker_name: input.asker_name,
        question: input.question.trim().to_owned(),
        answer: None,
        answered: false,
        upvotes: 0,
        upvoters: vec![],
        created_at: BsonDateTime::from_chrono(Utc::now()),
        answered_at: None,
    };

    let coll = mongo.collection::<QnaItem>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(AskQuestionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %qna_id))]
pub async fn answer_question(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(qna_id): Path<String>,
    Json(input): Json<AnswerInput>,
) -> Result<Json<QnaItem>> {
    if input.answer.trim().is_empty() {
        return Err(ApiError::Validation("answer is required".to_owned()));
    }
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&qna_id)?;
    let coll = mongo.collection::<QnaItem>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": {
                "answer": input.answer.trim(),
                "answered": true,
                "answeredAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.answer")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("qna item".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("qna item".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(id = %qna_id))]
pub async fn upvote_question_public(
    State(mongo): State<MongoHandle>,
    Path(qna_id): Path<String>,
    Json(input): Json<UpvoteInput>,
) -> Result<Json<QnaItem>> {
    if input.voter.trim().is_empty() {
        return Err(ApiError::Validation("voter is required".to_owned()));
    }
    let oid = oid_from_str(&qna_id)?;
    let coll = mongo.collection::<QnaItem>(COLL);
    // Dedup-safe upvote: only push if voter not in upvoters[].
    let result = coll
        .update_one(
            doc! { "_id": oid, "upvoters": { "$ne": &input.voter } },
            doc! {
                "$addToSet": { "upvoters": &input.voter },
                "$inc": { "upvotes": 1i64 },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.upvote")))?;
    if result.matched_count == 0 {
        // Already voted or not found — return current state idempotently.
    }
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_qna.upvote.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("qna item".to_owned()))?;
    Ok(Json(after))
}
