//! HTTP handlers for the Purchase Lead entity.

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
    CreateLeadInput, CreateLeadResponse, DeleteLeadResponse, ListQuery, UpdateLeadInput,
};
use crate::types::CrmPurchaseLead;

const COLL: &str = "crm_purchase_leads";
const ENTITY_KIND: &str = "purchase_lead";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    stage: Option<&str>,
    category: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "open" | "won" | "lost" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = stage.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("stage", s);
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
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

fn lead_from_create(input: CreateLeadInput, user_id: ObjectId) -> Result<CrmPurchaseLead> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmPurchaseLead {
        id: None,
        user_id,
        title: input.title.trim().to_owned(),
        category: input.category,
        vendor_candidate: input.vendor_candidate,
        required_by: input.required_by.as_deref().and_then(parse_date),
        quantity: input.quantity,
        estimated_budget: input.estimated_budget,
        specs: input.specs,
        owner: input.owner,
        stage: "sourcing".to_owned(),
        status: "open".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateLeadInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.vendor_candidate {
        set.insert("vendorCandidate", v);
    }
    if let Some(v) = patch.required_by.as_deref().and_then(parse_date) {
        set.insert("requiredBy", v);
    }
    if let Some(v) = patch.quantity {
        set.insert("quantity", v);
    }
    if let Some(v) = patch.estimated_budget {
        set.insert("estimatedBudget", v);
    }
    if let Some(v) = patch.specs {
        set.insert("specs", v);
    }
    if let Some(v) = patch.owner {
        set.insert("owner", v);
    }
    if let Some(v) = patch.stage {
        set.insert("stage", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPurchaseLead) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPurchaseLead>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_leads(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.stage.as_deref(),
        q.category.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["title", "specs", "vendorCandidate", "category"]);
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
    let coll = mongo.collection::<CrmPurchaseLead>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.find"))
    })?;
    let mut rows: Vec<CrmPurchaseLead> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %lead_id))]
pub async fn get_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
) -> Result<Json<CrmPurchaseLead>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&lead_id)?;
    let coll = mongo.collection::<CrmPurchaseLead>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("purchase_lead".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLeadInput>,
) -> Result<Json<CreateLeadResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = lead_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPurchaseLead>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.insert"))
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
    Ok(Json(CreateLeadResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %lead_id))]
pub async fn update_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
    Json(patch): Json<UpdateLeadInput>,
) -> Result<Json<CrmPurchaseLead>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&lead_id)?;
    let coll = mongo.collection::<CrmPurchaseLead>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("purchase_lead".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase_lead".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("purchase_lead".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %lead_id))]
pub async fn delete_lead(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(lead_id): Path<String>,
) -> Result<Json<DeleteLeadResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&lead_id)?;
    let coll = mongo.collection::<CrmPurchaseLead>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_purchase_leads.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase_lead".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteLeadResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn lead_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateLeadInput {
            title: "10t steel rods".into(),
            ..Default::default()
        };
        let l = lead_from_create(input, user_id).unwrap();
        assert_eq!(l.stage, "sourcing");
        assert_eq!(l.status, "open");
    }

    #[test]
    fn lead_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateLeadInput {
            title: "".into(),
            ..Default::default()
        };
        assert!(lead_from_create(input, user_id).is_err());
    }
}
