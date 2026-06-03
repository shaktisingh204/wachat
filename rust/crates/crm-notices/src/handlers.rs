//! HTTP handlers for the Notice entity.

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
    CreateNoticeInput, CreateNoticeResponse, DeleteNoticeResponse, ListQuery, UpdateNoticeInput,
};
use crate::types::CrmNotice;

const COLL: &str = "crm_notices";
const ENTITY_KIND: &str = "notice";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    category: Option<&str>,
    severity: Option<&str>,
    issued_to: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "issued" | "acknowledged" | "superseded" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    if let Some(s) = severity.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("severity", s);
    }
    if let Some(t) = issued_to.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("issuedTo", t);
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

fn parse_oid_vec(v: &[String]) -> Vec<ObjectId> {
    v.iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

/// `"NOT-<last-6-digits-of-now-ms>"`.
fn generate_notice_number() -> String {
    let now_ms = Utc::now().timestamp_millis();
    let abs = now_ms.unsigned_abs();
    let tail = abs % 1_000_000;
    format!("NOT-{:06}", tail)
}

fn notice_from_create(input: CreateNoticeInput, user_id: ObjectId) -> Result<CrmNotice> {
    if input.title.trim().is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let notice_number = input
        .notice_number
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(generate_notice_number);

    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| "draft".to_owned());

    let now = BsonDateTime::from_chrono(Utc::now());
    let issued_at = if status == "issued" { Some(now) } else { None };

    Ok(CrmNotice {
        id: None,
        user_id,
        notice_number,
        title: input.title.trim().to_owned(),
        body: input.body.trim().to_owned(),
        category: input.category,
        reference_number: input.reference_number,
        issued_by: input
            .issued_by
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        issued_by_name: input.issued_by_name,
        issued_to: input.issued_to,
        recipient_ids: input
            .recipient_ids
            .as_deref()
            .map(parse_oid_vec)
            .unwrap_or_default(),
        effective_from: input.effective_from.as_deref().and_then(parse_date),
        effective_until: input.effective_until.as_deref().and_then(parse_date),
        require_acknowledgement: input.require_acknowledgement.unwrap_or(false),
        acknowledgement_count: 0,
        severity: input.severity,
        attachments: input.attachments.unwrap_or_default(),
        status,
        issued_at,
        superseded_by: None,
        notes: input.notes,
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateNoticeInput, before: &CrmNotice) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.notice_number {
        set.insert("noticeNumber", v);
    }
    if let Some(v) = patch.title {
        set.insert("title", v);
    }
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.reference_number {
        set.insert("referenceNumber", v);
    }
    if let Some(v) = patch
        .issued_by
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("issuedBy", v);
    }
    if let Some(v) = patch.issued_by_name {
        set.insert("issuedByName", v);
    }
    if let Some(v) = patch.issued_to {
        set.insert("issuedTo", v);
    }
    if let Some(v) = patch.recipient_ids {
        set.insert("recipientIds", parse_oid_vec(&v));
    }
    if let Some(v) = patch.effective_from.as_deref().and_then(parse_date) {
        set.insert("effectiveFrom", v);
    }
    if let Some(v) = patch.effective_until.as_deref().and_then(parse_date) {
        set.insert("effectiveUntil", v);
    }
    if let Some(v) = patch.require_acknowledgement {
        set.insert("requireAcknowledgement", v);
    }
    if let Some(v) = patch.acknowledgement_count {
        set.insert("acknowledgementCount", v);
    }
    if let Some(v) = patch.severity {
        set.insert("severity", v);
    }
    if let Some(v) = patch.attachments {
        set.insert("attachments", v);
    }
    if let Some(v) = patch.status.as_deref() {
        set.insert("status", v);
        // Stamp issuedAt on first transition to "issued" if not already set.
        if v == "issued" && before.issued_at.is_none() {
            set.insert("issuedAt", now);
        }
    }
    if let Some(v) = patch
        .superseded_by
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("supersededBy", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmNotice) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmNotice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_notices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.category.as_deref(),
        q.severity.as_deref(),
        q.issued_to.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["title", "body", "noticeNumber", "referenceNumber", "notes"],
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
    let coll = mongo.collection::<CrmNotice>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.find")))?;
    let mut rows: Vec<CrmNotice> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notice_id))]
pub async fn get_notice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notice_id): Path<String>,
) -> Result<Json<CrmNotice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notice_id)?;
    let coll = mongo.collection::<CrmNotice>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.find_one")))?
        .ok_or_else(|| ApiError::NotFound("notice".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_notice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateNoticeInput>,
) -> Result<Json<CreateNoticeResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = notice_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmNotice>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateNoticeResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notice_id))]
pub async fn update_notice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notice_id): Path<String>,
    Json(patch): Json<UpdateNoticeInput>,
) -> Result<Json<CrmNotice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notice_id)?;
    let coll = mongo.collection::<CrmNotice>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.find_one")))?
        .ok_or_else(|| ApiError::NotFound("notice".to_owned()))?;
    let update = build_update_doc(patch, &before);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("notice".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.refetch")))?
        .ok_or_else(|| ApiError::NotFound("notice".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %notice_id))]
pub async fn delete_notice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(notice_id): Path<String>,
) -> Result<Json<DeleteNoticeResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&notice_id)?;
    let coll = mongo.collection::<CrmNotice>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_notices.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("notice".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteNoticeResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        assert!(f.contains_key("status"));
        // category/severity/issuedTo absent when not supplied
        assert!(!f.contains_key("category"));
        assert!(!f.contains_key("severity"));
        assert!(!f.contains_key("issuedTo"));
    }

    #[test]
    fn notice_from_create_auto_generates_notice_number_and_defaults_status_draft() {
        let user_id = ObjectId::new();
        let input = CreateNoticeInput {
            title: "Office closure".into(),
            body: "Office closed Monday.".into(),
            ..Default::default()
        };
        let n = notice_from_create(input, user_id).unwrap();
        assert!(n.notice_number.starts_with("NOT-"));
        assert_eq!(n.notice_number.len(), 10); // "NOT-" + 6 digits
        assert_eq!(n.status, "draft");
        assert!(n.issued_at.is_none());
        assert_eq!(n.acknowledgement_count, 0);
        assert!(!n.require_acknowledgement);
    }

    #[test]
    fn notice_from_create_rejects_empty_title_and_body() {
        let user_id = ObjectId::new();
        let empty_title = CreateNoticeInput {
            title: "   ".into(),
            body: "Body here".into(),
            ..Default::default()
        };
        assert!(notice_from_create(empty_title, user_id).is_err());

        let empty_body = CreateNoticeInput {
            title: "Title here".into(),
            body: "".into(),
            ..Default::default()
        };
        assert!(notice_from_create(empty_body, user_id).is_err());
    }
}
