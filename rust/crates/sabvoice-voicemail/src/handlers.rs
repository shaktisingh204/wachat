//! HTTP handlers for the Voicemail entity.

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
    CreateVoicemailInput, CreateVoicemailResponse, DeleteVoicemailResponse, ListQuery, ListenInput,
    UpdateVoicemailInput,
};
use crate::types::VoiceVoicemail;

const COLL: &str = "sabvoice_voicemail";
const ENTITY_KIND: &str = "sabvoice_voicemail";
const VALID_STATUS: &[&str] = &["new", "listened", "archived"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
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

fn vm_from_create(input: CreateVoicemailInput, user_id: ObjectId) -> Result<VoiceVoicemail> {
    if input.audio_file_id.trim().is_empty() {
        return Err(ApiError::Validation("audioFileId is required".to_owned()));
    }
    let call_id = ObjectId::parse_str(input.call_id.trim())
        .map_err(|_| ApiError::Validation("callId must be a valid ObjectId".to_owned()))?;
    Ok(VoiceVoicemail {
        id: None,
        user_id,
        call_id,
        from_number: input.from_number.trim().to_owned(),
        to_number: input.to_number,
        audio_file_id: input.audio_file_id,
        duration_secs: input.duration_secs,
        transcript: input.transcript,
        listened_by: vec![],
        status: "new".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateVoicemailInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.transcript {
        set.insert("transcript", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceVoicemail) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceVoicemail>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_voicemails(
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
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["fromNumber", "transcript"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.find")))?;
    let mut rows: Vec<VoiceVoicemail> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vm_id))]
pub async fn get_voicemail(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vm_id): Path<String>,
) -> Result<Json<VoiceVoicemail>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vm_id)?;
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voicemail".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_voicemail(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateVoicemailInput>,
) -> Result<Json<CreateVoicemailResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = vm_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateVoicemailResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vm_id))]
pub async fn update_voicemail(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vm_id): Path<String>,
    Json(patch): Json<UpdateVoicemailInput>,
) -> Result<Json<VoiceVoicemail>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vm_id)?;
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voicemail".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voicemail".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voicemail".to_owned()))?;
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

/// `POST /:id/listen` — atomically append the listener to `listenedBy`
/// (idempotent via `$addToSet`) and flip status to `listened`.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %vm_id))]
pub async fn mark_listened(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vm_id): Path<String>,
    Json(input): Json<ListenInput>,
) -> Result<Json<VoiceVoicemail>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vm_id)?;
    let listener = ObjectId::parse_str(input.listener_id.trim())
        .map_err(|_| ApiError::Validation("listenerId must be a valid ObjectId".to_owned()))?;
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! {
                "$addToSet": { "listenedBy": listener },
                "$set": {
                    "status": "listened",
                    "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                },
            },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.listen")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voicemail".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voicemail".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %vm_id))]
pub async fn delete_voicemail(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(vm_id): Path<String>,
) -> Result<Json<DeleteVoicemailResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&vm_id)?;
    let coll = mongo.collection::<VoiceVoicemail>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("voicemail.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voicemail".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteVoicemailResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vm_from_create_starts_in_new_with_no_listeners() {
        let user_id = ObjectId::new();
        let call_id = ObjectId::new();
        let input = CreateVoicemailInput {
            call_id: call_id.to_hex(),
            from_number: "+14155550100".into(),
            audio_file_id: "sabfile_abc".into(),
            ..Default::default()
        };
        let v = vm_from_create(input, user_id).unwrap();
        assert_eq!(v.status, "new");
        assert!(v.listened_by.is_empty());
        assert_eq!(v.call_id, call_id);
    }
}
