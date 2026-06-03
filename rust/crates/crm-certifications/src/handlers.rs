//! HTTP handlers for the Certification entity.

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
    CreateCertificationInput, CreateCertificationResponse, DeleteCertificationResponse, ListQuery,
    UpdateCertificationInput,
};
use crate::types::CrmCertification;

const COLL: &str = "crm_certifications";
const ENTITY_KIND: &str = "certification";

const VALID_STATUSES: [&str; 4] = ["active", "expired", "revoked", "archived"];

fn normalise_status(s: Option<String>) -> String {
    match s.as_deref().map(str::trim) {
        Some(v) if VALID_STATUSES.contains(&v) => v.to_owned(),
        _ => "active".to_owned(),
    }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, employee_id: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "expired" => {
            filter.insert("status", "expired");
        }
        "revoked" => {
            filter.insert("status", "revoked");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(eid) = employee_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("employee_id", eid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn cert_from_create(
    input: CreateCertificationInput,
    user_id: ObjectId,
) -> Result<CrmCertification> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmCertification {
        id: None,
        user_id,
        name: input.name.trim().to_string(),
        issuer: input.issuer,
        employee_id: input.employee_id,
        employee_name: input.employee_name,
        certification_number: input.certification_number,
        issue_date: input.issue_date,
        expiry_date: input.expiry_date,
        certificate_url: input.certificate_url,
        status: normalise_status(input.status),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCertificationInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.issuer {
        set.insert("issuer", v);
    }
    if let Some(v) = patch.employee_id {
        set.insert("employee_id", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employee_name", v);
    }
    if let Some(v) = patch.certification_number {
        set.insert("certification_number", v);
    }
    if let Some(v) = patch.issue_date {
        set.insert("issue_date", v);
    }
    if let Some(v) = patch.expiry_date {
        set.insert("expiry_date", v);
    }
    if let Some(v) = patch.certificate_url {
        set.insert("certificate_url", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", normalise_status(Some(v)));
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmCertification) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCertification>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_certifications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.employee_id.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["name", "issuer", "employee_name", "certification_number"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmCertification>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.find"))
    })?;
    let mut rows: Vec<CrmCertification> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cert_id))]
pub async fn get_certification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cert_id): Path<String>,
) -> Result<Json<CrmCertification>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&cert_id)?;
    let coll = mongo.collection::<CrmCertification>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("certification".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_certification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCertificationInput>,
) -> Result<Json<CreateCertificationResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = cert_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCertification>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.insert"))
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

    Ok(Json(CreateCertificationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cert_id))]
pub async fn update_certification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cert_id): Path<String>,
    Json(patch): Json<UpdateCertificationInput>,
) -> Result<Json<CrmCertification>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&cert_id)?;

    let coll = mongo.collection::<CrmCertification>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("certification".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("certification".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("certification".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %cert_id))]
pub async fn delete_certification(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(cert_id): Path<String>,
) -> Result<Json<DeleteCertificationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&cert_id)?;

    let coll = mongo.collection::<CrmCertification>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_certifications.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("certification".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteCertificationResponse { deleted: true }))
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
    fn list_filter_filters_by_employee() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"), Some("emp-42"));
        assert_eq!(f.get_str("employee_id").ok(), Some("emp-42"));
    }

    #[test]
    fn cert_from_create_defaults_status_active() {
        let user_id = ObjectId::new();
        let input = CreateCertificationInput {
            name: "AWS SAA".into(),
            ..Default::default()
        };
        let c = cert_from_create(input, user_id).unwrap();
        assert_eq!(c.status, "active");
        assert_eq!(c.name, "AWS SAA");
    }

    #[test]
    fn cert_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateCertificationInput {
            name: "  ".into(),
            ..Default::default()
        };
        assert!(cert_from_create(input, user_id).is_err());
    }

    #[test]
    fn normalise_status_rejects_unknown_values() {
        assert_eq!(normalise_status(Some("bogus".into())), "active");
        assert_eq!(normalise_status(Some("revoked".into())), "revoked");
        assert_eq!(normalise_status(None), "active");
    }
}
