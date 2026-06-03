//! HTTP handlers for the Document entity.

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
    CreateDocumentInput, CreateDocumentResponse, DeleteDocumentResponse, ListQuery,
    UpdateDocumentInput,
};
use crate::types::CrmDocument;

const COLL: &str = "crm_documents";
const ENTITY_KIND: &str = "document";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    employee_id: Option<&str>,
    entity_kind: Option<&str>,
    entity_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "pending" | "verified" | "expired" | "rejected" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(eid) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", eid);
    }
    if let Some(ek) = entity_kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("entityKind", ek);
    }
    if let Some(eid) = entity_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("entityId", eid);
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

fn document_from_create(input: CreateDocumentInput, user_id: ObjectId) -> Result<CrmDocument> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmDocument {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        category: input.category,
        file_url: input.file_url,
        file_size: input.file_size,
        mime_type: input.mime_type,
        employee_id: input
            .employee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        employee_name: input.employee_name,
        candidate_id: input
            .candidate_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        entity_kind: input.entity_kind,
        entity_id: input
            .entity_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        issue_date: input.issue_date.as_deref().and_then(parse_date),
        expiry_date: input.expiry_date.as_deref().and_then(parse_date),
        document_number: input.document_number,
        tags: input.tags.unwrap_or_default(),
        notes: input.notes,
        is_confidential: input.is_confidential.unwrap_or(false),
        uploaded_by: Some(user_id),
        verified_by: None,
        verified_at: None,
        status: "pending".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDocumentInput, user_id: ObjectId) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.file_url {
        set.insert("fileUrl", v);
    }
    if let Some(v) = patch.file_size {
        set.insert("fileSize", v);
    }
    if let Some(v) = patch.mime_type {
        set.insert("mimeType", v);
    }
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
    if let Some(v) = patch
        .candidate_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("candidateId", v);
    }
    if let Some(v) = patch.entity_kind {
        set.insert("entityKind", v);
    }
    if let Some(v) = patch
        .entity_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("entityId", v);
    }
    if let Some(v) = patch.issue_date.as_deref().and_then(parse_date) {
        set.insert("issueDate", v);
    }
    if let Some(v) = patch.expiry_date.as_deref().and_then(parse_date) {
        set.insert("expiryDate", v);
    }
    if let Some(v) = patch.document_number {
        set.insert("documentNumber", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.is_confidential {
        set.insert("isConfidential", v);
    }
    if let Some(v) = patch
        .verified_by
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("verifiedBy", v);
    }
    if let Some(v) = patch.status {
        // On status→verified, stamp verifiedAt + verifiedBy if missing.
        if v == "verified" {
            set.insert("verifiedAt", now);
            if !set.contains_key("verifiedBy") {
                set.insert("verifiedBy", user_id);
            }
        }
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmDocument) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmDocument>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_documents(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.employee_id.as_deref(),
        q.entity_kind.as_deref(),
        q.entity_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "name",
                "description",
                "employeeName",
                "documentNumber",
                "notes",
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
    let coll = mongo.collection::<CrmDocument>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.find")))?;
    let mut rows: Vec<CrmDocument> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn get_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
) -> Result<Json<CrmDocument>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<CrmDocument>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.find_one")))?
        .ok_or_else(|| ApiError::NotFound("document".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDocumentInput>,
) -> Result<Json<CreateDocumentResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = document_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmDocument>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateDocumentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn update_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
    Json(patch): Json<UpdateDocumentInput>,
) -> Result<Json<CrmDocument>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<CrmDocument>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.find_one")))?
        .ok_or_else(|| ApiError::NotFound("document".to_owned()))?;
    let update = build_update_doc(patch, user_id);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("document".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.refetch")))?
        .ok_or_else(|| ApiError::NotFound("document".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %document_id))]
pub async fn delete_document(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(document_id): Path<String>,
) -> Result<Json<DeleteDocumentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&document_id)?;
    let coll = mongo.collection::<CrmDocument>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_documents.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("document".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDocumentResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn document_from_create_defaults_status_and_confidential() {
        let user_id = ObjectId::new();
        let input = CreateDocumentInput {
            name: "Aadhaar Card".into(),
            ..Default::default()
        };
        let d = document_from_create(input, user_id).unwrap();
        assert_eq!(d.status, "pending");
        assert!(!d.is_confidential);
        assert_eq!(d.uploaded_by, Some(user_id));
        assert!(d.verified_at.is_none());
    }

    #[test]
    fn document_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateDocumentInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(document_from_create(input, user_id).is_err());
    }

    #[test]
    fn build_update_doc_stamps_verified_at_on_verified_status() {
        let user_id = ObjectId::new();
        let patch = UpdateDocumentInput {
            status: Some("verified".into()),
            ..Default::default()
        };
        let update = build_update_doc(patch, user_id);
        let set = update.get_document("$set").unwrap();
        assert_eq!(set.get_str("status").unwrap(), "verified");
        assert!(set.contains_key("verifiedAt"));
        assert!(set.contains_key("verifiedBy"));
    }
}
