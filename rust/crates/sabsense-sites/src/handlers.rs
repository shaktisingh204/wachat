//! HTTP handlers for SabCheckout SabsenseSites.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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
    CreateSabsenseSiteInput, CreateSabsenseSiteResponse, DeleteSabsenseSiteResponse, ListQuery, UpdateSabsenseSiteInput,
};
use crate::types::SabsenseSite;

const COLL: &str = "sabsense_sites";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status {
        Some("all") | None => {}
        Some(s) => {
            filter.insert("status", s);
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn site_from_create(input: CreateSabsenseSiteInput, user_id: ObjectId) -> Result<SabsenseSite> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.amount_minor <= 0 {
        return Err(ApiError::Validation("amountMinor must be > 0".to_owned()));
    }
    let interval_unit = input.interval_unit.trim().to_lowercase();
    if !matches!(interval_unit.as_str(), "day" | "week" | "month" | "year") {
        return Err(ApiError::Validation(
            "intervalUnit must be one of day|week|month|year".to_owned(),
        ));
    }
    Ok(SabsenseSite {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        interval_unit,
        interval_count: input.interval_count.unwrap_or(1).max(1),
        amount_minor: input.amount_minor,
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        trial_days: input.trial_days,
        setup_fee_minor: input.setup_fee_minor,
        description: input.description,
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSabsenseSiteInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.interval_unit {
        set.insert("intervalUnit", v.to_lowercase());
    }
    if let Some(v) = patch.interval_count {
        set.insert("intervalCount", v.max(1));
    }
    if let Some(v) = patch.amount_minor {
        set.insert("amountMinor", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.trial_days {
        set.insert("trialDays", v);
    }
    if let Some(v) = patch.setup_fee_minor {
        set.insert("setupFeeMinor", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsenseSite>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sites(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<SabsenseSite>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.find"))
        })?;
    let mut rows: Vec<SabsenseSite> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn get_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
) -> Result<Json<SabsenseSite>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<SabsenseSite>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_site".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSabsenseSiteInput>,
) -> Result<Json<CreateSabsenseSiteResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = site_from_create(input, user_id)?;
    let coll = mongo.collection::<SabsenseSite>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateSabsenseSiteResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn update_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
    Json(patch): Json<UpdateSabsenseSiteInput>,
) -> Result<Json<SabsenseSite>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<SabsenseSite>(COLL);
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabsense_site".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabsense_site".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %site_id))]
pub async fn delete_site(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(site_id): Path<String>,
) -> Result<Json<DeleteSabsenseSiteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&site_id)?;
    let coll = mongo.collection::<SabsenseSite>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabsense_sites.archive"))
        })?;
    Ok(Json(DeleteSabsenseSiteResponse {
        deleted: result.matched_count > 0,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_rejects_bad_interval() {
        let input = CreateSabsenseSiteInput {
            name: "Pro".into(),
            interval_unit: "decade".into(),
            amount_minor: 1000,
            ..Default::default()
        };
        assert!(site_from_create(input, ObjectId::new()).is_err());
    }

    #[test]
    fn create_defaults_count_and_status() {
        let input = CreateSabsenseSiteInput {
            name: "Pro".into(),
            interval_unit: "MONTH".into(),
            amount_minor: 1999_00,
            ..Default::default()
        };
        let p = site_from_create(input, ObjectId::new()).unwrap();
        assert_eq!(p.interval_unit, "month");
        assert_eq!(p.interval_count, 1);
        assert_eq!(p.status, "draft");
        assert_eq!(p.currency, "INR");
    }
}
