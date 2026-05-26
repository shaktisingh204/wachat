//! HTTP handlers for SabMeet participants.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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

use crate::dto::{JoinInput, JoinResponse, LeaveInput, ListQuery, ListResponse};
use crate::types::Participant;

const COLL: &str = "meet_participants";
const ROLE_VARIANTS: &[&str] = &["host", "cohost", "participant", "viewer"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_participants(
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
    if q.state.as_deref().unwrap_or("active") == "active" {
        filter.insert("leftAt", doc! { "$exists": false });
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "joinedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Participant>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.find"))
        })?;
    let mut rows: Vec<Participant> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn join_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<JoinInput>,
) -> Result<Json<JoinResponse>> {
    let user_id = user_oid(&user)?;
    if input.display_name.trim().is_empty() {
        return Err(ApiError::Validation("displayName is required".to_owned()));
    }
    let room_id = ObjectId::parse_str(&input.room_id)
        .map_err(|_| ApiError::Validation("roomId must be a valid ObjectId".to_owned()))?;
    let role = input
        .role
        .unwrap_or_else(|| "participant".to_owned())
        .to_lowercase();
    if !ROLE_VARIANTS.contains(&role.as_str()) {
        return Err(ApiError::Validation(format!(
            "role must be one of {:?}",
            ROLE_VARIANTS
        )));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = Participant {
        id: None,
        user_id,
        room_id,
        participant_user_id: input
            .participant_user_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        guest_email: input.guest_email,
        display_name: input.display_name.trim().to_owned(),
        role,
        joined_at: now,
        left_at: None,
        duration_secs: None,
        ip: input.ip,
        user_agent: input.user_agent,
        created_at: now,
    };
    let coll = mongo.collection::<Participant>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(JoinResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %participant_id))]
pub async fn leave_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(participant_id): Path<String>,
    Json(input): Json<LeaveInput>,
) -> Result<Json<Participant>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&participant_id)?;
    let coll = mongo.collection::<Participant>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("participant".to_owned()))?;
    let left_at = input
        .left_at
        .as_deref()
        .and_then(parse_date)
        .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now()));
    let joined_ts = before.joined_at.timestamp_millis();
    let duration = ((left_at.timestamp_millis() - joined_ts) / 1000).max(0) as u32;
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": { "leftAt": left_at, "durationSecs": duration } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.update"))
    })?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_participants.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("participant".to_owned()))?;
    Ok(Json(after))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::JoinInput;

    #[test]
    fn role_variants_cover_expected() {
        for r in ["host", "cohost", "participant", "viewer"] {
            assert!(ROLE_VARIANTS.contains(&r));
        }
    }

    #[test]
    fn join_input_defaults() {
        let i = JoinInput::default();
        assert_eq!(i.display_name, "");
    }
}
