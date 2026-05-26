//! HTTP handlers for SabMeet Q&A.

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
    AnswerInput, AskInput, AskResponse, ListQuery, ListResponse, UpvoteInput,
};
use crate::types::QnaItem;

const COLL: &str = "meet_qna";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_qna(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(r) = q
        .room_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("roomId", r);
    }
    match q.state.as_deref().unwrap_or("all") {
        "open" => {
            filter.insert("answered", false);
        }
        "answered" => {
            filter.insert("answered", true);
        }
        _ => {}
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "upvotes": -1, "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<QnaItem>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.find")))?;
    let mut rows: Vec<QnaItem> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn ask_question(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<AskInput>,
) -> Result<Json<AskResponse>> {
    let user_id = user_oid(&user)?;
    if input.question.trim().is_empty() {
        return Err(ApiError::Validation("question is required".to_owned()));
    }
    let room_id = ObjectId::parse_str(&input.room_id)
        .map_err(|_| ApiError::Validation("roomId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = QnaItem {
        id: None,
        user_id,
        room_id,
        asker_name: input.asker_name,
        asker_user_id: input
            .asker_user_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        question: input.question.trim().to_owned(),
        answered: false,
        answer: None,
        answered_by: None,
        answered_at: None,
        upvotes: 0,
        upvoters: vec![],
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<QnaItem>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(AskResponse {
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
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&qna_id)?;
    if input.answer.trim().is_empty() {
        return Err(ApiError::Validation("answer is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<QnaItem>(COLL);
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": {
            "answered": true,
            "answer": input.answer.trim(),
            "answeredBy": user_id,
            "answeredAt": now,
            "updatedAt": now,
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.answer")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.refetch")))?
        .ok_or_else(|| ApiError::NotFound("qna".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %qna_id))]
pub async fn upvote_question(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(qna_id): Path<String>,
    Json(input): Json<UpvoteInput>,
) -> Result<Json<QnaItem>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&qna_id)?;
    if input.voter.trim().is_empty() {
        return Err(ApiError::Validation("voter is required".to_owned()));
    }
    let coll = mongo.collection::<QnaItem>(COLL);
    let mut row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.find_one")))?
        .ok_or_else(|| ApiError::NotFound("qna".to_owned()))?;
    if !row.upvoters.iter().any(|v| v == &input.voter) {
        row.upvoters.push(input.voter.clone());
        row.upvotes = row.upvoters.len() as u32;
        let now = BsonDateTime::from_chrono(Utc::now());
        let upvoters_bson = bson::to_bson(&row.upvoters).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.upvoters.bson"))
        })?;
        coll.update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "upvoters": upvoters_bson,
                "upvotes": row.upvotes,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_qna.upvote")))?;
    }
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder() {
        assert_eq!(COLL, "meet_qna");
    }
}
