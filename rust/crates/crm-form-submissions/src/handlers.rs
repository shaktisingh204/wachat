//! HTTP handlers for the Form Submission entity.

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
    CreateSubmissionInput, CreateSubmissionResponse, DeleteSubmissionResponse, ListQuery,
    UpdateSubmissionInput,
};
use crate::types::CrmFormSubmission;

const COLL: &str = "crm_form_submissions";
const ENTITY_KIND: &str = "form_submission";

fn list_filter(user_id: ObjectId, status: Option<&str>, form_id: Option<ObjectId>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "new" | "processed" | "spam" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(fid) = form_id {
        filter.insert("formId", fid);
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

fn submission_from_create(
    input: CreateSubmissionInput,
    user_id: ObjectId,
) -> Result<CrmFormSubmission> {
    let form_id = ObjectId::parse_str(input.form_id.trim())
        .map_err(|_| ApiError::Validation("formId must be a valid ObjectId".to_owned()))?;
    Ok(CrmFormSubmission {
        id: None,
        user_id,
        form_id,
        data: input.data.unwrap_or_default(),
        source_url: input.source_url,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        referrer: input.referrer,
        status: "new".to_owned(),
        processed_at: None,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSubmissionInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.data {
        set.insert("data", v);
    }
    if let Some(v) = patch.source_url {
        set.insert("sourceUrl", v);
    }
    if let Some(v) = patch.ip_address {
        set.insert("ipAddress", v);
    }
    if let Some(v) = patch.user_agent {
        set.insert("userAgent", v);
    }
    if let Some(v) = patch.referrer {
        set.insert("referrer", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.processed_at.as_deref().and_then(parse_date) {
        set.insert("processedAt", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmFormSubmission) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmFormSubmission>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_submissions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let form_id = match q
        .form_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => Some(
            ObjectId::parse_str(raw)
                .map_err(|_| ApiError::Validation("formId must be a valid ObjectId".to_owned()))?,
        ),
        None => None,
    };
    let mut filter = list_filter(user_id, q.status.as_deref(), form_id);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["sourceUrl", "ipAddress", "userAgent", "notes"]);
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
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find"))
    })?;
    let mut rows: Vec<CrmFormSubmission> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn get_submission(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
) -> Result<Json<CrmFormSubmission>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_submission(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSubmissionInput>,
) -> Result<Json<CreateSubmissionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = submission_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.insert"))
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
    Ok(Json(CreateSubmissionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn update_submission(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
    Json(patch): Json<UpdateSubmissionInput>,
) -> Result<Json<CrmFormSubmission>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_submission".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("form_submission".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %submission_id))]
pub async fn delete_submission(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(submission_id): Path<String>,
) -> Result<Json<DeleteSubmissionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&submission_id)?;
    let coll = mongo.collection::<CrmFormSubmission>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_form_submissions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("form_submission".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSubmissionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        // Default branch sets `status: { $ne: "archived" }`, not a plain string.
        let status = f.get("status").and_then(|b| b.as_document()).unwrap();
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn list_filter_scopes_by_form_id_when_provided() {
        let user = ObjectId::new();
        let form = ObjectId::new();
        let f = list_filter(user, Some("new"), Some(form));
        assert_eq!(f.get_object_id("formId").unwrap(), form);
        assert_eq!(f.get_str("status").unwrap(), "new");
    }

    #[test]
    fn submission_from_create_rejects_bad_form_id() {
        let user_id = ObjectId::new();
        let input = CreateSubmissionInput {
            form_id: "not-an-object-id".into(),
            ..Default::default()
        };
        assert!(submission_from_create(input, user_id).is_err());
    }
}
