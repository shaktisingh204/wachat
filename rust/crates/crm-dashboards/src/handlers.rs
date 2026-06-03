//! HTTP handlers for the Dashboard entity.

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
    CreateDashboardInput, CreateDashboardResponse, DeleteDashboardResponse, ListQuery,
    UpdateDashboardInput,
};
use crate::types::CrmDashboard;

const COLL: &str = "crm_dashboards";
const ENTITY_KIND: &str = "dashboard";

fn list_filter(user_id: ObjectId, status: Option<&str>, scope: Option<&str>) -> Document {
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
    if let Some(s) = scope.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("scope", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn dashboard_from_create(input: CreateDashboardInput, user_id: ObjectId) -> Result<CrmDashboard> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmDashboard {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input
            .description
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        layout: input.layout,
        widgets: input.widgets.unwrap_or_default(),
        is_default: input.is_default.unwrap_or(false),
        scope: input
            .scope
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        owner_id: input
            .owner_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateDashboardInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.layout {
        set.insert("layout", v);
    }
    if let Some(v) = patch.widgets {
        set.insert("widgets", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.scope {
        set.insert("scope", v);
    }
    if let Some(v) = patch
        .owner_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ownerId", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmDashboard) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmDashboard>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_dashboards(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.scope.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    if let Some(only_default) = q.is_default
        && only_default
    {
        filter.insert("isDefault", true);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "isDefault": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmDashboard>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.find"))
        })?;
    let mut rows: Vec<CrmDashboard> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dashboard_id))]
pub async fn get_dashboard(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dashboard_id): Path<String>,
) -> Result<Json<CrmDashboard>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dashboard_id)?;
    let coll = mongo.collection::<CrmDashboard>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.find_one")))?
        .ok_or_else(|| ApiError::NotFound("dashboard".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_dashboard(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateDashboardInput>,
) -> Result<Json<CreateDashboardResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = dashboard_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmDashboard>(COLL);
    if entity.is_default {
        // Demote other defaults for this tenant so only one dashboard remains default.
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateDashboardResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dashboard_id))]
pub async fn update_dashboard(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dashboard_id): Path<String>,
    Json(patch): Json<UpdateDashboardInput>,
) -> Result<Json<CrmDashboard>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dashboard_id)?;
    let coll = mongo.collection::<CrmDashboard>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.find_one")))?
        .ok_or_else(|| ApiError::NotFound("dashboard".to_owned()))?;
    // Validate name if provided.
    if let Some(name) = patch.name.as_deref()
        && name.trim().is_empty()
    {
        return Err(ApiError::Validation("name cannot be empty".to_owned()));
    }
    // Demote other defaults if this one is being promoted.
    if matches!(patch.is_default, Some(true)) {
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "isDefault": true, "_id": { "$ne": oid } },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("dashboard".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.refetch")))?
        .ok_or_else(|| ApiError::NotFound("dashboard".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %dashboard_id))]
pub async fn delete_dashboard(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(dashboard_id): Path<String>,
) -> Result<Json<DeleteDashboardResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&dashboard_id)?;
    let coll = mongo.collection::<CrmDashboard>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_dashboards.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("dashboard".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteDashboardResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        assert_eq!(f.get("userId").and_then(|v| v.as_object_id()), Some(oid));
    }

    #[test]
    fn dashboard_from_create_sets_defaults_and_status() {
        let user_id = ObjectId::new();
        let input = CreateDashboardInput {
            name: "My Dashboard".into(),
            ..Default::default()
        };
        let d = dashboard_from_create(input, user_id).unwrap();
        assert_eq!(d.name, "My Dashboard");
        assert_eq!(d.status, "active");
        assert!(!d.is_default);
        assert!(d.widgets.is_empty());
        assert!(d.layout.is_none());
    }

    #[test]
    fn dashboard_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateDashboardInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(dashboard_from_create(input, user_id).is_err());
    }
}
