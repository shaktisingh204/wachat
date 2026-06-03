//! HTTP handlers for the Petty Cash Float entity.

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
    CreateFloatInput, CreateFloatResponse, DeleteFloatResponse, ListQuery, UpdateFloatInput,
};
use crate::types::CrmPettyCashFloat;

const COLL: &str = "crm_petty_cash_floats";
const ENTITY_KIND: &str = "petty_cash";

fn list_filter(user_id: ObjectId, status: Option<&str>, branch: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "closed" => {
            filter.insert("status", "closed");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(b) = branch.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("branchName", b);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn float_from_create(input: CreateFloatInput, user_id: ObjectId) -> Result<CrmPettyCashFloat> {
    if input.opening_balance < 0.0 {
        return Err(ApiError::Validation(
            "openingBalance must be non-negative".to_owned(),
        ));
    }
    let custodian_id = input
        .custodian_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    Ok(CrmPettyCashFloat {
        id: None,
        user_id,
        branch_name: input.branch_name,
        custodian_name: input.custodian_name,
        custodian_id,
        opening_balance: input.opening_balance,
        current_balance: input.opening_balance,
        currency: input.currency,
        status: Some("active".to_owned()),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFloatInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.branch_name {
        set.insert("branchName", v);
    }
    if let Some(v) = patch.custodian_name {
        set.insert("custodianName", v);
    }
    if let Some(v) = patch
        .custodian_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("custodianId", v);
    }
    if let Some(v) = patch.opening_balance {
        set.insert("openingBalance", v);
    }
    if let Some(v) = patch.current_balance {
        set.insert("currentBalance", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPettyCashFloat) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPettyCashFloat>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_floats(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.branch_name.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["branchName", "custodianName", "notes"]);
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
    let coll = mongo.collection::<CrmPettyCashFloat>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.find"))
        })?;
    let mut rows: Vec<CrmPettyCashFloat> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %float_id))]
pub async fn get_float(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(float_id): Path<String>,
) -> Result<Json<CrmPettyCashFloat>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&float_id)?;
    let coll = mongo.collection::<CrmPettyCashFloat>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.find_one")))?
        .ok_or_else(|| ApiError::NotFound("petty_cash_float".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_float(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFloatInput>,
) -> Result<Json<CreateFloatResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = float_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPettyCashFloat>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateFloatResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %float_id))]
pub async fn update_float(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(float_id): Path<String>,
    Json(patch): Json<UpdateFloatInput>,
) -> Result<Json<CrmPettyCashFloat>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&float_id)?;
    let coll = mongo.collection::<CrmPettyCashFloat>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.find_one")))?
        .ok_or_else(|| ApiError::NotFound("petty_cash_float".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("petty_cash_float".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.refetch")))?
        .ok_or_else(|| ApiError::NotFound("petty_cash_float".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %float_id))]
pub async fn delete_float(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(float_id): Path<String>,
) -> Result<Json<DeleteFloatResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&float_id)?;
    let coll = mongo.collection::<CrmPettyCashFloat>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_petty_cash.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("petty_cash_float".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteFloatResponse { deleted: true }))
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
    fn float_from_create_seeds_current_balance() {
        let user_id = ObjectId::new();
        let input = CreateFloatInput {
            opening_balance: 5000.0,
            branch_name: Some("HQ".into()),
            ..Default::default()
        };
        let f = float_from_create(input, user_id).unwrap();
        assert_eq!(f.opening_balance, 5000.0);
        assert_eq!(f.current_balance, 5000.0);
        assert_eq!(f.status.as_deref(), Some("active"));
    }

    #[test]
    fn float_from_create_rejects_negative_opening() {
        let user_id = ObjectId::new();
        let input = CreateFloatInput {
            opening_balance: -100.0,
            ..Default::default()
        };
        assert!(float_from_create(input, user_id).is_err());
    }
}
