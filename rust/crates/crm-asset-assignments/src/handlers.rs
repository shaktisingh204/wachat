//! HTTP handlers for the AssetAssignment entity.

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
    CreateAssetAssignmentInput, CreateAssetAssignmentResponse, DeleteAssetAssignmentResponse,
    ListQuery, UpdateAssetAssignmentInput,
};
use crate::types::CrmAssetAssignment;

const COLL: &str = "crm_asset_assignments";
const ENTITY_KIND: &str = "asset_assignment";

const VALID_STATUSES: &[&str] = &["assigned", "returned", "lost", "damaged", "archived"];
const VALID_CONDITIONS: &[&str] = &["new", "good", "fair", "poor", "damaged"];

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    asset_id: Option<&str>,
    employee_id: Option<&str>,
) -> Document {
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
    if let Some(a) = asset_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("asset_id", a);
    }
    if let Some(e) = employee_id.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("employee_id", e);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

/// Parses ISO-8601 → BSON datetime; returns `None` if unparsable.
fn parse_iso(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn normalise_status(raw: Option<String>) -> String {
    raw.as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| VALID_STATUSES.contains(s))
        .unwrap_or("assigned")
        .to_owned()
}

fn normalise_condition(raw: Option<String>) -> Option<String> {
    raw.as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| VALID_CONDITIONS.contains(s))
        .map(str::to_owned)
}

fn assignment_from_create(
    input: CreateAssetAssignmentInput,
    user_id: ObjectId,
) -> Result<CrmAssetAssignment> {
    let asset_id = input.asset_id.trim();
    if asset_id.is_empty() {
        return Err(ApiError::Validation("assetId is required".to_owned()));
    }
    let employee_id = input.employee_id.trim();
    if employee_id.is_empty() {
        return Err(ApiError::Validation("employeeId is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let assigned_at = input
        .assigned_at
        .as_deref()
        .and_then(parse_iso)
        .unwrap_or(now);
    let returned_at = input.returned_at.as_deref().and_then(parse_iso);

    Ok(CrmAssetAssignment {
        id: None,
        user_id,
        asset_id: asset_id.to_owned(),
        asset_name: input.asset_name,
        employee_id: employee_id.to_owned(),
        employee_name: input.employee_name,
        assigned_at: Some(assigned_at),
        returned_at,
        condition_at_assign: normalise_condition(input.condition_at_assign),
        condition_at_return: normalise_condition(input.condition_at_return),
        notes: input.notes,
        status: normalise_status(input.status),
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAssetAssignmentInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.asset_id.map(|s| s.trim().to_owned()) {
        if v.is_empty() {
            return Err(ApiError::Validation("assetId must not be empty".to_owned()));
        }
        set.insert("asset_id", v);
    }
    if let Some(v) = patch.asset_name {
        set.insert("asset_name", v);
    }
    if let Some(v) = patch.employee_id.map(|s| s.trim().to_owned()) {
        if v.is_empty() {
            return Err(ApiError::Validation(
                "employeeId must not be empty".to_owned(),
            ));
        }
        set.insert("employee_id", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employee_name", v);
    }
    if let Some(v) = patch.assigned_at.as_deref().and_then(parse_iso) {
        set.insert("assigned_at", v);
    }
    if let Some(v) = patch.returned_at.as_deref().and_then(parse_iso) {
        set.insert("returned_at", v);
    }
    if let Some(v) = normalise_condition(patch.condition_at_assign) {
        set.insert("condition_at_assign", v);
    }
    if let Some(v) = normalise_condition(patch.condition_at_return) {
        set.insert("condition_at_return", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        let s = v.trim();
        if !VALID_STATUSES.contains(&s) {
            return Err(ApiError::Validation(format!(
                "status must be one of {VALID_STATUSES:?}"
            )));
        }
        set.insert("status", s);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmAssetAssignment) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAssetAssignment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_assignments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.asset_id.as_deref(),
        q.employee_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["asset_name", "employee_name", "asset_id", "employee_id"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "assigned_at": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmAssetAssignment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.find"))
    })?;
    let mut rows: Vec<CrmAssetAssignment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %assignment_id))]
pub async fn get_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(assignment_id): Path<String>,
) -> Result<Json<CrmAssetAssignment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&assignment_id)?;
    let coll = mongo.collection::<CrmAssetAssignment>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("asset_assignment".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAssetAssignmentInput>,
) -> Result<Json<CreateAssetAssignmentResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = assignment_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAssetAssignment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.insert"))
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

    Ok(Json(CreateAssetAssignmentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %assignment_id))]
pub async fn update_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(assignment_id): Path<String>,
    Json(patch): Json<UpdateAssetAssignmentInput>,
) -> Result<Json<CrmAssetAssignment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&assignment_id)?;

    let coll = mongo.collection::<CrmAssetAssignment>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("asset_assignment".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("asset_assignment".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("asset_assignment".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %assignment_id))]
pub async fn delete_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(assignment_id): Path<String>,
) -> Result<Json<DeleteAssetAssignmentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&assignment_id)?;

    let coll = mongo.collection::<CrmAssetAssignment>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_asset_assignments.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("asset_assignment".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteAssetAssignmentResponse { deleted: true }))
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
    fn assignment_from_create_defaults_status_to_assigned() {
        let user_id = ObjectId::new();
        let input = CreateAssetAssignmentInput {
            asset_id: "asset-1".into(),
            employee_id: "emp-1".into(),
            ..Default::default()
        };
        let a = assignment_from_create(input, user_id).unwrap();
        assert_eq!(a.status, "assigned");
        assert_eq!(a.asset_id, "asset-1");
        assert_eq!(a.employee_id, "emp-1");
        assert!(a.assigned_at.is_some());
        assert!(a.returned_at.is_none());
    }

    #[test]
    fn assignment_from_create_rejects_empty_ids() {
        let user_id = ObjectId::new();
        let bad = CreateAssetAssignmentInput {
            asset_id: "  ".into(),
            employee_id: "emp-1".into(),
            ..Default::default()
        };
        assert!(assignment_from_create(bad, user_id).is_err());

        let bad = CreateAssetAssignmentInput {
            asset_id: "asset-1".into(),
            employee_id: "  ".into(),
            ..Default::default()
        };
        assert!(assignment_from_create(bad, user_id).is_err());
    }

    #[test]
    fn condition_normaliser_drops_unknown_values() {
        assert_eq!(
            normalise_condition(Some("good".into())).as_deref(),
            Some("good")
        );
        assert!(normalise_condition(Some("bogus".into())).is_none());
        assert!(normalise_condition(Some("  ".into())).is_none());
        assert!(normalise_condition(None).is_none());
    }
}
