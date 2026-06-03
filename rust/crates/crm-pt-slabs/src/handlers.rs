//! HTTP handlers for the Professional Tax Slab entity.

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
    CreatePtSlabInput, CreatePtSlabResponse, DeletePtSlabResponse, ListQuery, UpdatePtSlabInput,
};
use crate::types::CrmPtSlab;

const COLL: &str = "crm_pt_slabs";
const ENTITY_KIND: &str = "pt_slab";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    state: Option<&str>,
    gender: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = state.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("state", s);
    }
    if let Some(g) = gender.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("gender", g);
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

fn normalize_gender(raw: Option<String>) -> Option<String> {
    raw.map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .map(|s| match s.as_str() {
            "male" | "female" | "any" => s,
            _ => "any".to_owned(),
        })
}

fn slab_from_create(input: CreatePtSlabInput, user_id: ObjectId) -> Result<CrmPtSlab> {
    let state = input.state.trim().to_owned();
    if state.is_empty() {
        return Err(ApiError::Validation("state is required".to_owned()));
    }
    if !input.min_amount.is_finite() || input.min_amount < 0.0 {
        return Err(ApiError::Validation("minAmount must be >= 0".to_owned()));
    }
    if let Some(max) = input.max_amount {
        if !max.is_finite() || max < input.min_amount {
            return Err(ApiError::Validation(
                "maxAmount must be >= minAmount".to_owned(),
            ));
        }
    }
    if !input.tax_amount.is_finite() || input.tax_amount < 0.0 {
        return Err(ApiError::Validation("taxAmount must be >= 0".to_owned()));
    }

    Ok(CrmPtSlab {
        id: None,
        user_id,
        state,
        gender: normalize_gender(input.gender),
        min_amount: input.min_amount,
        max_amount: input.max_amount,
        tax_amount: input.tax_amount,
        effective_from: input.effective_from.as_deref().and_then(parse_date),
        notes: input.notes,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePtSlabInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.state {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("state cannot be empty".to_owned()));
        }
        set.insert("state", trimmed);
    }
    if let Some(v) = normalize_gender(patch.gender) {
        set.insert("gender", v);
    }
    if let Some(v) = patch.min_amount {
        if !v.is_finite() || v < 0.0 {
            return Err(ApiError::Validation("minAmount must be >= 0".to_owned()));
        }
        set.insert("minAmount", v);
    }
    if let Some(v) = patch.max_amount {
        if !v.is_finite() || v < 0.0 {
            return Err(ApiError::Validation("maxAmount must be >= 0".to_owned()));
        }
        set.insert("maxAmount", v);
    }
    if let Some(v) = patch.tax_amount {
        if !v.is_finite() || v < 0.0 {
            return Err(ApiError::Validation("taxAmount must be >= 0".to_owned()));
        }
        set.insert("taxAmount", v);
    }
    if let Some(v) = patch.effective_from.as_deref().and_then(parse_date) {
        set.insert("effectiveFrom", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmPtSlab) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPtSlab>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_slabs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.state.as_deref(),
        q.gender.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["state", "notes"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "state": 1, "minAmount": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmPtSlab>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.find")))?;
    let mut rows: Vec<CrmPtSlab> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %slab_id))]
pub async fn get_slab(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slab_id): Path<String>,
) -> Result<Json<CrmPtSlab>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&slab_id)?;
    let coll = mongo.collection::<CrmPtSlab>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pt_slab".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_slab(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePtSlabInput>,
) -> Result<Json<CreatePtSlabResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = slab_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPtSlab>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreatePtSlabResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %slab_id))]
pub async fn update_slab(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slab_id): Path<String>,
    Json(patch): Json<UpdatePtSlabInput>,
) -> Result<Json<CrmPtSlab>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&slab_id)?;
    let coll = mongo.collection::<CrmPtSlab>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pt_slab".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pt_slab".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("pt_slab".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %slab_id))]
pub async fn delete_slab(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slab_id): Path<String>,
) -> Result<Json<DeletePtSlabResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&slab_id)?;
    let coll = mongo.collection::<CrmPtSlab>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_pt_slabs.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pt_slab".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePtSlabResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        assert!(!f.contains_key("state"));
        assert!(!f.contains_key("gender"));
    }

    #[test]
    fn slab_from_create_defaults_status_and_normalizes_gender() {
        let user_id = ObjectId::new();
        let input = CreatePtSlabInput {
            state: "Maharashtra".into(),
            gender: Some("Male".into()),
            min_amount: 0.0,
            max_amount: Some(7500.0),
            tax_amount: 0.0,
            ..Default::default()
        };
        let s = slab_from_create(input, user_id).unwrap();
        assert_eq!(s.status, "active");
        assert_eq!(s.gender.as_deref(), Some("male"));
        assert_eq!(s.state, "Maharashtra");
    }

    #[test]
    fn slab_from_create_rejects_empty_state_and_negative_min() {
        let user_id = ObjectId::new();
        let bad_state = CreatePtSlabInput {
            state: "   ".into(),
            min_amount: 0.0,
            tax_amount: 0.0,
            ..Default::default()
        };
        assert!(slab_from_create(bad_state, user_id).is_err());

        let bad_min = CreatePtSlabInput {
            state: "Karnataka".into(),
            min_amount: -10.0,
            tax_amount: 0.0,
            ..Default::default()
        };
        assert!(slab_from_create(bad_min, user_id).is_err());
    }
}
