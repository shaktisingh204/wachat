//! HTTP handlers for SabMeet polls.

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
    CreatePollInput, CreatePollResponse, ListQuery, ListResponse, VoteInput,
};
use crate::types::{Poll, PollOption};

const COLL: &str = "meet_polls";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn make_option_id(idx: usize) -> String {
    format!("opt_{}", idx + 1)
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_polls(
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
    if let Some(s) = q.status.as_deref().filter(|s| {
        ["draft", "open", "closed"].contains(s)
    }) {
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
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.find")))?;
    let mut rows: Vec<Poll> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.collect")))?;
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
pub async fn create_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePollInput>,
) -> Result<Json<CreatePollResponse>> {
    let user_id = user_oid(&user)?;
    if input.question.trim().is_empty() {
        return Err(ApiError::Validation("question is required".to_owned()));
    }
    if input.options.len() < 2 {
        return Err(ApiError::Validation(
            "at least 2 options are required".to_owned(),
        ));
    }
    let room_id = ObjectId::parse_str(&input.room_id)
        .map_err(|_| ApiError::Validation("roomId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let options: Vec<PollOption> = input
        .options
        .iter()
        .enumerate()
        .map(|(i, label)| PollOption {
            id: make_option_id(i),
            label: label.trim().to_owned(),
            voters: vec![],
            vote_count: 0,
        })
        .collect();
    let mut entity = Poll {
        id: None,
        user_id,
        room_id,
        question: input.question.trim().to_owned(),
        options,
        multi_select: input.multi_select.unwrap_or(false),
        anonymous: input.anonymous.unwrap_or(false),
        status: "open".to_owned(),
        closed_at: None,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<Poll>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.insert")))?;
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
pub async fn vote_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(poll_id): Path<String>,
    Json(input): Json<VoteInput>,
) -> Result<Json<Poll>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&poll_id)?;
    let coll = mongo.collection::<Poll>(COLL);
    let mut poll = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("poll".to_owned()))?;
    if poll.status != "open" {
        return Err(ApiError::Validation("poll is not open for voting".to_owned()));
    }
    if input.voter.trim().is_empty() {
        return Err(ApiError::Validation("voter is required".to_owned()));
    }
    let picks: Vec<String> = if poll.multi_select {
        input.option_ids
    } else {
        input.option_ids.into_iter().take(1).collect()
    };
    for opt in poll.options.iter_mut() {
        if picks.contains(&opt.id) {
            if poll.anonymous {
                opt.vote_count += 1;
            } else if !opt.voters.iter().any(|v| v == &input.voter) {
                opt.voters.push(input.voter.clone());
                opt.vote_count = opt.voters.len() as u32;
            }
        }
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let options_bson = bson::to_bson(&poll.options).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.options.bson"))
    })?;
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "options": options_bson, "updatedAt": now } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.update")))?;
    poll.updated_at = Some(now);
    Ok(Json(poll))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %poll_id))]
pub async fn close_poll(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(poll_id): Path<String>,
) -> Result<Json<Poll>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&poll_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Poll>(COLL);
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "status": "closed", "closedAt": now, "updatedAt": now } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.close")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_polls.refetch")))?
        .ok_or_else(|| ApiError::NotFound("poll".to_owned()))?;
    Ok(Json(after))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn make_option_id_format() {
        assert_eq!(make_option_id(0), "opt_1");
        assert_eq!(make_option_id(4), "opt_5");
    }
}
