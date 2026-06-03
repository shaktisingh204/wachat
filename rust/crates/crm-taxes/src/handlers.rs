//! HTTP handlers for the Tax rate master entity.

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

use crate::dto::{CreateTaxInput, CreateTaxResponse, DeleteTaxResponse, ListQuery, UpdateTaxInput};
use crate::types::CrmTax;

const COLL: &str = "crm_taxes";
const ENTITY_KIND: &str = "tax";

fn list_filter(user_id: ObjectId, status: Option<&str>, tax_type: Option<&str>) -> Document {
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
    if let Some(t) = tax_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("taxType", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn tax_from_create(input: CreateTaxInput, user_id: ObjectId) -> Result<CrmTax> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let rate = input.rate.unwrap_or(0.0);
    if !rate.is_finite() || rate < 0.0 {
        return Err(ApiError::Validation(
            "rate must be a non-negative number".to_owned(),
        ));
    }
    Ok(CrmTax {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        code: input
            .code
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        rate,
        tax_type: input
            .tax_type
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        components: input.components.unwrap_or_default(),
        description: input.description,
        is_default: input.is_default.unwrap_or(false),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTaxInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.rate {
        if !v.is_finite() || v < 0.0 {
            return Err(ApiError::Validation(
                "rate must be a non-negative number".to_owned(),
            ));
        }
        set.insert("rate", v);
    }
    if let Some(v) = patch.tax_type {
        set.insert("taxType", v);
    }
    if let Some(v) = patch.components {
        set.insert("components", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmTax) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTax>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_taxes(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.tax_type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "rate": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmTax>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.find")))?;
    let mut rows: Vec<CrmTax> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tax_id))]
pub async fn get_tax(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tax_id): Path<String>,
) -> Result<Json<CrmTax>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tax_id)?;
    let coll = mongo.collection::<CrmTax>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tax".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_tax(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaxInput>,
) -> Result<Json<CreateTaxResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = tax_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTax>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTaxResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tax_id))]
pub async fn update_tax(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tax_id): Path<String>,
    Json(patch): Json<UpdateTaxInput>,
) -> Result<Json<CrmTax>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tax_id)?;
    let coll = mongo.collection::<CrmTax>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tax".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tax".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.refetch")))?
        .ok_or_else(|| ApiError::NotFound("tax".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %tax_id))]
pub async fn delete_tax(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tax_id): Path<String>,
) -> Result<Json<DeleteTaxResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tax_id)?;
    let coll = mongo.collection::<CrmTax>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_taxes.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tax".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTaxResponse { deleted: true }))
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
    fn tax_from_create_defaults_status_and_is_active() {
        let user_id = ObjectId::new();
        let input = CreateTaxInput {
            name: "GST 18%".into(),
            rate: Some(18.0),
            ..Default::default()
        };
        let t = tax_from_create(input, user_id).unwrap();
        assert_eq!(t.status, "active");
        assert!(t.is_active);
        assert_eq!(t.rate, 18.0);
    }

    #[test]
    fn tax_from_create_rejects_empty_name_and_negative_rate() {
        let user_id = ObjectId::new();
        let empty = CreateTaxInput {
            name: "  ".into(),
            rate: Some(5.0),
            ..Default::default()
        };
        assert!(tax_from_create(empty, user_id).is_err());

        let negative = CreateTaxInput {
            name: "Bad".into(),
            rate: Some(-1.0),
            ..Default::default()
        };
        assert!(tax_from_create(negative, user_id).is_err());
    }
}
