use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabmonitorStatusPage;

const COLL: &str = "sabmonitor_status_pages";
const CHECKS_COLL: &str = "sabmonitor_checks";

fn user_oid(u: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&u.user_id).map_err(|e| ApiError::Validation(format!("invalid userId: {e}")))
}
fn ownership(user_id: ObjectId, id: ObjectId) -> Document { doc! { "_id": id, "userId": user_id } }
fn parse_oids(v: Vec<String>) -> Vec<ObjectId> {
    v.into_iter().filter_map(|s| ObjectId::parse_str(&s).ok()).collect()
}

#[instrument(skip_all)]
pub async fn list_pages(user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let limit = q.limit.unwrap_or(50).min(200) as i64;
    let skip = q.page.unwrap_or(0) as u64 * limit as u64;
    let opts = FindOptions::builder().sort(doc! { "createdAt": -1 }).skip(skip).limit(limit + 1).build();
    let coll = mongo.collection::<SabmonitorStatusPage>(COLL);
    let cursor = coll.find(doc! { "userId": user_id }).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.find")))?;
    let mut rows: Vec<SabmonitorStatusPage> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_page(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<SabmonitorStatusPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    mongo.collection::<SabmonitorStatusPage>(COLL).find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.find_one")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("status_page".into()))
}

#[instrument(skip_all)]
pub async fn create_page(user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateStatusPageInput>) -> Result<Json<CreateStatusPageResponse>> {
    let user_id = user_oid(&user)?;
    if input.slug.trim().is_empty() || input.title.trim().is_empty() {
        return Err(ApiError::Validation("slug and title are required".into()));
    }
    let mut entity = SabmonitorStatusPage {
        id: None,
        user_id,
        slug: input.slug,
        title: input.title,
        theme_json: input.theme_json,
        check_ids: parse_oids(input.check_ids),
        show_historical_uptime: input.show_historical_uptime,
        custom_header: input.custom_header,
        custom_css: input.custom_css,
        status: input.status.unwrap_or_else(|| "live".into()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabmonitorStatusPage>(COLL);
    let r = coll.insert_one(&entity).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.insert")))?;
    let id = r.inserted_id.as_object_id().ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id missing")))?;
    entity.id = Some(id);
    Ok(Json(CreateStatusPageResponse { id: id.to_hex(), entity }))
}

#[instrument(skip_all)]
pub async fn update_page(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>, Json(patch): Json<UpdateStatusPageInput>) -> Result<Json<SabmonitorStatusPage>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.slug { set.insert("slug", v); }
    if let Some(v) = patch.title { set.insert("title", v); }
    if let Some(v) = patch.theme_json {
        if let Ok(b) = bson::to_bson(&v) { set.insert("themeJson", b); }
    }
    if let Some(v) = patch.check_ids {
        let arr: Vec<bson::Bson> = parse_oids(v).into_iter().map(bson::Bson::ObjectId).collect();
        set.insert("checkIds", arr);
    }
    if let Some(v) = patch.show_historical_uptime { set.insert("showHistoricalUptime", v); }
    if let Some(v) = patch.custom_header { set.insert("customHeader", v); }
    if let Some(v) = patch.custom_css { set.insert("customCss", v); }
    if let Some(v) = patch.status { set.insert("status", v); }
    let coll = mongo.collection::<SabmonitorStatusPage>(COLL);
    let r = coll.update_one(ownership(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.update")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("status_page".into())); }
    coll.find_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.refetch")))?
        .map(Json)
        .ok_or_else(|| ApiError::NotFound("status_page".into()))
}

#[instrument(skip_all)]
pub async fn delete_page(user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>) -> Result<Json<DeleteStatusPageResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabmonitorStatusPage>(COLL);
    let r = coll.delete_one(ownership(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("status_page".into())); }
    Ok(Json(DeleteStatusPageResponse { deleted: true }))
}

/// Public, unauthenticated handler — fetches by slug across all tenants.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn public_get_by_slug(State(mongo): State<MongoHandle>, Path(slug): Path<String>) -> Result<Json<PublicStatusPageView>> {
    let coll = mongo.collection::<SabmonitorStatusPage>(COLL);
    let page = coll.find_one(doc! { "slug": &slug, "status": "live" }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.public_find")))?
        .ok_or_else(|| ApiError::NotFound("status_page".into()))?;

    // Fetch minimal check rows for the page.
    let mut checks: Vec<PublicCheckView> = Vec::new();
    if !page.check_ids.is_empty() {
        let check_oids: Vec<bson::Bson> = page.check_ids.iter().map(|o| bson::Bson::ObjectId(*o)).collect();
        let filter = doc! { "_id": { "$in": check_oids }, "userId": page.user_id };
        let cursor = mongo.collection::<bson::Document>(CHECKS_COLL).find(filter).await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.public_find_checks")))?;
        let docs: Vec<bson::Document> = cursor.try_collect().await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmonitor_status_pages.public_find_checks_collect")))?;
        for d in docs {
            let id = d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default();
            let name = d.get_str("name").unwrap_or("").to_owned();
            let kind = d.get_str("kind").unwrap_or("http").to_owned();
            let last_status = d.get_str("lastStatus").unwrap_or("unknown").to_owned();
            checks.push(PublicCheckView { id, name, kind, last_status });
        }
    }

    Ok(Json(PublicStatusPageView {
        slug: page.slug,
        title: page.title,
        theme_json: page.theme_json,
        custom_header: page.custom_header,
        custom_css: page.custom_css,
        show_historical_uptime: page.show_historical_uptime,
        checks,
    }))
}
