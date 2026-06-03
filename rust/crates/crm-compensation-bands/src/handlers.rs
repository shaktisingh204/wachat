//! HTTP handlers for the Compensation Band entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateCompensationBandInput, CreateCompensationBandResponse, DeleteCompensationBandResponse,
    ListQuery, UpdateCompensationBandInput,
};
use crate::types::CrmCompensationBand;

const COLL: &str = "crm_compensation_bands";
const ENTITY_KIND: &str = "compensation_band";

const VALID_STATUSES: &[&str] = &["draft", "active", "inactive", "archived"];

fn list_filter(user_id: ObjectId, status: Option<&str>, level: Option<&str>) -> Document {
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
    if let Some(l) = level.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("level", l);
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

fn perks_to_bson(perks: Vec<String>) -> Bson {
    let arr: Vec<Bson> = perks
        .into_iter()
        .filter_map(|p| {
            let trimmed = p.trim().to_owned();
            if trimmed.is_empty() {
                None
            } else {
                Some(Bson::String(trimmed))
            }
        })
        .collect();
    Bson::Array(arr)
}

fn band_from_create(
    input: CreateCompensationBandInput,
    user_id: ObjectId,
) -> Result<CrmCompensationBand> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if let (Some(min), Some(max)) = (input.min_salary, input.max_salary) {
        if min > max {
            return Err(ApiError::Validation(
                "min_salary cannot exceed max_salary".to_owned(),
            ));
        }
    }
    let perks: Vec<String> = input
        .perks
        .into_iter()
        .filter_map(|p| {
            let t = p.trim().to_owned();
            if t.is_empty() { None } else { Some(t) }
        })
        .collect();

    Ok(CrmCompensationBand {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        code: input.code,
        level: input.level,
        min_salary: input.min_salary,
        max_salary: input.max_salary,
        mid_salary: input.mid_salary,
        currency: Some(input.currency.unwrap_or_else(|| "INR".to_owned())),
        department_id: input.department_id,
        role_title: input.role_title,
        perks,
        is_active: input.is_active.unwrap_or(true),
        status: coerce_status(input.status.as_deref(), "draft"),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(
    patch: UpdateCompensationBandInput,
    before: &CrmCompensationBand,
) -> Result<Document> {
    // Validate min/max combo against the merged state.
    let next_min = patch.min_salary.or(before.min_salary);
    let next_max = patch.max_salary.or(before.max_salary);
    if let (Some(min), Some(max)) = (next_min, next_max) {
        if min > max {
            return Err(ApiError::Validation(
                "min_salary cannot exceed max_salary".to_owned(),
            ));
        }
    }

    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.code {
        set.insert("code", v);
    }
    if let Some(v) = patch.level {
        set.insert("level", v);
    }
    if let Some(v) = patch.min_salary {
        set.insert("min_salary", v);
    }
    if let Some(v) = patch.max_salary {
        set.insert("max_salary", v);
    }
    if let Some(v) = patch.mid_salary {
        set.insert("mid_salary", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.department_id {
        set.insert("department_id", v);
    }
    if let Some(v) = patch.role_title {
        set.insert("role_title", v);
    }
    if let Some(v) = patch.perks {
        set.insert("perks", perks_to_bson(v));
    }
    if let Some(v) = patch.is_active {
        set.insert("is_active", v);
    }
    if let Some(v) = patch.status {
        if VALID_STATUSES.contains(&v.as_str()) {
            set.insert("status", v);
        }
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmCompensationBand) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmCompensationBand>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_bands(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.level.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "code", "role_title", "level"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "name": 1, "level": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmCompensationBand>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.find"))
    })?;
    let mut rows: Vec<CrmCompensationBand> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %band_id))]
pub async fn get_band(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(band_id): Path<String>,
) -> Result<Json<CrmCompensationBand>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&band_id)?;
    let coll = mongo.collection::<CrmCompensationBand>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("compensation_band".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_band(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCompensationBandInput>,
) -> Result<Json<CreateCompensationBandResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = band_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmCompensationBand>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.insert"))
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

    Ok(Json(CreateCompensationBandResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %band_id))]
pub async fn update_band(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(band_id): Path<String>,
    Json(patch): Json<UpdateCompensationBandInput>,
) -> Result<Json<CrmCompensationBand>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&band_id)?;

    let coll = mongo.collection::<CrmCompensationBand>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("compensation_band".to_owned()))?;

    let update = build_update_doc(patch, &before)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("compensation_band".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("compensation_band".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %band_id))]
pub async fn delete_band(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(band_id): Path<String>,
) -> Result<Json<DeleteCompensationBandResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&band_id)?;

    let coll = mongo.collection::<CrmCompensationBand>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "is_active": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_compensation_bands.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("compensation_band".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteCompensationBandResponse { deleted: true }))
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
    fn band_from_create_defaults_status_currency_and_is_active() {
        let user_id = ObjectId::new();
        let input = CreateCompensationBandInput {
            name: "Senior".into(),
            ..Default::default()
        };
        let b = band_from_create(input, user_id).unwrap();
        assert_eq!(b.status, "draft");
        assert_eq!(b.currency.as_deref(), Some("INR"));
        assert!(b.is_active);
        assert!(b.perks.is_empty());
    }

    #[test]
    fn band_from_create_rejects_inverted_salary_range() {
        let user_id = ObjectId::new();
        let input = CreateCompensationBandInput {
            name: "Bad".into(),
            min_salary: Some(100_000.0),
            max_salary: Some(50_000.0),
            ..Default::default()
        };
        assert!(band_from_create(input, user_id).is_err());
    }

    #[test]
    fn band_from_create_strips_blank_perks() {
        let user_id = ObjectId::new();
        let input = CreateCompensationBandInput {
            name: "Mid".into(),
            perks: vec!["".into(), " Health  ".into(), "  ".into(), "Stock".into()],
            ..Default::default()
        };
        let b = band_from_create(input, user_id).unwrap();
        assert_eq!(b.perks, vec!["Health".to_owned(), "Stock".to_owned()]);
    }
}
