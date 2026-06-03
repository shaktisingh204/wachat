//! HTTP handlers for the Disciplinary Case entity.

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
    CreateCaseInput, CreateCaseResponse, DeleteCaseResponse, ListQuery, UpdateCaseInput,
};
use crate::types::CrmDisciplinaryCase;

const COLL: &str = "crm_disciplinary_cases";
const ENTITY_KIND: &str = "disciplinary_case";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    severity: Option<&str>,
    case_type: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "open" | "investigating" | "resolved" | "closed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = severity.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("severity", s);
    }
    if let Some(t) = case_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("caseType", t);
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

fn case_from_create(input: CreateCaseInput, user_id: ObjectId) -> Result<CrmDisciplinaryCase> {
    if input.employee_name.trim().is_empty() {
        return Err(ApiError::Validation("employeeName is required".to_owned()));
    }
    Ok(CrmDisciplinaryCase {
        id: None,
        user_id,
        employee_name: input.employee_name.trim().to_owned(),
        employee_id: input
            .employee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        case_type: input.case_type.unwrap_or_else(|| "misconduct".to_owned()),
        severity: input.severity.unwrap_or_else(|| "minor".to_owned()),
        raised_by: input.raised_by,
        incident_date: input.incident_date.as_deref().and_then(parse_date),
        description: input.description,
        notes: input.notes,
        evidence: Vec::new(),
        hearings: Vec::new(),
        status: "open".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCaseInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch
        .employee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.case_type {
        set.insert("caseType", v);
    }
    if let Some(v) = patch.severity {
        set.insert("severity", v);
    }
    if let Some(v) = patch.raised_by {
        set.insert("raisedBy", v);
    }
    if let Some(v) = patch.incident_date.as_deref().and_then(parse_date) {
        set.insert("incidentDate", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.evidence {
        set.insert("evidence", v);
    }
    if let Some(v) = patch.hearings {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|h| bson::to_document(&h).ok())
            .collect();
        set.insert("hearings", arr);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmDisciplinaryCase) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmDisciplinaryCase>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_cases(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.severity.as_deref(),
        q.case_type.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["employeeName", "description", "notes", "raisedBy"],
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
    let coll = mongo.collection::<CrmDisciplinaryCase>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.find"))
    })?;
    let mut rows: Vec<CrmDisciplinaryCase> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %case_id))]
pub async fn get_case(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(case_id): Path<String>,
) -> Result<Json<CrmDisciplinaryCase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&case_id)?;
    let coll = mongo.collection::<CrmDisciplinaryCase>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("disciplinary_case".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_case(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCaseInput>,
) -> Result<Json<CreateCaseResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = case_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmDisciplinaryCase>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.insert"))
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
    Ok(Json(CreateCaseResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %case_id))]
pub async fn update_case(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(case_id): Path<String>,
    Json(patch): Json<UpdateCaseInput>,
) -> Result<Json<CrmDisciplinaryCase>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&case_id)?;
    let coll = mongo.collection::<CrmDisciplinaryCase>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("disciplinary_case".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("disciplinary_case".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("disciplinary_case".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %case_id))]
pub async fn delete_case(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(case_id): Path<String>,
) -> Result<Json<DeleteCaseResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&case_id)?;
    let coll = mongo.collection::<CrmDisciplinaryCase>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_disciplinary_cases.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("disciplinary_case".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCaseResponse { deleted: true }))
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
    fn case_from_create_defaults_case_type_severity_status() {
        let user_id = ObjectId::new();
        let input = CreateCaseInput {
            employee_name: "Jane".into(),
            ..Default::default()
        };
        let c = case_from_create(input, user_id).unwrap();
        assert_eq!(c.case_type, "misconduct");
        assert_eq!(c.severity, "minor");
        assert_eq!(c.status, "open");
    }

    #[test]
    fn case_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateCaseInput {
            employee_name: "".into(),
            ..Default::default()
        };
        assert!(case_from_create(input, user_id).is_err());
    }
}
