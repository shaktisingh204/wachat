//! HTTP handlers for the SabMeet Room entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
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
    CreateRoomInput, CreateRoomResponse, DeleteRoomResponse, ListQuery, ListResponse,
    UpdateRoomInput,
};
use crate::types::Room;

const COLL: &str = "meet_rooms";
const STATUS_VARIANTS: &[&str] = &["scheduled", "live", "ended", "canceled"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn oid_vec(input: Option<&Vec<String>>) -> Option<Vec<ObjectId>> {
    input.map(|v| {
        v.iter()
            .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
            .collect()
    })
}

fn gen_join_code() -> String {
    // 3-4-3 alphanumeric, e.g. `kf8-pq2zm-9wv`.
    let mut rng = thread_rng();
    let mut part = |n: usize| -> String {
        (0..n)
            .map(|_| rng.sample(Alphanumeric) as char)
            .map(|c| c.to_ascii_lowercase())
            .collect()
    };
    format!("{}-{}-{}", part(3), part(4), part(3))
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q
        .status
        .as_deref()
        .filter(|s| STATUS_VARIANTS.contains(s))
    {
        filter.insert("status", s);
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    match q.when.as_deref().unwrap_or("upcoming") {
        "all" => {}
        "live" => {
            filter.insert("status", "live");
        }
        "past" => {
            filter.insert(
                "$or",
                vec![
                    bson::Bson::Document(doc! { "status": "ended" }),
                    bson::Bson::Document(doc! { "scheduledEnd": { "$lt": now } }),
                ],
            );
        }
        _ => {
            filter.insert(
                "$or",
                vec![
                    bson::Bson::Document(doc! { "scheduledStart": { "$gte": now } }),
                    bson::Bson::Document(doc! { "scheduledStart": { "$exists": false } }),
                    bson::Bson::Document(doc! { "status": "live" }),
                ],
            );
        }
    }
    if let Some(h) = q
        .host_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("hostUserId", h);
    }
    filter
}

fn room_from_create(input: CreateRoomInput, user_id: ObjectId) -> Result<Room> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let host = input
        .host_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
        .unwrap_or(user_id);

    Ok(Room {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        host_user_id: host,
        cohost_user_ids: oid_vec(input.cohost_user_ids.as_ref()).unwrap_or_default(),
        invitee_user_ids: oid_vec(input.invitee_user_ids.as_ref()).unwrap_or_default(),
        invitee_emails: input.invitee_emails.unwrap_or_default(),
        scheduled_start: input.scheduled_start.as_deref().and_then(parse_date),
        scheduled_end: input.scheduled_end.as_deref().and_then(parse_date),
        timezone: input.timezone,
        recurring_rule: input.recurring_rule,
        join_code: gen_join_code(),
        passcode: input.passcode,
        lobby_enabled: input.lobby_enabled.unwrap_or(true),
        recording_enabled: input.recording_enabled.unwrap_or(false),
        require_auth: input.require_auth.unwrap_or(false),
        sfu_room_id: None,
        status: "scheduled".to_owned(),
        description: input.description,
        agenda: input.agenda.unwrap_or_default(),
        started_at: None,
        ended_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRoomInput) -> Result<Document> {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };

    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.agenda {
        set.insert("agenda", v);
    }
    if let Some(v) = oid_vec(patch.cohost_user_ids.as_ref()) {
        set.insert("cohostUserIds", v);
    }
    if let Some(v) = oid_vec(patch.invitee_user_ids.as_ref()) {
        set.insert("inviteeUserIds", v);
    }
    if let Some(v) = patch.invitee_emails {
        set.insert("inviteeEmails", v);
    }
    if let Some(v) = patch.scheduled_start.as_deref().and_then(parse_date) {
        set.insert("scheduledStart", v);
    }
    if let Some(v) = patch.scheduled_end.as_deref().and_then(parse_date) {
        set.insert("scheduledEnd", v);
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    if let Some(v) = patch.passcode {
        set.insert("passcode", v);
    }
    if let Some(v) = patch.lobby_enabled {
        set.insert("lobbyEnabled", v);
    }
    if let Some(v) = patch.recording_enabled {
        set.insert("recordingEnabled", v);
    }
    if let Some(v) = patch.require_auth {
        set.insert("requireAuth", v);
    }
    if let Some(v) = patch.sfu_room_id {
        set.insert("sfuRoomId", v);
    }
    if let Some(v) = patch.status.as_deref() {
        if !STATUS_VARIANTS.contains(&v) {
            return Err(ApiError::Validation(format!(
                "status must be one of {:?}",
                STATUS_VARIANTS
            )));
        }
        set.insert("status", v);
        if v == "live" {
            set.insert("startedAt", now);
        }
        if v == "ended" || v == "canceled" {
            set.insert("endedAt", now);
        }
    }
    Ok(doc! { "$set": set })
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rooms(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "joinCode"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "scheduledStart": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Room>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.find")))?;
    let mut rows: Vec<Room> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %room_id))]
pub async fn get_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(room_id): Path<String>,
) -> Result<Json<Room>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&room_id)?;
    let coll = mongo.collection::<Room>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.find_one")))?
        .ok_or_else(|| ApiError::NotFound("room".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRoomInput>,
) -> Result<Json<CreateRoomResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = room_from_create(input, user_id)?;
    let coll = mongo.collection::<Room>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateRoomResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %room_id))]
pub async fn update_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(room_id): Path<String>,
    Json(patch): Json<UpdateRoomInput>,
) -> Result<Json<Room>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&room_id)?;
    let coll = mongo.collection::<Room>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("room".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.refetch")))?
        .ok_or_else(|| ApiError::NotFound("room".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %room_id))]
pub async fn delete_room(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(room_id): Path<String>,
) -> Result<Json<DeleteRoomResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&room_id)?;
    let coll = mongo.collection::<Room>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "canceled",
                "endedAt": BsonDateTime::from_chrono(Utc::now()),
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_rooms.cancel")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("room".to_owned()));
    }
    Ok(Json(DeleteRoomResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_from_create_defaults() {
        let uid = ObjectId::new();
        let input = CreateRoomInput {
            name: "Team Standup".into(),
            ..Default::default()
        };
        let r = room_from_create(input, uid).unwrap();
        assert_eq!(r.status, "scheduled");
        assert_eq!(r.host_user_id, uid);
        assert!(r.lobby_enabled);
        assert!(!r.recording_enabled);
        assert!(!r.join_code.is_empty());
    }

    #[test]
    fn rejects_empty_name() {
        let uid = ObjectId::new();
        let input = CreateRoomInput {
            name: " ".into(),
            ..Default::default()
        };
        assert!(room_from_create(input, uid).is_err());
    }

    #[test]
    fn build_update_stamps_started_when_live() {
        let patch = UpdateRoomInput {
            status: Some("live".into()),
            ..Default::default()
        };
        let upd = build_update_doc(patch).unwrap();
        let set = upd.get_document("$set").unwrap();
        assert!(set.contains_key("startedAt"));
    }

    #[test]
    fn build_update_rejects_bad_status() {
        let patch = UpdateRoomInput {
            status: Some("haunted".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }
}
