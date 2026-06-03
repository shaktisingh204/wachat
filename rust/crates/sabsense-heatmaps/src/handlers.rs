//! Snapshot CRUD + stub regeneration.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc};
use chrono::{TimeZone, Utc};
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, RegenerateInput, RegenerateResponse};
use crate::types::HeatmapSnapshot;

const COLL: &str = "pagesense_heatmaps";
const EVENTS_COLL: &str = "pagesense_heatmap_events";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<HeatmapSnapshot>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %q.site_id))]
pub async fn list_snapshots(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&q.site_id)?;
    let mut filter: Document = doc! { "userId": user_id, "siteId": site_id };
    if let Some(url) = q.url.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("url", url);
    }
    if let Some(v) = q.variant.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("variant", v);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<HeatmapSnapshot>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmaps.find"))
    })?;
    let mut rows: Vec<HeatmapSnapshot> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmaps.collect"))
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

/// Stubbed aggregator: counts events in the window and writes a
/// snapshot with an empty click grid + zeroed scroll buckets.
///
/// TODO: real binning. Read raw events, divide by viewport, bin clicks
/// into a (cols x rows) grid, compute scroll-depth deciles from the
/// max scroll y per session. Until that's implemented the snapshot is
/// effectively a metadata placeholder so the UI can render.
#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %input.site_id, url = %input.url))]
pub async fn regenerate_snapshot(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RegenerateInput>,
) -> Result<Json<RegenerateResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&input.site_id)?;
    let from = Utc
        .timestamp_millis_opt(input.period_from_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("invalid periodFromMs".into()))?;
    let to = Utc
        .timestamp_millis_opt(input.period_to_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("invalid periodToMs".into()))?;

    let events_coll = mongo.collection::<bson::Document>(EVENTS_COLL);
    let sample_size = events_coll
        .count_documents(doc! {
            "userId": user_id,
            "siteId": site_id,
            "url": &input.url,
            "ts": {
                "$gte": BsonDateTime::from_chrono(from),
                "$lte": BsonDateTime::from_chrono(to),
            }
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmaps.count_events"))
        })?;

    let snap = HeatmapSnapshot {
        id: None,
        user_id,
        site_id,
        url: input.url,
        variant: input.variant,
        period_from: BsonDateTime::from_chrono(from),
        period_to: BsonDateTime::from_chrono(to),
        click_grid_json: r#"{"cols":40,"rows":60,"cells":[]}"#.to_owned(),
        scroll_depth_buckets: vec![0.0; 10],
        sample_size,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<HeatmapSnapshot>(COLL);
    let inserted = coll.insert_one(&snap).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_heatmaps.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    Ok(Json(RegenerateResponse {
        id: new_id.to_hex(),
        sample_size,
    }))
}
