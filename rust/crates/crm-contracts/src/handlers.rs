//! HTTP handlers for the Contract entity.

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
    CreateContractInput, CreateContractResponse, DeleteContractResponse, ListQuery,
    UpdateContractInput,
};
use crate::types::CrmContract;

const COLL: &str = "crm_contracts";
const ENTITY_KIND: &str = "contract";

fn list_filter(user_id: ObjectId, status: Option<&str>, r#type: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "active" | "expired" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = r#type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn contract_from_create(input: CreateContractInput, user_id: ObjectId) -> Result<CrmContract> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.party_name.trim().is_empty() {
        return Err(ApiError::Validation("partyName is required".to_owned()));
    }
    let contract_no = input
        .contract_no
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            let suffix = Utc::now().timestamp_millis().to_string();
            let tail = suffix.chars().rev().take(5).collect::<String>();
            format!("CTR-{}", tail.chars().rev().collect::<String>())
        });
    Ok(CrmContract {
        id: None,
        user_id,
        contract_no,
        title: input.title.trim().to_owned(),
        party_name: input.party_name.trim().to_owned(),
        r#type: Some(input.r#type.unwrap_or_else(|| "nda".to_owned())),
        party_email: input.party_email,
        party_phone: input.party_phone,
        signatory_name: input.signatory_name,
        signatory_email: input.signatory_email,
        scope: input.scope,
        deliverables: input.deliverables,
        currency: Some(input.currency.unwrap_or_else(|| "INR".to_owned())),
        branch: input.branch,
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        source_proposal_id: input
            .source_proposal_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        source_proposal_number: input.source_proposal_number,
        effective_date: input.effective_date.as_deref().and_then(parse_date),
        expiry_date: input.expiry_date.as_deref().and_then(parse_date),
        auto_renew: input.auto_renew.unwrap_or(false),
        renewal_notice_days: input.renewal_notice_days,
        value: input.value,
        esign_provider: Some(input.esign_provider.unwrap_or_else(|| "none".to_owned())),
        notes: input.notes,
        attachments: input.attachments,
        status: "draft".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateContractInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.party_name {
        set.insert("partyName", v);
    }
    if let Some(v) = patch.r#type {
        set.insert("type", v);
    }
    if let Some(v) = patch.party_email {
        set.insert("partyEmail", v);
    }
    if let Some(v) = patch.party_phone {
        set.insert("partyPhone", v);
    }
    if let Some(v) = patch.signatory_name {
        set.insert("signatoryName", v);
    }
    if let Some(v) = patch.signatory_email {
        set.insert("signatoryEmail", v);
    }
    if let Some(v) = patch.scope {
        set.insert("scope", v);
    }
    if let Some(v) = patch.deliverables {
        set.insert("deliverables", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.branch {
        set.insert("branch", v);
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.effective_date.as_deref().and_then(parse_date) {
        set.insert("effectiveDate", v);
    }
    if let Some(v) = patch.expiry_date.as_deref().and_then(parse_date) {
        set.insert("expiryDate", v);
    }
    if let Some(v) = patch.auto_renew {
        set.insert("autoRenew", v);
    }
    if let Some(v) = patch.renewal_notice_days {
        set.insert("renewalNoticeDays", v);
    }
    if let Some(v) = patch.value {
        set.insert("value", v);
    }
    if let Some(v) = patch.esign_provider {
        set.insert("esignProvider", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.attachments {
        set.insert("attachments", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmContract) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmContract>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_contracts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.r#type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["contractNo", "title", "partyName", "notes"]);
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
    let coll = mongo.collection::<CrmContract>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.find")))?;
    let mut rows: Vec<CrmContract> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %contract_id))]
pub async fn get_contract(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contract_id): Path<String>,
) -> Result<Json<CrmContract>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contract_id)?;
    let coll = mongo.collection::<CrmContract>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("contract".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_contract(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateContractInput>,
) -> Result<Json<CreateContractResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = contract_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmContract>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateContractResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %contract_id))]
pub async fn update_contract(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contract_id): Path<String>,
    Json(patch): Json<UpdateContractInput>,
) -> Result<Json<CrmContract>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contract_id)?;
    let coll = mongo.collection::<CrmContract>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("contract".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("contract".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("contract".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %contract_id))]
pub async fn delete_contract(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contract_id): Path<String>,
) -> Result<Json<DeleteContractResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contract_id)?;
    let coll = mongo.collection::<CrmContract>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_contracts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("contract".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteContractResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn contract_from_create_defaults_and_no_generation() {
        let user_id = ObjectId::new();
        let input = CreateContractInput {
            title: "MSA - Acme".into(),
            party_name: "Acme Corp".into(),
            ..Default::default()
        };
        let c = contract_from_create(input, user_id).unwrap();
        assert_eq!(c.status, "draft");
        assert_eq!(c.currency.as_deref(), Some("INR"));
        assert_eq!(c.r#type.as_deref(), Some("nda"));
        assert!(c.contract_no.starts_with("CTR-"));
    }

    #[test]
    fn contract_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateContractInput {
            title: "".into(),
            party_name: "Acme".into(),
            ..Default::default()
        };
        assert!(contract_from_create(input, user_id).is_err());
    }
}
