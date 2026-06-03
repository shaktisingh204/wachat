//! HTTP handlers for the Travel Request entity.

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
    CreateTravelRequestInput, CreateTravelRequestResponse, DeleteTravelRequestResponse, ListQuery,
    UpdateTravelRequestInput,
};
use crate::types::CrmTravelRequest;

const COLL: &str = "crm_travel_requests";
const ENTITY_KIND: &str = "travel_request";

const VALID_STATUSES: &[&str] = &[
    "draft",
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "completed",
    "archived",
];

const VALID_MODES: &[&str] = &["flight", "train", "bus", "car", "taxi", "other"];

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
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

fn coerce_status(raw: Option<&str>, default: &str) -> String {
    match raw {
        Some(s) if VALID_STATUSES.contains(&s) => s.to_owned(),
        _ => default.to_owned(),
    }
}

fn coerce_mode(raw: Option<&str>) -> Option<String> {
    raw.and_then(|s| {
        if VALID_MODES.contains(&s) {
            Some(s.to_owned())
        } else {
            None
        }
    })
}

fn travel_from_create(
    input: CreateTravelRequestInput,
    user_id: ObjectId,
) -> Result<CrmTravelRequest> {
    if input.employee_id.trim().is_empty() {
        return Err(ApiError::Validation("employee_id is required".to_owned()));
    }
    Ok(CrmTravelRequest {
        id: None,
        user_id,
        employee_id: input.employee_id.trim().to_owned(),
        employee_name: input.employee_name,
        purpose: input.purpose,
        from_city: input.from_city,
        to_city: input.to_city,
        mode: coerce_mode(input.mode.as_deref()),
        travel_date: input.travel_date.as_deref().and_then(parse_date),
        return_date: input.return_date.as_deref().and_then(parse_date),
        estimated_cost: input.estimated_cost,
        actual_cost: input.actual_cost,
        currency: Some(input.currency.unwrap_or_else(|| "INR".to_owned())),
        status: coerce_status(input.status.as_deref(), "pending"),
        approver_id: input.approver_id,
        approver_name: input.approver_name,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTravelRequestInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_id {
        set.insert("employee_id", v.trim());
    }
    if let Some(v) = patch.employee_name {
        set.insert("employee_name", v);
    }
    if let Some(v) = patch.purpose {
        set.insert("purpose", v);
    }
    if let Some(v) = patch.from_city {
        set.insert("from_city", v);
    }
    if let Some(v) = patch.to_city {
        set.insert("to_city", v);
    }
    if let Some(v) = patch.mode {
        if let Some(m) = coerce_mode(Some(v.as_str())) {
            set.insert("mode", m);
        }
    }
    if let Some(v) = patch.travel_date.as_deref().and_then(parse_date) {
        set.insert("travel_date", v);
    }
    if let Some(v) = patch.return_date.as_deref().and_then(parse_date) {
        set.insert("return_date", v);
    }
    if let Some(v) = patch.estimated_cost {
        set.insert("estimated_cost", v);
    }
    if let Some(v) = patch.actual_cost {
        set.insert("actual_cost", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.status {
        if VALID_STATUSES.contains(&v.as_str()) {
            set.insert("status", v);
        }
    }
    if let Some(v) = patch.approver_id {
        set.insert("approver_id", v);
    }
    if let Some(v) = patch.approver_name {
        set.insert("approver_name", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTravelRequest) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTravelRequest>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_travel_requests(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(emp) = q.employee_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("employee_id", emp);
    }
    if let Some(app) = q.approver_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("approver_id", app);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &[
                "employee_name",
                "employee_id",
                "purpose",
                "from_city",
                "to_city",
            ],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "travel_date": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmTravelRequest>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.find")))?;
    let mut rows: Vec<CrmTravelRequest> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %travel_id))]
pub async fn get_travel_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(travel_id): Path<String>,
) -> Result<Json<CrmTravelRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&travel_id)?;
    let coll = mongo.collection::<CrmTravelRequest>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.find_one")))?
        .ok_or_else(|| ApiError::NotFound("travel_request".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_travel_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTravelRequestInput>,
) -> Result<Json<CreateTravelRequestResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = travel_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTravelRequest>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTravelRequestResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %travel_id))]
pub async fn update_travel_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(travel_id): Path<String>,
    Json(patch): Json<UpdateTravelRequestInput>,
) -> Result<Json<CrmTravelRequest>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&travel_id)?;

    let coll = mongo.collection::<CrmTravelRequest>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.find_one")))?
        .ok_or_else(|| ApiError::NotFound("travel_request".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("travel_request".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.refetch")))?
        .ok_or_else(|| ApiError::NotFound("travel_request".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %travel_id))]
pub async fn delete_travel_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(travel_id): Path<String>,
) -> Result<Json<DeleteTravelRequestResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&travel_id)?;

    let coll = mongo.collection::<CrmTravelRequest>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_travel.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("travel_request".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTravelRequestResponse { deleted: true }))
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
    fn travel_from_create_defaults_status_and_currency() {
        let user_id = ObjectId::new();
        let input = CreateTravelRequestInput {
            employee_id: "emp_1".into(),
            ..Default::default()
        };
        let t = travel_from_create(input, user_id).unwrap();
        assert_eq!(t.status, "pending");
        assert_eq!(t.currency.as_deref(), Some("INR"));
    }

    #[test]
    fn travel_from_create_rejects_empty_employee() {
        let user_id = ObjectId::new();
        let input = CreateTravelRequestInput {
            employee_id: "  ".into(),
            ..Default::default()
        };
        assert!(travel_from_create(input, user_id).is_err());
    }

    #[test]
    fn coerce_mode_filters_invalid() {
        assert_eq!(coerce_mode(Some("flight")), Some("flight".to_owned()));
        assert_eq!(coerce_mode(Some("spaceship")), None);
        assert_eq!(coerce_mode(None), None);
    }
}
