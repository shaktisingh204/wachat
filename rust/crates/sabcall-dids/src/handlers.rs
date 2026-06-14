//! HTTP handlers for the Voice DID entity.

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
    AvailableNumber, CreateDidInput, CreateDidResponse, DeleteDidResponse, ListQuery, SearchQuery,
    SearchResponse, UpdateDidInput,
};
use crate::types::VoiceDid;

const COLL: &str = "sabcall_dids";
const ENTITY_KIND: &str = "voice_did";
const VALID_STATUSES: &[&str] = &["active", "pending", "released"];
const VALID_PROVIDERS: &[&str] = &["twilio", "plivo", "mock"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    country: Option<&str>,
    provider: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = status.map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(c) = country.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("country", c.to_lowercase());
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

fn did_from_create(input: CreateDidInput, user_id: ObjectId) -> Result<VoiceDid> {
    if input.number.trim().is_empty() {
        return Err(ApiError::Validation("number is required".to_owned()));
    }
    if input.country.trim().is_empty() {
        return Err(ApiError::Validation("country is required".to_owned()));
    }
    validate_provider(input.provider.trim())?;
    let status = input.status.unwrap_or_else(|| "pending".to_owned());
    validate_status(&status)?;
    Ok(VoiceDid {
        id: None,
        user_id,
        number: input.number.trim().to_owned(),
        country: input.country.trim().to_lowercase(),
        capabilities: input
            .capabilities
            .unwrap_or_else(|| vec!["voice".to_owned()]),
        status,
        label: input
            .label
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        provider: input.provider.trim().to_owned(),
        provider_ref: input.provider_ref,
        monthly_cost: input.monthly_cost,
        currency: input.currency,
        route_to_ivr_id: input
            .route_to_ivr_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        route_to_queue_id: input
            .route_to_queue_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        route_to_user_id: input
            .route_to_user_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDidInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.label {
        set.insert("label", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.capabilities {
        set.insert("capabilities", v);
    }
    if let Some(v) = patch.monthly_cost {
        set.insert("monthlyCost", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch
        .route_to_ivr_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("routeToIvrId", v);
    }
    if let Some(v) = patch
        .route_to_queue_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("routeToQueueId", v);
    }
    if let Some(v) = patch
        .route_to_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("routeToUserId", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceDid) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceDid>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_dids(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.country.as_deref(),
        q.provider.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["number", "label", "providerRef"]);
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
    let coll = mongo.collection::<VoiceDid>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.find")))?;
    let mut rows: Vec<VoiceDid> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %did_id))]
pub async fn get_did(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(did_id): Path<String>,
) -> Result<Json<VoiceDid>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&did_id)?;
    let coll = mongo.collection::<VoiceDid>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_did".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_did(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDidInput>,
) -> Result<Json<CreateDidResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = did_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceDid>(COLL);

    let existing = coll
        .find_one(doc! { "userId": user_id, "number": &entity.number })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.find_dup")))?;
    if existing.is_some() {
        return Err(ApiError::Validation(
            "a DID with this number is already provisioned".to_owned(),
        ));
    }

    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateDidResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %did_id))]
pub async fn update_did(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(did_id): Path<String>,
    Json(patch): Json<UpdateDidInput>,
) -> Result<Json<VoiceDid>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&did_id)?;
    let coll = mongo.collection::<VoiceDid>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_did".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_did".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voice_did".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %did_id))]
pub async fn delete_did(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(did_id): Path<String>,
) -> Result<Json<DeleteDidResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&did_id)?;
    let coll = mongo.collection::<VoiceDid>(COLL);
    // Soft-release: flip status to "released" rather than dropping the doc
    // so that historical CDRs can still reference the number.
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "released",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcall_dids.release")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_did".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDidResponse { deleted: true }))
}

/// Mock-only DID search. Generates synthetic available numbers for the
/// provided country/area-code. Real Twilio/Plivo integration is deferred.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn search_available(
    user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let _ = user_oid(&user)?;
    if q.country.trim().is_empty() {
        return Err(ApiError::Validation("country is required".to_owned()));
    }
    let limit = q.limit.unwrap_or(10).min(50);
    let area = q.area_code.as_deref().unwrap_or("415");
    let country_iso = q.country.trim().to_lowercase();
    let prefix = if country_iso == "us" || country_iso == "ca" {
        format!("+1{area}")
    } else if country_iso == "in" {
        format!("+91{area}")
    } else if country_iso == "gb" {
        format!("+44{area}")
    } else {
        format!("+{area}")
    };
    let items = (0..limit)
        .map(|i| AvailableNumber {
            number: format!("{prefix}{:04}", 1000 + i),
            country: country_iso.clone(),
            capabilities: vec!["voice".to_owned(), "sms".to_owned()],
            monthly_cost: 1.15,
            currency: "USD".to_owned(),
            provider: "mock".to_owned(),
        })
        .collect();
    Ok(Json(SearchResponse { items }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn did_from_create_defaults_status_and_lowercases_country() {
        let user_id = ObjectId::new();
        let input = CreateDidInput {
            number: "+14155550100".into(),
            country: "US".into(),
            provider: "mock".into(),
            ..Default::default()
        };
        let d = did_from_create(input, user_id).unwrap();
        assert_eq!(d.status, "pending");
        assert_eq!(d.country, "us");
        assert_eq!(d.capabilities, vec!["voice".to_owned()]);
    }

    #[test]
    fn did_from_create_rejects_bad_provider() {
        let user_id = ObjectId::new();
        let input = CreateDidInput {
            number: "+14155550100".into(),
            country: "US".into(),
            provider: "bogus".into(),
            ..Default::default()
        };
        assert!(did_from_create(input, user_id).is_err());
    }
}
