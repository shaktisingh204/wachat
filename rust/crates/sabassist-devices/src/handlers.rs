//! HTTP handlers for SabAssist registered devices.

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
    CreateDeviceInput, CreateDeviceResponse, DeleteDeviceResponse, ListQuery, UpdateDeviceInput,
};
use crate::types::SabassistDevice;

const COLL: &str = "sabassist_devices";
const ENTITY_KIND: &str = "sabassist_device";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = DateTime::parse_from_rfc3339(s)
        .map_err(|_| ApiError::Validation(format!("'{s}' is not a valid ISO-8601 timestamp")))?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn device_from_create(input: CreateDeviceInput, user_id: ObjectId) -> Result<SabassistDevice> {
    if input.label.trim().is_empty() {
        return Err(ApiError::Validation("label is required".to_owned()));
    }
    if input.device_fingerprint.trim().is_empty() {
        return Err(ApiError::Validation(
            "deviceFingerprint is required".to_owned(),
        ));
    }
    let owner_user_id = match input.owner_user_id.as_deref() {
        Some(s) => ObjectId::parse_str(s)
            .map_err(|_| ApiError::Validation("ownerUserId is not a valid id".to_owned()))?,
        None => user_id,
    };
    let os_info_json = input
        .os_info_json
        .map(|v| {
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.os_info_bson"))
            })
        })
        .transpose()?;
    Ok(SabassistDevice {
        id: None,
        user_id,
        label: input.label.trim().to_owned(),
        owner_user_id,
        device_fingerprint: input.device_fingerprint,
        last_seen_at: None,
        online: false,
        agent_version: input.agent_version,
        os_info_json,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDeviceInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.label {
        set.insert("label", v);
    }
    if let Some(v) = patch.owner_user_id {
        let oid = ObjectId::parse_str(&v)
            .map_err(|_| ApiError::Validation("ownerUserId is not a valid id".to_owned()))?;
        set.insert("ownerUserId", oid);
    }
    if let Some(v) = patch.agent_version {
        set.insert("agentVersion", v);
    }
    if let Some(v) = patch.os_info_json {
        let b = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.os_info_bson"))
        })?;
        set.insert("osInfoJson", b);
    }
    if let Some(v) = patch.online {
        set.insert("online", v);
    }
    if let Some(v) = patch.last_seen_at {
        set.insert("lastSeenAt", parse_iso(&v)?);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SabassistDevice) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabassistDevice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_devices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(o) = q.online {
        filter.insert("online", o);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["label", "deviceFingerprint", "agentVersion"]);
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
    let coll = mongo.collection::<SabassistDevice>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.find"))
        })?;
    let mut rows: Vec<SabassistDevice> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %device_id))]
pub async fn get_device(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(device_id): Path<String>,
) -> Result<Json<SabassistDevice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&device_id)?;
    let coll = mongo.collection::<SabassistDevice>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_device".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_device(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDeviceInput>,
) -> Result<Json<CreateDeviceResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = device_from_create(input, user_id)?;
    let coll = mongo.collection::<SabassistDevice>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateDeviceResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %device_id))]
pub async fn update_device(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(device_id): Path<String>,
    Json(patch): Json<UpdateDeviceInput>,
) -> Result<Json<SabassistDevice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&device_id)?;
    let coll = mongo.collection::<SabassistDevice>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_device".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabassist_device".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_device".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %device_id))]
pub async fn delete_device(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(device_id): Path<String>,
) -> Result<Json<DeleteDeviceResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&device_id)?;
    let coll = mongo.collection::<SabassistDevice>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_devices.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sabassist_device".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDeviceResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_from_create_requires_label_and_fingerprint() {
        let user_id = ObjectId::new();
        let empty = CreateDeviceInput::default();
        assert!(device_from_create(empty, user_id).is_err());
        let ok = CreateDeviceInput {
            label: "Front desk".into(),
            device_fingerprint: "fp-abc".into(),
            ..Default::default()
        };
        let d = device_from_create(ok, user_id).unwrap();
        assert_eq!(d.label, "Front desk");
        assert_eq!(d.owner_user_id, user_id);
        assert!(!d.online);
    }
}
