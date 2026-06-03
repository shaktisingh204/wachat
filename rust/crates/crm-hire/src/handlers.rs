//! HTTP handlers for the Hire Requisition entity.

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
    CreateHireInput, CreateHireResponse, DeleteHireResponse, ListQuery, UpdateHireInput,
};
use crate::types::CrmHire;

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
        "won" => {
            filter.insert("status", "won");
        }
        "lost" => {
            filter.insert("status", "lost");
        }
        "open" => {
            filter.insert("status", "open");
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

fn hire_from_create(input: CreateHireInput, user_id: ObjectId) -> Result<CrmHire> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmHire {
        id: None,
        user_id,
        title: input.title.trim().to_string(),
        category: input.category,
        vendor_candidate: input.vendor_candidate,
        required_by: input.required_by,
        quantity: input.quantity,
        estimated_budget: input.estimated_budget,
        specs: input.specs,
        owner: input.owner,
        stage: Some(input.stage.unwrap_or_else(|| "sourcing".to_owned())),
        status: Some(input.status.unwrap_or_else(|| "open".to_owned())),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateHireInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.title {
        set.insert("title", v.trim());
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.vendor_candidate {
        set.insert("vendorCandidate", v);
    }
    if let Some(v) = patch.required_by {
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

fn doc_for_audit(entity: &CrmHire) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmHire>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_hires(
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
        let or = build_q_filter(needle, &["title", "category", "vendorCandidate", "owner"]);
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

    let coll = mongo.collection::<CrmHire>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.find")))?;
    let mut rows: Vec<CrmHire> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hire_id))]
pub async fn get_hire(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hire_id): Path<String>,
) -> Result<Json<CrmHire>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hire_id)?;
    let coll = mongo.collection::<CrmHire>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.find_one")))?
        .ok_or_else(|| ApiError::NotFound("purchase_lead".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_hire(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateHireInput>,
) -> Result<Json<CreateHireResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = hire_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmHire>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateHireResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hire_id))]
pub async fn update_hire(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hire_id): Path<String>,
    Json(patch): Json<UpdateHireInput>,
) -> Result<Json<CrmHire>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hire_id)?;

    let coll = mongo.collection::<CrmHire>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.find_one")))?
        .ok_or_else(|| ApiError::NotFound("purchase_lead".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase_lead".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.refetch")))?
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %hire_id))]
pub async fn delete_hire(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(hire_id): Path<String>,
) -> Result<Json<DeleteHireResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&hire_id)?;

    let coll = mongo.collection::<CrmHire>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_hire.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("purchase_lead".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteHireResponse { deleted: true }))
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
    fn list_filter_applies_stage_and_category() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"), Some("sourcing"), Some("hardware"));
        assert_eq!(f.get_str("stage").ok(), Some("sourcing"));
        assert_eq!(f.get_str("category").ok(), Some("hardware"));
    }

    #[test]
    fn hire_from_create_stamps_defaults() {
        let user_id = ObjectId::new();
        let input = CreateHireInput {
            title: "Laptop".into(),
            ..Default::default()
        };
        let h = hire_from_create(input, user_id).unwrap();
        assert_eq!(h.stage.as_deref(), Some("sourcing"));
        assert_eq!(h.status.as_deref(), Some("open"));
        assert_eq!(h.title, "Laptop");
    }

    #[test]
    fn hire_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateHireInput {
            title: "   ".into(),
            ..Default::default()
        };
        assert!(hire_from_create(input, user_id).is_err());
    }
}
