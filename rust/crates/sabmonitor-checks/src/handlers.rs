//! HTTP handlers — all scoped by `userId` from the JWT.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateCheckInput, CreateCheckResponse, DeleteCheckResponse, ListQuery, ListResponse,
    UpdateCheckInput,
};
use crate::types::SabmonitorCheck;

const COLL: &str = "sabmonitor_checks";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}

fn ownership(user_id: ObjectId, id: ObjectId) -> Document {
    doc! { "_id": id, "userId": user_id }
}

fn check_from_create(input: CreateCheckInput, user_id: ObjectId) -> SabmonitorCheck {
    SabmonitorCheck {
        id: None,
        user_id,
        name: input.name,
        kind: input.kind,
        url: input.url,
        host: input.host,
        port: input.port,
        interval_secs: input.interval_secs,
        regions: input.regions,
        headers_json: input.headers_json,
        body_json: input.body_json,
        expected_status: input.expected_status,
        expected_body_contains: input.expected_body_contains,
        expected_body_regex: input.expected_body_regex,
        ssl_expiry_warn_days: input.ssl_expiry_warn_days,
        synthetic_script_id: input
            .synthetic_script_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        api_transaction_id: input
            .api_transaction_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        tags: input.tags,
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        last_run_at: None,
        last_status: Some("unknown".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    }
}

fn build_update_doc(patch: UpdateCheckInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name { set.insert("name", v); }
    if let Some(v) = patch.kind { set.insert("kind", v); }
    if let Some(v) = patch.interval_secs { set.insert("intervalSecs", v); }
    if let Some(v) = patch.url { set.insert("url", v); }
    if let Some(v) = patch.host { set.insert("host", v); }
    if let Some(v) = patch.port { set.insert("port", v); }
    if let Some(v) = patch.regions {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("regions", arr);
    }
    if let Some(v) = patch.headers_json { set.insert("headersJson", v); }
    if let Some(v) = patch.body_json { set.insert("bodyJson", v); }
    if let Some(v) = patch.expected_status { set.insert("expectedStatus", v); }
    if let Some(v) = patch.expected_body_contains { set.insert("expectedBodyContains", v); }
    if let Some(v) = patch.expected_body_regex { set.insert("expectedBodyRegex", v); }
    if let Some(v) = patch.ssl_expiry_warn_days { set.insert("sslExpiryWarnDays", v); }
    if let Some(v) = patch.synthetic_script_id {
        if let Ok(oid) = ObjectId::parse_str(&v) { set.insert("syntheticScriptId", oid); }
    }
    if let Some(v) = patch.api_transaction_id {
        if let Ok(oid) = ObjectId::parse_str(&v) { set.insert("apiTransactionId", oid); }
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    if let Some(v) = patch.status { set.insert("status", v); }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_checks(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("all") {
        "all" => {}
        s => { filter.insert("status", s); }
    }
    if let Some(k) = q.kind.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("kind", k);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let pattern = doc! { "$regex": needle, "$options": "i" };
        filter.insert("$or", vec![
            doc! { "name": pattern.clone() },
            doc! { "url": pattern.clone() },
            doc! { "host": pattern },
        ]);
    }
    let limit = q.limit.unwrap_or(20).min(100) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabmonitorCheck>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.find")))?;
    let mut rows: Vec<SabmonitorCheck> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, check_id = %check_id))]
pub async fn get_check(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(check_id): Path<String>,
) -> Result<Json<SabmonitorCheck>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&check_id)?;
    let coll = mongo.collection::<SabmonitorCheck>(COLL);
    let row = coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.find_one")))?
        .ok_or_else(|| ApiError::NotFound("check".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_check(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCheckInput>,
) -> Result<Json<CreateCheckResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.kind.trim().is_empty() {
        return Err(ApiError::Validation("kind is required".to_owned()));
    }
    let mut entity = check_from_create(input, user_id);
    let coll = mongo.collection::<SabmonitorCheck>(COLL);
    let res = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.insert")))?;
    let id = res.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateCheckResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, check_id = %check_id))]
pub async fn update_check(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(check_id): Path<String>,
    Json(patch): Json<UpdateCheckInput>,
) -> Result<Json<SabmonitorCheck>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&check_id)?;
    let coll = mongo.collection::<SabmonitorCheck>(COLL);
    let r = coll.update_one(ownership(user_id, oid), build_update_doc(patch)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.update")))?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("check".to_owned()));
    }
    let row = coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.refetch")))?
        .ok_or_else(|| ApiError::NotFound("check".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id, check_id = %check_id))]
pub async fn delete_check(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(check_id): Path<String>,
) -> Result<Json<DeleteCheckResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&check_id)?;
    let coll = mongo.collection::<SabmonitorCheck>(COLL);
    let r = coll.delete_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_checks.delete")))?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("check".to_owned()));
    }
    Ok(Json(DeleteCheckResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn check_from_create_sets_defaults() {
        let user_id = ObjectId::new();
        let input = CreateCheckInput {
            name: "Homepage".into(),
            kind: "http".into(),
            interval_secs: 60,
            url: Some("https://example.com".into()),
            ..Default::default()
        };
        let c = check_from_create(input, user_id);
        assert_eq!(c.status, "active");
        assert_eq!(c.last_status.as_deref(), Some("unknown"));
    }
    #[test]
    fn update_doc_omits_unset() {
        let d = build_update_doc(UpdateCheckInput { name: Some("New".into()), ..Default::default() });
        let s = d.get_document("$set").unwrap();
        assert_eq!(s.get_str("name").unwrap(), "New");
        assert!(!s.contains_key("kind"));
        assert!(s.contains_key("updatedAt"));
    }
}
