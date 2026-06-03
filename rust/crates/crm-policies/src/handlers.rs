//! HTTP handlers for the HR Policy entity.

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
    CreatePolicyInput, CreatePolicyResponse, DeletePolicyResponse, ListQuery, UpdatePolicyInput,
};
use crate::types::CrmPolicy;

const COLL: &str = "crm_policies";
const ENTITY_KIND: &str = "policy";

fn list_filter(user_id: ObjectId, status: Option<&str>, category: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "published" | "under_review" | "obsolete" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
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

fn parse_oid_vec(ids: Option<Vec<String>>) -> Vec<ObjectId> {
    ids.unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok())
        .collect()
}

fn policy_from_create(input: CreatePolicyInput, user_id: ObjectId) -> Result<CrmPolicy> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmPolicy {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        version: input.version,
        category: input.category,
        summary: input.summary,
        document_url: input.document_url,
        content: input.content,
        effective_date: input.effective_date.as_deref().and_then(parse_date),
        review_date: input.review_date.as_deref().and_then(parse_date),
        expiry_date: input.expiry_date.as_deref().and_then(parse_date),
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        department_ids: parse_oid_vec(input.department_ids),
        acknowledgement_required: input.acknowledgement_required.unwrap_or(false),
        acknowledgement_count: 0,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        tags: input.tags.unwrap_or_default(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePolicyInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.version {
        set.insert("version", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.summary {
        set.insert("summary", v);
    }
    if let Some(v) = patch.document_url {
        set.insert("documentUrl", v);
    }
    if let Some(v) = patch.content {
        set.insert("content", v);
    }
    if let Some(v) = patch.effective_date.as_deref().and_then(parse_date) {
        set.insert("effectiveDate", v);
    }
    if let Some(v) = patch.review_date.as_deref().and_then(parse_date) {
        set.insert("reviewDate", v);
    }
    if let Some(v) = patch.expiry_date.as_deref().and_then(parse_date) {
        set.insert("expiryDate", v);
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.department_ids {
        set.insert("departmentIds", parse_oid_vec(Some(v)));
    }
    if let Some(v) = patch.acknowledgement_required {
        set.insert("acknowledgementRequired", v);
    }
    if let Some(v) = patch.acknowledgement_count {
        set.insert("acknowledgementCount", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmPolicy) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmPolicy>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_policies(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.category.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "summary", "content", "version"]);
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
    let coll = mongo.collection::<CrmPolicy>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.find")))?;
    let mut rows: Vec<CrmPolicy> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %policy_id))]
pub async fn get_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
) -> Result<Json<CrmPolicy>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let coll = mongo.collection::<CrmPolicy>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.find_one")))?
        .ok_or_else(|| ApiError::NotFound("policy".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePolicyInput>,
) -> Result<Json<CreatePolicyResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = policy_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmPolicy>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreatePolicyResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %policy_id))]
pub async fn update_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
    Json(patch): Json<UpdatePolicyInput>,
) -> Result<Json<CrmPolicy>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let coll = mongo.collection::<CrmPolicy>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.find_one")))?
        .ok_or_else(|| ApiError::NotFound("policy".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("policy".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.refetch")))?
        .ok_or_else(|| ApiError::NotFound("policy".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %policy_id))]
pub async fn delete_policy(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(policy_id): Path<String>,
) -> Result<Json<DeletePolicyResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&policy_id)?;
    let coll = mongo.collection::<CrmPolicy>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_policies.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("policy".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePolicyResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        // default should NOT pin status to a single value — it excludes archived.
        let status = f.get("status").unwrap();
        assert!(status.as_document().is_some(), "expected $ne doc");
    }

    #[test]
    fn list_filter_applies_category_and_status() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("published"), Some("hr"));
        assert_eq!(f.get_str("status").ok(), Some("published"));
        assert_eq!(f.get_str("category").ok(), Some("hr"));
    }

    #[test]
    fn policy_from_create_defaults_and_validates_name() {
        let user_id = ObjectId::new();
        let ok = policy_from_create(
            CreatePolicyInput {
                name: "Leave Policy".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        assert_eq!(ok.name, "Leave Policy");
        assert_eq!(ok.status, "draft");
        assert!(!ok.acknowledgement_required);
        assert_eq!(ok.acknowledgement_count, 0);

        let bad = policy_from_create(
            CreatePolicyInput {
                name: "   ".into(),
                ..Default::default()
            },
            user_id,
        );
        assert!(bad.is_err());
    }
}
