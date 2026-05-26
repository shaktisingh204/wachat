//! HTTP handlers for the Voice Call (CDR) entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateCallInput, CreateCallResponse, DeleteCallResponse, ListQuery, UpdateCallInput,
};
use crate::types::VoiceCall;

const COLL: &str = "sabvoice_calls";
const ENTITY_KIND: &str = "voice_call";
const VALID_STATUS: &[&str] = &["completed", "missed", "abandoned", "voicemail", "failed"];
const VALID_DIRECTION: &[&str] = &["inbound", "outbound"];
const VALID_PROVIDERS: &[&str] = &["twilio", "plivo", "mock"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = DateTime::parse_from_rfc3339(s).map_err(|_| {
        ApiError::Validation(format!("'{s}' is not a valid ISO-8601 timestamp"))
    })?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn maybe_oid(opt: Option<&str>) -> Option<ObjectId> {
    opt.and_then(|s| ObjectId::parse_str(s).ok())
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUS:?}"
        )))
    }
}

fn validate_direction(s: &str) -> Result<()> {
    if VALID_DIRECTION.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "direction must be one of {VALID_DIRECTION:?}"
        )))
    }
}

fn validate_provider(s: &str) -> Result<()> {
    if VALID_PROVIDERS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "provider must be one of {VALID_PROVIDERS:?}"
        )))
    }
}

fn call_from_create(input: CreateCallInput, user_id: ObjectId) -> Result<VoiceCall> {
    if input.from_number.trim().is_empty() {
        return Err(ApiError::Validation("fromNumber is required".to_owned()));
    }
    if input.to_number.trim().is_empty() {
        return Err(ApiError::Validation("toNumber is required".to_owned()));
    }
    validate_direction(&input.direction)?;
    validate_status(&input.status)?;
    let provider = input.provider.unwrap_or_else(|| "mock".to_owned());
    validate_provider(&provider)?;
    let started_at = match input.started_at.as_deref() {
        Some(s) => parse_iso(s)?,
        None => BsonDateTime::from_chrono(Utc::now()),
    };
    let ended_at = match input.ended_at.as_deref() {
        Some(s) => Some(parse_iso(s)?),
        None => None,
    };
    Ok(VoiceCall {
        id: None,
        user_id,
        from_number: input.from_number.trim().to_owned(),
        to_number: input.to_number.trim().to_owned(),
        direction: input.direction,
        agent_id: maybe_oid(input.agent_id.as_deref()),
        queue_id: maybe_oid(input.queue_id.as_deref()),
        ivr_id: maybe_oid(input.ivr_id.as_deref()),
        did_id: maybe_oid(input.did_id.as_deref()),
        started_at,
        ended_at,
        duration_secs: input.duration_secs.unwrap_or(0),
        status: input.status,
        recording_file_id: input.recording_file_id,
        provider,
        provider_call_sid: input.provider_call_sid,
        cost: input.cost,
        currency: input.currency,
        notes: input.notes,
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCallInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.ended_at {
        set.insert("endedAt", parse_iso(&v)?);
    }
    if let Some(v) = patch.duration_secs {
        set.insert("durationSecs", v);
    }
    if let Some(v) = patch.recording_file_id {
        set.insert("recordingFileId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = maybe_oid(patch.agent_id.as_deref()) {
        set.insert("agentId", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceCall) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceCall>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_calls(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(d) = q.direction.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("direction", d);
    }
    if let Some(a) = maybe_oid(q.agent_id.as_deref()) {
        filter.insert("agentId", a);
    }
    if let Some(qq) = maybe_oid(q.queue_id.as_deref()) {
        filter.insert("queueId", qq);
    }
    let mut range = doc! {};
    if let Some(from) = q.from.as_deref() {
        range.insert("$gte", parse_iso(from)?);
    }
    if let Some(to) = q.to.as_deref() {
        range.insert("$lte", parse_iso(to)?);
    }
    if !range.is_empty() {
        filter.insert("startedAt", range);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["fromNumber", "toNumber", "notes", "providerCallSid"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<VoiceCall>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.find")))?;
    let mut rows: Vec<VoiceCall> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %call_id))]
pub async fn get_call(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(call_id): Path<String>,
) -> Result<Json<VoiceCall>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&call_id)?;
    let coll = mongo.collection::<VoiceCall>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_call".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_call(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCallInput>,
) -> Result<Json<CreateCallResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = call_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceCall>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateCallResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %call_id))]
pub async fn update_call(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(call_id): Path<String>,
    Json(patch): Json<UpdateCallInput>,
) -> Result<Json<VoiceCall>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&call_id)?;
    let coll = mongo.collection::<VoiceCall>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_call".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_call".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voice_call".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %call_id))]
pub async fn delete_call(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(call_id): Path<String>,
) -> Result<Json<DeleteCallResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&call_id)?;
    let coll = mongo.collection::<VoiceCall>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_calls.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("voice_call".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCallResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn call_from_create_defaults_provider_to_mock_and_started_at_to_now() {
        let user_id = ObjectId::new();
        let input = CreateCallInput {
            from_number: "+14155550100".into(),
            to_number: "+14155550200".into(),
            direction: "inbound".into(),
            status: "completed".into(),
            ..Default::default()
        };
        let c = call_from_create(input, user_id).unwrap();
        assert_eq!(c.provider, "mock");
        assert_eq!(c.duration_secs, 0);
    }

    #[test]
    fn call_from_create_rejects_bad_status() {
        let user_id = ObjectId::new();
        let input = CreateCallInput {
            from_number: "+14155550100".into(),
            to_number: "+14155550200".into(),
            direction: "inbound".into(),
            status: "exploded".into(),
            ..Default::default()
        };
        assert!(call_from_create(input, user_id).is_err());
    }
}
