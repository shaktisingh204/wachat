//! HTTP handlers for SabWebinar analytics.
//!
//! Computes per-webinar summary stats on demand by scanning the
//! related collections — no separate analytics collection today.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::AnalyticsQuery;
use crate::types::{SourceBreakdown, WebinarAnalytics};

const REGISTRATIONS: &str = "sabwebinar_registrations";
const SESSIONS: &str = "sabwebinar_sessions";
const POLLS: &str = "sabwebinar_polls";
const QNA: &str = "sabwebinar_qna";
const WEBINARS: &str = "sabwebinar_webinars";

#[derive(serde::Deserialize)]
struct RegistrationLite {
    #[serde(default)]
    source: Option<String>,
    #[serde(default, rename = "joinedAt")]
    joined_at: Option<bson::DateTime>,
    #[serde(default, rename = "leftAt")]
    left_at: Option<bson::DateTime>,
}

#[derive(serde::Deserialize)]
struct SessionLite {
    #[serde(default, rename = "peakConcurrent")]
    peak_concurrent: u32,
}

#[derive(serde::Deserialize)]
struct PollLite {
    #[serde(default)]
    options: Vec<PollOptionLite>,
}

#[derive(serde::Deserialize)]
struct PollOptionLite {
    #[serde(default, rename = "voteCount")]
    vote_count: u32,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_analytics(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<AnalyticsQuery>,
) -> Result<Json<WebinarAnalytics>> {
    let user_id = user_oid(&user)?;
    let webinar_oid = oid_from_str(&q.webinar_id)?;

    // Ownership check.
    let webinars = mongo.collection::<Document>(WEBINARS);
    let owned = webinars
        .find_one(doc! { "_id": webinar_oid, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.owncheck")))?;
    if owned.is_none() {
        return Err(ApiError::NotFound("webinar".to_owned()));
    }

    let scope: Document = doc! { "webinarId": webinar_oid };

    // Registrations: count, attended (joined_at present), avg watch, by source.
    let regs = mongo.collection::<RegistrationLite>(REGISTRATIONS);
    let cursor = regs
        .find(scope.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.regs")))?;
    let reg_rows: Vec<RegistrationLite> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.regs.collect"))
    })?;
    let registered_count = reg_rows.len() as u32;
    let mut attended_count: u32 = 0;
    let mut watch_total_secs: f64 = 0.0;
    let mut watch_samples: u32 = 0;
    let mut by_source: HashMap<String, u32> = HashMap::new();
    for r in &reg_rows {
        let src = r.source.clone().unwrap_or_else(|| "direct".to_owned());
        *by_source.entry(src).or_insert(0) += 1;
        if r.joined_at.is_some() {
            attended_count += 1;
        }
        if let (Some(j), Some(l)) = (&r.joined_at, &r.left_at) {
            let jc = j.to_chrono();
            let lc = l.to_chrono();
            let dur = (lc - jc).num_seconds() as f64;
            if dur > 0.0 {
                watch_total_secs += dur;
                watch_samples += 1;
            }
        }
    }
    let avg_watch_minutes = if watch_samples > 0 {
        (watch_total_secs / watch_samples as f64) / 60.0
    } else {
        0.0
    };

    // Sessions — peak concurrent.
    let sessions = mongo.collection::<SessionLite>(SESSIONS);
    let cursor = sessions
        .find(scope.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.sessions")))?;
    let session_rows: Vec<SessionLite> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.sessions.collect"))
    })?;
    let peak_concurrent = session_rows
        .iter()
        .map(|s| s.peak_concurrent)
        .max()
        .unwrap_or(0);

    // Polls — sum of vote counts across all polls/options.
    let polls = mongo.collection::<PollLite>(POLLS);
    let cursor = polls
        .find(scope.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.polls")))?;
    let poll_rows: Vec<PollLite> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.polls.collect"))
    })?;
    let poll_engagement_count: u32 = poll_rows
        .iter()
        .flat_map(|p| p.options.iter())
        .map(|o| o.vote_count)
        .sum();

    // QnA — count.
    let qna = mongo.collection::<Document>(QNA);
    let qna_count = qna
        .count_documents(scope.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_analytics.qna")))?
        as u32;

    let conversion_rate = if registered_count > 0 {
        attended_count as f64 / registered_count as f64
    } else {
        0.0
    };

    let mut registrations_by_source: Vec<SourceBreakdown> = by_source
        .into_iter()
        .map(|(source, count)| SourceBreakdown { source, count })
        .collect();
    registrations_by_source.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(Json(WebinarAnalytics {
        webinar_id: webinar_oid,
        registered_count,
        attended_count,
        avg_watch_time_minutes: avg_watch_minutes,
        peak_concurrent,
        conversion_rate,
        poll_engagement_count,
        qna_count,
        registrations_by_source,
    }))
}
