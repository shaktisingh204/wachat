//! HTTP handlers for the Salary Structure entity.

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
    CreateStructureInput, CreateStructureResponse, DeleteStructureResponse, ListQuery,
    UpdateStructureInput,
};
use crate::types::CrmSalaryStructure;

const COLL: &str = "crm_salary_structures";
const ENTITY_KIND: &str = "salary_structure";

fn list_filter(user_id: ObjectId, status: Option<&str>, employee_id: Option<&str>) -> Document {
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
    if let Some(emp) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", emp);
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

fn structure_from_create(
    input: CreateStructureInput,
    user_id: ObjectId,
) -> Result<CrmSalaryStructure> {
    let employee_id = ObjectId::parse_str(input.employee_id.trim())
        .map_err(|_| ApiError::Validation("employeeId must be a valid ObjectId".to_owned()))?;
    if !(input.basic > 0.0) {
        return Err(ApiError::Validation(
            "basic must be greater than 0".to_owned(),
        ));
    }
    Ok(CrmSalaryStructure {
        id: None,
        user_id,
        employee_id,
        employee_name: input
            .employee_name
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        effective_from: input.effective_from.as_deref().and_then(parse_date),
        basic: input.basic,
        hra: input.hra,
        da: input.da,
        other_allowances: input.other_allowances,
        pf_employer: input.pf_employer,
        pf_employee: input.pf_employee,
        esi: input.esi,
        professional_tax: input.professional_tax,
        gross: input.gross,
        net: input.net,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateStructureInput) -> Result<Document> {
    if let Some(b) = patch.basic {
        if !(b > 0.0) {
            return Err(ApiError::Validation(
                "basic must be greater than 0".to_owned(),
            ));
        }
    }
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .employee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.effective_from.as_deref().and_then(parse_date) {
        set.insert("effectiveFrom", v);
    }
    if let Some(v) = patch.basic {
        set.insert("basic", v);
    }
    if let Some(v) = patch.hra {
        set.insert("hra", v);
    }
    if let Some(v) = patch.da {
        set.insert("da", v);
    }
    if let Some(v) = patch.other_allowances {
        set.insert("otherAllowances", v);
    }
    if let Some(v) = patch.pf_employer {
        set.insert("pfEmployer", v);
    }
    if let Some(v) = patch.pf_employee {
        set.insert("pfEmployee", v);
    }
    if let Some(v) = patch.esi {
        set.insert("esi", v);
    }
    if let Some(v) = patch.professional_tax {
        set.insert("professionalTax", v);
    }
    if let Some(v) = patch.gross {
        set.insert("gross", v);
    }
    if let Some(v) = patch.net {
        set.insert("net", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmSalaryStructure) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSalaryStructure>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_structures(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.employee_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName"]);
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
    let coll = mongo.collection::<CrmSalaryStructure>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.find"))
    })?;
    let mut rows: Vec<CrmSalaryStructure> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn get_structure(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
) -> Result<Json<CrmSalaryStructure>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<CrmSalaryStructure>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("salary_structure".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_structure(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateStructureInput>,
) -> Result<Json<CreateStructureResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = structure_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSalaryStructure>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.insert"))
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
    Ok(Json(CreateStructureResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn update_structure(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
    Json(patch): Json<UpdateStructureInput>,
) -> Result<Json<CrmSalaryStructure>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<CrmSalaryStructure>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("salary_structure".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("salary_structure".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("salary_structure".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %structure_id))]
pub async fn delete_structure(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(structure_id): Path<String>,
) -> Result<Json<DeleteStructureResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&structure_id)?;
    let coll = mongo.collection::<CrmSalaryStructure>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_salary_structures.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("salary_structure".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteStructureResponse { deleted: true }))
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
    fn structure_from_create_defaults_status_active() {
        let user_id = ObjectId::new();
        let employee_id = ObjectId::new().to_hex();
        let input = CreateStructureInput {
            employee_id,
            basic: 50_000.0,
            ..Default::default()
        };
        let s = structure_from_create(input, user_id).unwrap();
        assert_eq!(s.status, "active");
        assert!((s.basic - 50_000.0).abs() < f64::EPSILON);
    }

    #[test]
    fn structure_from_create_rejects_non_positive_basic() {
        let user_id = ObjectId::new();
        let employee_id = ObjectId::new().to_hex();
        let input = CreateStructureInput {
            employee_id: employee_id.clone(),
            basic: 0.0,
            ..Default::default()
        };
        assert!(structure_from_create(input, user_id).is_err());

        let negative = CreateStructureInput {
            employee_id,
            basic: -10.0,
            ..Default::default()
        };
        assert!(structure_from_create(negative, user_id).is_err());
    }
}
