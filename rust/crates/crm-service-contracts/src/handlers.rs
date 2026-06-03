//! HTTP handlers for the Service Contract entity.

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
use crate::types::CrmServiceContract;

const COLL: &str = "crm_service_contracts";
const ENTITY_KIND: &str = "service_contract";

fn list_filter(user_id: ObjectId, status: Option<&str>, customer_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "paused" | "expired" | "renewed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = customer_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("customerId", c);
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

fn contract_from_create(
    input: CreateContractInput,
    user_id: ObjectId,
) -> Result<CrmServiceContract> {
    if input.customer_name.trim().is_empty() {
        return Err(ApiError::Validation("customerName is required".to_owned()));
    }
    let contract_no = input
        .contract_no
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            let suffix = Utc::now().timestamp_millis().to_string();
            let tail = suffix.chars().rev().take(6).collect::<String>();
            format!("AMC-{}", tail.chars().rev().collect::<String>())
        });
    Ok(CrmServiceContract {
        id: None,
        user_id,
        contract_no,
        customer_id: input
            .customer_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        customer_name: input.customer_name.trim().to_owned(),
        asset_name: input.asset_name,
        coverage: input.coverage,
        frequency: input.frequency,
        period_start: input.period_start.as_deref().and_then(parse_date),
        period_end: input.period_end.as_deref().and_then(parse_date),
        billing_amount: input.billing_amount.unwrap_or(0.0),
        technician: input.technician,
        notes: input.notes,
        status: Some("active".to_owned()),
        visits: Vec::new(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateContractInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.contract_no {
        set.insert("contractNo", v);
    }
    if let Some(v) = patch
        .customer_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("customerId", v);
    }
    if let Some(v) = patch.customer_name {
        set.insert("customerName", v);
    }
    if let Some(v) = patch.asset_name {
        set.insert("assetName", v);
    }
    if let Some(v) = patch.coverage {
        set.insert("coverage", v);
    }
    if let Some(v) = patch.frequency {
        set.insert("frequency", v);
    }
    if let Some(v) = patch.period_start.as_deref().and_then(parse_date) {
        set.insert("periodStart", v);
    }
    if let Some(v) = patch.period_end.as_deref().and_then(parse_date) {
        set.insert("periodEnd", v);
    }
    if let Some(v) = patch.billing_amount {
        set.insert("billingAmount", v);
    }
    if let Some(v) = patch.technician {
        set.insert("technician", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmServiceContract) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmServiceContract>,
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
    let mut filter = list_filter(user_id, q.status.as_deref(), q.customer_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "contractNo",
                "customerName",
                "assetName",
                "notes",
                "technician",
            ],
        );
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
    let coll = mongo.collection::<CrmServiceContract>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.find"))
    })?;
    let mut rows: Vec<CrmServiceContract> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %contract_id))]
pub async fn get_contract(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(contract_id): Path<String>,
) -> Result<Json<CrmServiceContract>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contract_id)?;
    let coll = mongo.collection::<CrmServiceContract>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("service_contract".to_owned()))?;
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
    let coll = mongo.collection::<CrmServiceContract>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.insert"))
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
) -> Result<Json<CrmServiceContract>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&contract_id)?;
    let coll = mongo.collection::<CrmServiceContract>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("service_contract".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("service_contract".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("service_contract".to_owned()))?;
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
    let coll = mongo.collection::<CrmServiceContract>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_service_contracts.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("service_contract".to_owned()));
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
    fn contract_from_create_seeds_status_active_and_default_no() {
        let user_id = ObjectId::new();
        let input = CreateContractInput {
            customer_name: "Acme".into(),
            billing_amount: Some(5000.0),
            ..Default::default()
        };
        let c = contract_from_create(input, user_id).unwrap();
        assert_eq!(c.status.as_deref(), Some("active"));
        assert!(c.contract_no.starts_with("AMC-"));
        assert_eq!(c.billing_amount, 5000.0);
    }

    #[test]
    fn contract_from_create_rejects_empty_customer() {
        let user_id = ObjectId::new();
        let input = CreateContractInput {
            customer_name: "".into(),
            ..Default::default()
        };
        assert!(contract_from_create(input, user_id).is_err());
    }
}
