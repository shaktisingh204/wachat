//! HTTP handlers for the HR KPI entity.

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

use crate::dto::{CreateKpiInput, CreateKpiResponse, DeleteKpiResponse, ListQuery, UpdateKpiInput};
use crate::types::CrmKpi;

const COLL: &str = "crm_kpis";
const ENTITY_KIND: &str = "kpi";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    frequency: Option<&str>,
    department: Option<&str>,
    owner: Option<&str>,
    category: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
        other => {
            filter.insert("status", other);
        }
    }
    if let Some(v) = frequency.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("frequency", v);
    }
    if let Some(v) = department.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("department", v);
    }
    if let Some(v) = owner.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("owner", v);
    }
    if let Some(v) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", v);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn kpi_from_create(input: CreateKpiInput, user_id: ObjectId) -> Result<CrmKpi> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmKpi {
        id: None,
        user_id,
        name: name.to_owned(),
        description: input.description.filter(|s| !s.trim().is_empty()),
        target: input.target.filter(|s| !s.trim().is_empty()),
        unit: input.unit.filter(|s| !s.trim().is_empty()),
        frequency: input.frequency.filter(|s| !s.trim().is_empty()),
        owner: input.owner.filter(|s| !s.trim().is_empty()),
        department: input.department.filter(|s| !s.trim().is_empty()),
        weight: input.weight,
        category: input.category.filter(|s| !s.trim().is_empty()),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateKpiInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.target {
        set.insert("target", v);
    }
    if let Some(v) = patch.unit {
        set.insert("unit", v);
    }
    if let Some(v) = patch.frequency {
        set.insert("frequency", v);
    }
    if let Some(v) = patch.owner {
        set.insert("owner", v);
    }
    if let Some(v) = patch.department {
        set.insert("department", v);
    }
    if let Some(v) = patch.weight {
        set.insert("weight", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmKpi) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmKpi>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_kpis(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.frequency.as_deref(),
        q.department.as_deref(),
        q.owner.as_deref(),
        q.category.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["name", "description", "owner", "department", "category"],
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
    let coll = mongo.collection::<CrmKpi>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.find")))?;
    let mut rows: Vec<CrmKpi> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %kpi_id))]
pub async fn get_kpi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(kpi_id): Path<String>,
) -> Result<Json<CrmKpi>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&kpi_id)?;
    let coll = mongo.collection::<CrmKpi>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.find_one")))?
        .ok_or_else(|| ApiError::NotFound("kpi".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_kpi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateKpiInput>,
) -> Result<Json<CreateKpiResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = kpi_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmKpi>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateKpiResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %kpi_id))]
pub async fn update_kpi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(kpi_id): Path<String>,
    Json(patch): Json<UpdateKpiInput>,
) -> Result<Json<CrmKpi>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&kpi_id)?;
    let coll = mongo.collection::<CrmKpi>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.find_one")))?
        .ok_or_else(|| ApiError::NotFound("kpi".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kpi".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.refetch")))?
        .ok_or_else(|| ApiError::NotFound("kpi".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %kpi_id))]
pub async fn delete_kpi(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(kpi_id): Path<String>,
) -> Result<Json<DeleteKpiResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&kpi_id)?;
    let coll = mongo.collection::<CrmKpi>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_kpis.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("kpi".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteKpiResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None, None);
        assert!(f.contains_key("status"));
        // Default "active" branch should set status: { $ne: "archived" }
        let status_doc = f.get_document("status").unwrap();
        assert_eq!(status_doc.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn kpi_from_create_defaults_status_and_trims_name() {
        let user_id = ObjectId::new();
        let input = CreateKpiInput {
            name: "  Revenue Growth  ".into(),
            frequency: Some("quarterly".into()),
            ..Default::default()
        };
        let k = kpi_from_create(input, user_id).unwrap();
        assert_eq!(k.name, "Revenue Growth");
        assert_eq!(k.status, "active");
        assert_eq!(k.frequency.as_deref(), Some("quarterly"));
    }

    #[test]
    fn kpi_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateKpiInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(kpi_from_create(input, user_id).is_err());
    }
}
