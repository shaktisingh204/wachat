//! HTTP handlers for the SabWebinar Poll entity.

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
use rand::{Rng, distributions::Alphanumeric, thread_rng};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePollInput, CreatePollResponse, ListQuery, ListResponse, UpdatePollInput, VotePollInput,
};
use crate::types::{Poll, PollOption};

const COLL: &str = "sabwebinar_polls";
const STATUS_VARIANTS: &[&str] = &["draft", "open", "closed"];

fn gen_option_id() -> String {
    let mut rng = thread_rng();
    (0..8)
        .map(|_| rng.sample(Alphanumeric) as char)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn poll_from_create(input: CreatePollInput, user_id: ObjectId) -> Result<Poll> {
    if input.question.trim().is_empty() {
        return Err(ApiError::Validation("question is required".to_owned()));
    }
    let labels: Vec<String> = input
        .options
        .into_iter()
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
        .collect();
    if labels.len() < 2 {
        return Err(ApiError::Validation(
            "at least two options are required".to_owned(),
        ));
    }
    let webinar_oid = oid_from_str(&input.webinar_id)?;
    Ok(Poll {
        id: None,
        user_id,
        webinar_id: webinar_oid,
        question: input.question.trim().to_owned(),
        options: labels
            .into_iter()
            .map(|label| PollOption {
                id: gen_option_id(),
                label,
                voters: vec![],
                vote_count: 0,
            })
            .collect(),
        anonymous: input.anonymous.unwrap_or(false),
        status: "draft".to_owned(),
        opened_at: None,
        closed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_polls(
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
    if let Some(s) = q.status.as_deref().filter(|s| STATUS_VARIANTS.contains(s)) {
        filter.insert("status", s);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Poll>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.find")))?;
    let mut rows: Vec<Poll> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.collect"))
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

/// Public — list polls for a webinar (read-only, no auth). Used by the
/// attendee live view.
#[instrument(skip_all, fields(webinar_id = %webinar_id))]
pub async fn list_polls_public(
    State(mongo): State<MongoHandle>,
    Path(webinar_id): Path<String>,
) -> Result<Json<ListResponse>> {
    let oid = oid_from_str(&webinar_id)?;
    let filter = doc! { "webinarId": oid, "status": { "$in": ["open", "closed"] } };
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(50)
        .build();
    let coll = mongo.collection::<Poll>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.public")))?;
    let rows: Vec<Poll> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.collect"))
    })?;
    Ok(Json(ListResponse {
        items: rows,
        page: 0,
        limit: 50,
        has_more: false,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %poll_id))]
pub async fn get_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(poll_id): Path<String>,
) -> Result<Json<Poll>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&poll_id)?;
    let coll = mongo.collection::<Poll>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("poll".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePollInput>,
) -> Result<Json<CreatePollResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = poll_from_create(input, user_id)?;
    let coll = mongo.collection::<Poll>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePollResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %poll_id))]
pub async fn update_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(poll_id): Path<String>,
    Json(patch): Json<UpdatePollInput>,
) -> Result<Json<Poll>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&poll_id)?;
    let coll = mongo.collection::<Poll>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(q) = patch.question {
        set.insert("question", q);
    }
    if let Some(s) = patch.status.as_deref() {
        if !STATUS_VARIANTS.contains(&s) {
            return Err(ApiError::Validation(format!(
                "status must be one of {:?}",
                STATUS_VARIANTS
            )));
        }
        set.insert("status", s);
        if s == "open" {
            set.insert("openedAt", now);
        }
        if s == "closed" {
            set.insert("closedAt", now);
        }
    }
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("poll".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("poll".to_owned()))?;
    Ok(Json(after))
}

/// Public — unauthenticated vote.
#[instrument(skip_all, fields(id = %poll_id))]
pub async fn vote_poll_public(
    State(mongo): State<MongoHandle>,
    Path(poll_id): Path<String>,
    Json(input): Json<VotePollInput>,
) -> Result<Json<Poll>> {
    let oid = oid_from_str(&poll_id)?;
    let coll = mongo.collection::<Poll>(COLL);
    let poll = coll
        .find_one(doc! { "_id": oid, "status": "open" })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.vote.find")))?
        .ok_or_else(|| ApiError::NotFound("open poll".to_owned()))?;

    let voter = input.voter.unwrap_or_default();

    // Dedup: if not anonymous and voter already voted on any option, reject.
    if !poll.anonymous && !voter.is_empty() {
        let already = poll.options.iter().any(|o| o.voters.iter().any(|v| v == &voter));
        if already {
            return Err(ApiError::Validation("already voted".to_owned()));
        }
    }

    // Increment chosen option.
    let mut update = doc! {
        "$inc": { "options.$[opt].voteCount": 1i64 },
    };
    if !poll.anonymous && !voter.is_empty() {
        update.insert(
            "$push",
            doc! { "options.$[opt].voters": &voter },
        );
    }
    let opts = mongodb::options::UpdateOptions::builder()
        .array_filters(vec![doc! { "opt.id": &input.option_id }])
        .build();
    let result = coll
        .update_one(doc! { "_id": oid }, update)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.vote.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("poll option".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_polls.vote.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("poll".to_owned()))?;
    Ok(Json(after))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_too_few_options() {
        let uid = ObjectId::new();
        let input = CreatePollInput {
            webinar_id: ObjectId::new().to_hex(),
            question: "Yes?".into(),
            options: vec!["only one".into()],
            anonymous: None,
        };
        assert!(poll_from_create(input, uid).is_err());
    }

    #[test]
    fn accepts_minimal_poll() {
        let uid = ObjectId::new();
        let input = CreatePollInput {
            webinar_id: ObjectId::new().to_hex(),
            question: "Pick one".into(),
            options: vec!["A".into(), "B".into()],
            anonymous: Some(true),
        };
        let p = poll_from_create(input, uid).unwrap();
        assert_eq!(p.options.len(), 2);
        assert_eq!(p.status, "draft");
        assert!(p.anonymous);
    }
}
