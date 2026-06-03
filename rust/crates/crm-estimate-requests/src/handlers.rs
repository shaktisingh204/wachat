//! HTTP handlers for the Estimate Request entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateEstimateRequestInput, CreateEstimateRequestResponse, DeleteEstimateRequestResponse,
    ListQuery, UpdateEstimateRequestInput,
};
use crate::types::CrmEstimateRequest;

const COLL: &str = "crm_estimate_requests";
const ENTITY_KIND: &str = "estimate_request";

const VALID_STATUSES: &[&str] = &["pending", "in_review", "quoted", "declined", "archived"];
const VALID_SOURCES: &[&str] = &["web", "email", "phone", "referral", "other"];

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        s if VALID_STATUSES.contains(&s) => {
            filter.insert("status", s);
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

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn pick_source(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|s| VALID_SOURCES.contains(s))
        .map(|s| s.to_owned())
        .unwrap_or_else(|| "web".to_owned())
}

fn pick_status(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| VALID_STATUSES.contains(s))
        .map(|s| s.to_owned())
}

fn doc_from_create(
    input: CreateEstimateRequestInput,
    user_id: ObjectId,
) -> Result<CrmEstimateRequest> {
    let customer_name = input.customer_name.trim().to_owned();
    if customer_name.is_empty() {
        return Err(ApiError::Validation("customerName is required".to_owned()));
    }

    let requirements = input.requirements.trim().to_owned();
    if requirements.is_empty() {
        return Err(ApiError::Validation("requirements is required".to_owned()));
    }

    let deadline = match input.deadline.as_deref() {
        Some(s) if !s.trim().is_empty() => match parse_date(s) {
            Some(d) => Some(d),
            None => return Err(ApiError::Validation("deadline is invalid".to_owned())),
        },
        _ => None,
    };

    let source = pick_source(input.source.as_deref());
    let status = pick_status(input.status.as_deref()).unwrap_or_else(|| "pending".to_owned());

    Ok(CrmEstimateRequest {
        id: None,
        user_id,
        customer_name,
        customer_email: input
            .customer_email
            .map(|e| e.trim().to_owned())
            .filter(|e| !e.is_empty()),
        requirements,
        budget_range: input
            .budget_range
            .map(|b| b.trim().to_owned())
            .filter(|b| !b.is_empty()),
        deadline,
        source,
        status,
        assigned_to_id: input
            .assigned_to_id
            .map(|a| a.trim().to_owned())
            .filter(|a| !a.is_empty()),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateEstimateRequestInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };

    if let Some(v) = patch.customer_name {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation(
                "customerName cannot be empty".to_owned(),
            ));
        }
        set.insert("customerName", t);
    }
    if let Some(v) = patch.customer_email {
        let t = v.trim();
        if t.is_empty() {
            set.insert("customerEmail", Bson::Null);
        } else {
            set.insert("customerEmail", t.to_owned());
        }
    }
    if let Some(v) = patch.requirements {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation(
                "requirements cannot be empty".to_owned(),
            ));
        }
        set.insert("requirements", t);
    }
    if let Some(v) = patch.budget_range {
        let t = v.trim();
        if t.is_empty() {
            set.insert("budgetRange", Bson::Null);
        } else {
            set.insert("budgetRange", t.to_owned());
        }
    }
    if let Some(v) = patch.deadline {
        if v.trim().is_empty() {
            set.insert("deadline", Bson::Null);
        } else {
            let d = parse_date(&v)
                .ok_or_else(|| ApiError::Validation("deadline is invalid".to_owned()))?;
            set.insert("deadline", d);
        }
    }
    if let Some(v) = patch.source {
        set.insert("source", pick_source(Some(&v)));
    }
    if let Some(v) = patch.status {
        let s = pick_status(Some(&v))
            .ok_or_else(|| ApiError::Validation("status is invalid".to_owned()))?;
        set.insert("status", s);
    }
    if let Some(v) = patch.assigned_to_id {
        let t = v.trim();
        if t.is_empty() {
            set.insert("assignedToId", Bson::Null);
        } else {
            set.insert("assignedToId", t.to_owned());
        }
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }

    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmEstimateRequest) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmEstimateRequest>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_estimate_requests(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["customerName", "customerEmail", "requirements"]);
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

    let coll = mongo.collection::<CrmEstimateRequest>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.find"))
    })?;
    let mut rows: Vec<CrmEstimateRequest> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn get_estimate_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<CrmEstimateRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let coll = mongo.collection::<CrmEstimateRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("estimate_request".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_estimate_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateEstimateRequestInput>,
) -> Result<Json<CreateEstimateRequestResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = doc_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmEstimateRequest>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.insert"))
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

    Ok(Json(CreateEstimateRequestResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn update_estimate_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Json(patch): Json<UpdateEstimateRequestInput>,
) -> Result<Json<CrmEstimateRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmEstimateRequest>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("estimate_request".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("estimate_request".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("estimate_request".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %request_id))]
pub async fn delete_estimate_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<DeleteEstimateRequestResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;

    let coll = mongo.collection::<CrmEstimateRequest>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_estimate_requests.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("estimate_request".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteEstimateRequestResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_hides_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn pick_source_defaults_to_web() {
        assert_eq!(pick_source(None), "web");
        assert_eq!(pick_source(Some("email")), "email");
        assert_eq!(pick_source(Some("garbage")), "web");
    }

    #[test]
    fn create_requires_customer_name_and_requirements() {
        let user_id = ObjectId::new();
        let input = CreateEstimateRequestInput {
            customer_name: "  ".into(),
            requirements: "Need a website".into(),
            ..Default::default()
        };
        assert!(doc_from_create(input, user_id).is_err());

        let input2 = CreateEstimateRequestInput {
            customer_name: "Acme Inc".into(),
            requirements: "  ".into(),
            ..Default::default()
        };
        assert!(doc_from_create(input2, user_id).is_err());
    }

    #[test]
    fn create_defaults_status_pending_and_source_web() {
        let user_id = ObjectId::new();
        let input = CreateEstimateRequestInput {
            customer_name: "Acme".into(),
            requirements: "Build a CRM dashboard".into(),
            ..Default::default()
        };
        let row = doc_from_create(input, user_id).unwrap();
        assert_eq!(row.status, "pending");
        assert_eq!(row.source, "web");
        assert_eq!(row.customer_name, "Acme");
        assert!(row.deadline.is_none());
    }
}
