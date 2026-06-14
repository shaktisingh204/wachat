//! HTTP handlers for the Voice SIP trunk entity.

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
    CreateTrunkInput, CreateTrunkResponse, DeleteTrunkResponse, ListQuery, UpdateTrunkInput,
};
use crate::types::SipTrunk;

const COLL: &str = "sabcall_trunks";
const ENTITY_KIND: &str = "voice_trunk";
const VALID_STATUSES: &[&str] = &["active", "disabled"];
const VALID_PROVIDERS: &[&str] = &[
    "custom",
    "twilio",
    "telnyx",
    "plivo",
    "bandwidth",
    "vonage",
];
const VALID_TRANSPORTS: &[&str] = &["udp", "tcp", "tls"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, provider: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = status.map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(p) = provider.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("provider", p);
    }
    filter
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUSES.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUSES:?}"
        )))
    }
}

fn validate_provider(p: &str) -> Result<()> {
    if VALID_PROVIDERS.contains(&p) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "provider must be one of {VALID_PROVIDERS:?}"
        )))
    }
}

fn validate_transport(t: &str) -> Result<()> {
    if VALID_TRANSPORTS.contains(&t) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "transport must be one of {VALID_TRANSPORTS:?}"
        )))
    }
}

fn trunk_from_create(input: CreateTrunkInput, user_id: ObjectId) -> Result<SipTrunk> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.sip_server.trim().is_empty() {
        return Err(ApiError::Validation("sipServer is required".to_owned()));
    }
    let provider = input.provider.unwrap_or_else(|| "custom".to_owned());
    validate_provider(provider.trim())?;
    let transport = input.transport.unwrap_or_else(|| "udp".to_owned());
    validate_transport(transport.trim())?;
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(SipTrunk {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        provider: provider.trim().to_owned(),
        sip_server: input.sip_server.trim().to_owned(),
        port: Some(input.port.unwrap_or(5060)),
        transport: transport.trim().to_owned(),
        auth_username: input
            .auth_username
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        auth_password_ref: input
            .auth_password_ref
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        from_domain: input
            .from_domain
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        from_user: input
            .from_user
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        register: input.register.unwrap_or(false),
        inbound_enabled: input.inbound_enabled.unwrap_or(true),
        outbound_enabled: input.outbound_enabled.unwrap_or(true),
        codecs: input.codecs.unwrap_or_else(|| {
            vec!["opus".to_owned(), "ulaw".to_owned(), "alaw".to_owned()]
        }),
        max_channels: input.max_channels,
        status,
        notes: input
            .notes
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTrunkInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim().to_owned());
    }
    if let Some(v) = patch.provider {
        validate_provider(v.trim())?;
        set.insert("provider", v.trim().to_owned());
    }
    if let Some(v) = patch.sip_server {
        set.insert("sipServer", v.trim().to_owned());
    }
    if let Some(v) = patch.port {
        set.insert("port", v);
    }
    if let Some(v) = patch.transport {
        validate_transport(v.trim())?;
        set.insert("transport", v.trim().to_owned());
    }
    if let Some(v) = patch.auth_username {
        set.insert("authUsername", v);
    }
    if let Some(v) = patch.auth_password_ref {
        set.insert("authPasswordRef", v);
    }
    if let Some(v) = patch.from_domain {
        set.insert("fromDomain", v);
    }
    if let Some(v) = patch.from_user {
        set.insert("fromUser", v);
    }
    if let Some(v) = patch.register {
        set.insert("register", v);
    }
    if let Some(v) = patch.inbound_enabled {
        set.insert("inboundEnabled", v);
    }
    if let Some(v) = patch.outbound_enabled {
        set.insert("outboundEnabled", v);
    }
    if let Some(v) = patch.codecs {
        set.insert("codecs", v);
    }
    if let Some(v) = patch.max_channels {
        set.insert("maxChannels", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SipTrunk) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SipTrunk>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_trunks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.provider.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "sipServer", "fromDomain"]);
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
    let coll = mongo.collection::<SipTrunk>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.find")))?;
    let mut rows: Vec<SipTrunk> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %trunk_id))]
pub async fn get_trunk(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(trunk_id): Path<String>,
) -> Result<Json<SipTrunk>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&trunk_id)?;
    let coll = mongo.collection::<SipTrunk>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_trunk".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_trunk(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTrunkInput>,
) -> Result<Json<CreateTrunkResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = trunk_from_create(input, user_id)?;
    let coll = mongo.collection::<SipTrunk>(COLL);

    let existing = coll
        .find_one(doc! { "userId": user_id, "name": &entity.name })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.find_dup"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "a trunk with this name already exists".to_owned(),
        ));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTrunkResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %trunk_id))]
pub async fn update_trunk(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(trunk_id): Path<String>,
    Json(patch): Json<UpdateTrunkInput>,
) -> Result<Json<SipTrunk>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&trunk_id)?;
    let coll = mongo.collection::<SipTrunk>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_trunk".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_trunk".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_trunk".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %trunk_id))]
pub async fn delete_trunk(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(trunk_id): Path<String>,
) -> Result<Json<DeleteTrunkResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&trunk_id)?;
    let coll = mongo.collection::<SipTrunk>(COLL);
    // Soft-disable: flip status to "disabled" rather than dropping the doc
    // so that historical CDRs can still reference the trunk.
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "disabled",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_trunks.disable"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_trunk".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTrunkResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trunk_from_create_defaults_and_validates() {
        let user_id = ObjectId::new();
        let input = CreateTrunkInput {
            name: "Carrier A".into(),
            sip_server: "sip.carrier.com".into(),
            ..Default::default()
        };
        let t = trunk_from_create(input, user_id).unwrap();
        assert_eq!(t.provider, "custom");
        assert_eq!(t.transport, "udp");
        assert_eq!(t.status, "active");
        assert_eq!(t.port, Some(5060));
        assert!(t.inbound_enabled);
        assert!(t.outbound_enabled);
        assert!(!t.register);
        assert_eq!(
            t.codecs,
            vec!["opus".to_owned(), "ulaw".to_owned(), "alaw".to_owned()]
        );
    }

    #[test]
    fn trunk_from_create_rejects_bad_provider() {
        let user_id = ObjectId::new();
        let input = CreateTrunkInput {
            name: "Carrier A".into(),
            sip_server: "sip.carrier.com".into(),
            provider: Some("bogus".into()),
            ..Default::default()
        };
        assert!(trunk_from_create(input, user_id).is_err());
    }
}
