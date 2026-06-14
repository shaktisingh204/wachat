//! HTTP handler for the SabChat **WFM** forecast.
//!
//! Reads `sabchat_conversations` (camelCase fields: `tenantId` / `inboxId` /
//! `createdAt`) and aggregates inbound volume by hour-of-week over a look-back
//! window, turning it into an average-volume + recommended-agents grid.
//!
//! Tenancy: the `$match` filters on `tenantId = ObjectId(auth.tenant_id)`.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use tracing::instrument;

use crate::dto::{ForecastQuery, ForecastResponse, ForecastSlot};
use crate::state::SabChatWfmState;

const CONV_COLL: &str = "sabchat_conversations";

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// `GET /v1/sabchat/wfm/forecast` — staffing forecast by hour-of-week.
#[instrument(skip_all)]
pub async fn forecast(
    user: AuthUser,
    State(state): State<SabChatWfmState>,
    Query(q): Query<ForecastQuery>,
) -> Result<Json<ForecastResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let weeks = q.weeks.unwrap_or(4).clamp(1, 26);
    let target = {
        let t = q.target_per_agent_per_hour.unwrap_or(6.0);
        if t > 0.0 { t } else { 6.0 }
    };
    let window_start = bson::DateTime::from_chrono(Utc::now() - Duration::weeks(weeks));

    let mut match_doc = doc! { "tenantId": tenant_id, "createdAt": doc! { "$gte": window_start } };
    if let Some(inbox) = q.inbox_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let inbox_oid =
            oid_from_str(inbox).map_err(|_| ApiError::BadRequest("invalid inboxId".to_owned()))?;
        match_doc.insert("inboxId", inbox_oid);
    }

    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$group": {
            "_id": { "dow": { "$dayOfWeek": "$createdAt" }, "hour": { "$hour": "$createdAt" } },
            "count": { "$sum": 1 },
        }},
    ];

    let cursor = state
        .mongo
        .collection::<Document>(CONV_COLL)
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.aggregate")))?;
    let rows: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("wfm.forecast.collect")))?;

    let weeks_f = weeks as f64;
    let mut slots: Vec<ForecastSlot> = Vec::with_capacity(rows.len());
    let mut total: i64 = 0;
    let mut peak_agents: u32 = 0;

    for row in rows {
        let id = row.get_document("_id").cloned().unwrap_or_default();
        // $dayOfWeek is 1 (Sunday) ..= 7 (Saturday) → normalize to 0..=6.
        let dow_raw = id.get_i32("dow").unwrap_or(1);
        let day_of_week = ((dow_raw - 1).clamp(0, 6)) as u8;
        let hour = id.get_i32("hour").unwrap_or(0).clamp(0, 23) as u8;
        let count = row.get_i32("count").unwrap_or(0) as i64;
        total += count;

        let avg_volume = count as f64 / weeks_f;
        let recommended_agents = (avg_volume / target).ceil().max(0.0) as u32;
        peak_agents = peak_agents.max(recommended_agents);

        slots.push(ForecastSlot {
            day_of_week,
            hour,
            avg_volume: (avg_volume * 100.0).round() / 100.0,
            recommended_agents,
        });
    }

    // Busiest first.
    slots.sort_by(|a, b| b.avg_volume.partial_cmp(&a.avg_volume).unwrap_or(std::cmp::Ordering::Equal));

    Ok(Json(ForecastResponse {
        weeks,
        target_per_agent_per_hour: target,
        total_conversations: total,
        slots,
        peak_agents,
    }))
}
