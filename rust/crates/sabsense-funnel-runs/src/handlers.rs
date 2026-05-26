//! Funnel-run handlers (stub computation).

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, doc};
use chrono::{TimeZone, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, RunFunnelInput, RunFunnelResponse};
use crate::types::{FunnelRun, StepResult};

const COLL: &str = "pagesense_funnel_runs";
const FUNNELS_COLL: &str = "pagesense_funnels";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<FunnelRun>,
}

#[instrument(skip_all, fields(user_id = %user.user_id, funnel_id = %q.funnel_id))]
pub async fn list_runs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let funnel_id = oid_from_str(&q.funnel_id)?;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(q.limit.unwrap_or(20).min(100) as i64)
        .build();
    let coll = mongo.collection::<FunnelRun>(COLL);
    let cursor = coll
        .find(doc! { "userId": user_id, "funnelId": funnel_id })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnel_runs.find"))
        })?;
    let rows: Vec<FunnelRun> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnel_runs.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

/// Stub runner: pulls the funnel definition, writes a zeroed run row
/// so the UI can render. TODO: real session-walking over
/// `pagesense_heatmap_events` joined with the funnel steps.
#[instrument(skip_all, fields(user_id = %user.user_id, funnel_id = %input.funnel_id))]
pub async fn run_funnel(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RunFunnelInput>,
) -> Result<Json<RunFunnelResponse>> {
    let user_id = user_oid(&user)?;
    let funnel_id = oid_from_str(&input.funnel_id)?;

    // Load the funnel definition to copy step names.
    let funnels = mongo.collection::<bson::Document>(FUNNELS_COLL);
    let def = funnels
        .find_one(doc! { "_id": funnel_id, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnel_runs.load_def"))
        })?
        .ok_or_else(|| ApiError::NotFound("funnel".into()))?;

    let site_id = def
        .get_object_id("siteId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("funnel doc missing siteId")))?;
    let steps_raw = def.get_array("steps").cloned().unwrap_or_default();
    let steps: Vec<StepResult> = steps_raw
        .iter()
        .map(|b| {
            let name = b
                .as_document()
                .and_then(|d| d.get_str("name").ok().map(str::to_owned))
                .unwrap_or_default();
            StepResult {
                name,
                count: 0,
                dropoff_rate: 0.0,
            }
        })
        .collect();

    let from = Utc
        .timestamp_millis_opt(input.period_from_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("invalid periodFromMs".into()))?;
    let to = Utc
        .timestamp_millis_opt(input.period_to_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("invalid periodToMs".into()))?;

    let run = FunnelRun {
        id: None,
        user_id,
        funnel_id,
        site_id,
        period_from: BsonDateTime::from_chrono(from),
        period_to: BsonDateTime::from_chrono(to),
        steps,
        total_sessions: 0,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<FunnelRun>(COLL);
    let inserted = coll.insert_one(&run).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_funnel_runs.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    Ok(Json(RunFunnelResponse {
        id: new_id.to_hex(),
        total_sessions: 0,
    }))
}
