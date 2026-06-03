//! HTTP handlers for the Form 16 entity.

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
    CreateForm16Input, CreateForm16Response, DeleteForm16Response, ListQuery, UpdateForm16Input,
};
use crate::types::CrmForm16;

const COLL: &str = "crm_form_16";
const ENTITY_KIND: &str = "form_16";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "generated" => {
            filter.insert("status", "generated");
        }
        "issued" => {
            filter.insert("status", "issued");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn normalize_upper(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty())
}

fn entity_from_create(input: CreateForm16Input, user_id: ObjectId) -> Result<CrmForm16> {
    if input.employee_name.trim().is_empty() {
        return Err(ApiError::Validation("employeeName is required".to_owned()));
    }
    if input.financial_year.trim().is_empty() {
        return Err(ApiError::Validation("financialYear is required".to_owned()));
    }
    let status = input.status.unwrap_or_else(|| "draft".to_owned());
    let now = Utc::now();
    let stamps_generation = matches!(status.as_str(), "generated" | "issued");
    Ok(CrmForm16 {
        id: None,
        user_id,
        employee_id: input.employee_id,
        employee_name: input.employee_name.trim().to_string(),
        financial_year: input.financial_year.trim().to_string(),
        pan: normalize_upper(input.pan),
        tan_of_employer: normalize_upper(input.tan_of_employer),
        total_income: input.total_income.unwrap_or(0.0),
        tax_deducted: input.tax_deducted.unwrap_or(0.0),
        document_url: input.document_url,
        generated_at: if stamps_generation {
            Some(BsonDateTime::from_chrono(now))
        } else {
            None
        },
        generated_by: if stamps_generation {
            Some(user_id.to_hex())
        } else {
            None
        },
        status: Some(status),
        created_at: BsonDateTime::from_chrono(now),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateForm16Input) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v.trim());
    }
    if let Some(v) = patch.financial_year {
        set.insert("financialYear", v.trim());
    }
    if let Some(v) = normalize_upper(patch.pan) {
        set.insert("pan", v);
    }
    if let Some(v) = normalize_upper(patch.tan_of_employer) {
        set.insert("tanOfEmployer", v);
    }
    if let Some(v) = patch.total_income {
        set.insert("totalIncome", v);
    }
    if let Some(v) = patch.tax_deducted {
        set.insert("taxDeducted", v);
    }
    if let Some(v) = patch.document_url {
        set.insert("documentUrl", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmForm16) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmForm16>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_form_16s(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(fy) = q
        .financial_year
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("financialYear", fy);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["employeeName", "pan", "tanOfEmployer", "financialYear"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "generatedAt": -1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmForm16>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.find")))?;
    let mut rows: Vec<CrmForm16> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn get_form_16(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<CrmForm16>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;
    let coll = mongo.collection::<CrmForm16>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form_16".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_form_16(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateForm16Input>,
) -> Result<Json<CreateForm16Response>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmForm16>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateForm16Response {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn update_form_16(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
    Json(patch): Json<UpdateForm16Input>,
) -> Result<Json<CrmForm16>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;

    let coll = mongo.collection::<CrmForm16>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.find_one")))?
        .ok_or_else(|| ApiError::NotFound("form_16".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_16".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.refetch")))?
        .ok_or_else(|| ApiError::NotFound("form_16".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %form_id))]
pub async fn delete_form_16(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(form_id): Path<String>,
) -> Result<Json<DeleteForm16Response>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&form_id)?;

    let coll = mongo.collection::<CrmForm16>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_form_16.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_16".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteForm16Response { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn entity_from_create_defaults_to_draft() {
        let user_id = ObjectId::new();
        let input = CreateForm16Input {
            employee_name: "Aakash".into(),
            financial_year: "2025-26".into(),
            ..Default::default()
        };
        let f = entity_from_create(input, user_id).unwrap();
        assert_eq!(f.status.as_deref(), Some("draft"));
        assert!(f.generated_at.is_none());
    }

    #[test]
    fn entity_from_create_stamps_generated_when_issued() {
        let user_id = ObjectId::new();
        let input = CreateForm16Input {
            employee_name: "Aakash".into(),
            financial_year: "2025-26".into(),
            status: Some("issued".into()),
            ..Default::default()
        };
        let f = entity_from_create(input, user_id).unwrap();
        assert!(f.generated_at.is_some());
        assert!(f.generated_by.is_some());
    }

    #[test]
    fn entity_from_create_uppercases_pan_and_tan() {
        let user_id = ObjectId::new();
        let input = CreateForm16Input {
            employee_name: "x".into(),
            financial_year: "2025-26".into(),
            pan: Some("abcde1234f".into()),
            tan_of_employer: Some(" delh01234e ".into()),
            ..Default::default()
        };
        let f = entity_from_create(input, user_id).unwrap();
        assert_eq!(f.pan.as_deref(), Some("ABCDE1234F"));
        assert_eq!(f.tan_of_employer.as_deref(), Some("DELH01234E"));
    }

    #[test]
    fn entity_from_create_rejects_missing_required_fields() {
        let user_id = ObjectId::new();
        let bad_name = CreateForm16Input {
            employee_name: " ".into(),
            financial_year: "2025-26".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_name, user_id).is_err());

        let bad_fy = CreateForm16Input {
            employee_name: "x".into(),
            financial_year: " ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(bad_fy, user_id).is_err());
    }
}
