//! HTTP handlers for the SabChat gamification router.
//!
//! Every endpoint is tenant-scoped: the caller's `auth.tenant_id` is
//! parsed into a BSON `ObjectId` and used as the leading filter on
//! every read and the leading field on every write. A malformed `tid`
//! claim is treated as `401 Unauthorized` (matches the `sabchat-audit`
//! / `sabchat-reports` convention).
//!
//! ## Idempotency
//!
//! `POST /award` is an upsert keyed on `(tenantId, agentId, badgeCode)`
//! — re-awarding the same badge to the same agent is a no-op that
//! still returns `200 OK` with `created: false`.
//!
//! ## Recompute
//!
//! `POST /recompute` walks the tenant's **resolved** conversations,
//! joins on `sabchat_survey_responses` for the CSAT bonus, and replaces
//! the per-(period_key, agent) rows in `sabchat_agent_points`. The
//! three periods (`week`, `month`, `all_time`) are rebuilt in one
//! pass so a single call brings the leaderboard back into sync.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, TimeZone, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use tracing::instrument;

use crate::dto::{
    AgentBadgeRow, AgentBadgesResponse, AgentStatsQuery, AgentStatsResponse, AwardBadgeBody,
    AwardBadgeResponse, BadgeResponse, CreateBadgeBody, DEFAULT_LEADERBOARD_LIMIT,
    LeaderboardQuery, LeaderboardResponse, LeaderboardRow, ListBadgesResponse,
    MAX_LEADERBOARD_LIMIT, Period, RecomputeBody, RecomputeResponse, SuccessResponse,
    UpdateBadgeBody,
};
use crate::scoring::{ConversationOutcome, points_for_conversation};
use crate::state::SabChatGamificationState;
use crate::{
    AGENT_BADGES_COLL, AGENT_POINTS_COLL, BADGES_COLL, CONVERSATIONS_COLL, SURVEY_RESPONSES_COLL,
};

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`. A
/// malformed claim is `401 Unauthorized` — there is no tenant-less
/// gamification view.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Convert chrono → bson datetime in one place.
fn to_bson_dt(dt: DateTime<Utc>) -> bson::DateTime {
    bson::DateTime::from_chrono(dt)
}

/// Wrap any Mongo driver error into `ApiError::Internal` with a stage
/// label so log lines pinpoint the failing pipeline.
fn mongo_err(stage: &'static str) -> impl FnOnce(mongodb::error::Error) -> ApiError {
    move |e| ApiError::Internal(anyhow::Error::new(e).context(stage))
}

/// Pull an `i64` count out of a document, tolerating both `i32` and
/// `i64` shapes that the Mongo driver may return.
fn doc_i64(d: &Document, field: &str) -> i64 {
    d.get_i64(field)
        .ok()
        .or_else(|| d.get_i32(field).ok().map(i64::from))
        .unwrap_or(0)
}

#[allow(dead_code)]
fn doc_f64(d: &Document, field: &str) -> f64 {
    d.get_f64(field)
        .ok()
        .or_else(|| d.get_i64(field).ok().map(|n| n as f64))
        .or_else(|| d.get_i32(field).ok().map(f64::from))
        .unwrap_or(0.0)
}

/// Render an ISO 8601 string for a BSON Date if present, else `None`.
fn doc_iso_dt(d: &Document, field: &str) -> Option<String> {
    d.get_datetime(field)
        .ok()
        .map(|bdt| bdt.to_chrono().to_rfc3339())
}

// ---------------------------------------------------------------------------
// Period-key helpers
// ---------------------------------------------------------------------------

/// `period_key` for a given period at a given instant. `all_time` is
/// the literal string `"all"`; `month` is `YYYY-MM`; `week` is
/// `YYYY-Www` using ISO-week numbering (matches the `%G-W%V` format
/// used elsewhere in the workspace, e.g. `sabchat-reports`).
fn period_key_for(period: Period, at: DateTime<Utc>) -> String {
    match period {
        Period::AllTime => "all".to_owned(),
        Period::Month => format!("{:04}-{:02}", at.year(), at.month()),
        Period::Week => {
            let iso = at.iso_week();
            format!("{:04}-W{:02}", iso.year(), iso.week())
        }
    }
}

/// Resolve the period **window** in UTC. Returns `(from, to)`:
///
/// - `AllTime` → `(epoch, now)`
/// - `Month`   → `(first-of-this-month-00:00Z, now)`
/// - `Week`    → `(start-of-this-ISO-week-Mon-00:00Z, now)`
fn period_window(period: Period, now: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
    let from = match period {
        Period::AllTime => Utc.timestamp_opt(0, 0).single().unwrap_or(now),
        Period::Month => Utc
            .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
            .single()
            .unwrap_or(now),
        Period::Week => {
            // ISO week starts on Monday.
            let weekday_from_mon = now.weekday().num_days_from_monday() as i64;
            let monday = now - chrono::Duration::days(weekday_from_mon);
            Utc.with_ymd_and_hms(monday.year(), monday.month(), monday.day(), 0, 0, 0)
                .single()
                .unwrap_or(now)
        }
    };
    (from, now)
}

// ===========================================================================
// POST /badges — create_badge
// ===========================================================================

/// `POST /v1/sabchat/gamification/badges` — create a new badge in the
/// tenant catalogue. `code` is tenant-unique.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_badge(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Json(body): Json<CreateBadgeBody>,
) -> Result<Json<BadgeResponse>> {
    let tenant = tenant_oid(&user)?;
    if body.code.trim().is_empty() || body.name.trim().is_empty() {
        return Err(ApiError::Validation(
            "Badge `code` and `name` are required.".to_owned(),
        ));
    }

    let coll = state.mongo.collection::<Document>(BADGES_COLL);

    // Tenant-uniqueness check on `code`. Cheap because the catalogue is
    // small and we don't have a per-tenant unique index guaranteed at
    // deploy time.
    let dup = coll
        .find_one(doc! { "tenantId": tenant, "code": &body.code })
        .await
        .map_err(mongo_err("sabchat_gamification.badges.dup_check"))?;
    if dup.is_some() {
        return Err(ApiError::Conflict(format!(
            "A badge with code \"{}\" already exists for this tenant.",
            body.code
        )));
    }

    let now = to_bson_dt(Utc::now());
    let id = ObjectId::new();
    let criteria_doc = doc! {
        "kind": match body.criteria.kind {
            crate::dto::CriteriaKind::ResolvedCount => "resolved_count",
            crate::dto::CriteriaKind::CsatScore     => "csat_score",
            crate::dto::CriteriaKind::StreakDays    => "streak_days",
        },
        "threshold": body.criteria.threshold,
    };
    let mut new_doc = doc! {
        "_id": id,
        "tenantId": tenant,
        "code": &body.code,
        "name": &body.name,
        "criteria": criteria_doc,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(d) = body.description.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("description", d);
    }
    if let Some(i) = body.icon.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("icon", i);
    }

    coll.insert_one(new_doc.clone())
        .await
        .map_err(mongo_err("sabchat_gamification.badges.insert"))?;

    Ok(Json(BadgeResponse {
        badge: document_to_clean_json(new_doc),
    }))
}

// ===========================================================================
// GET /badges — list_badges
// ===========================================================================

/// `GET /v1/sabchat/gamification/badges` — list every badge in the
/// tenant catalogue. Sorted by `code` ascending so the picker order
/// stays stable.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_badges(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
) -> Result<Json<ListBadgesResponse>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(BADGES_COLL);

    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(FindOptions::builder().sort(doc! { "code": 1 }).build())
        .await
        .map_err(mongo_err("sabchat_gamification.badges.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_gamification.badges.collect"))?;
    let badges: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListBadgesResponse { badges }))
}

// ===========================================================================
// PATCH /badges/{id} — update_badge
// ===========================================================================

/// `PATCH /v1/sabchat/gamification/badges/{id}` — partial update. Only
/// the provided fields are `$set`. `code` is immutable post-creation
/// (the code is the tenant-unique key used by `/award`).
#[instrument(skip_all, fields(tenant = %user.tenant_id, badge_id = %badge_id))]
pub async fn update_badge(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Path(badge_id): Path<String>,
    Json(body): Json<UpdateBadgeBody>,
) -> Result<Json<BadgeResponse>> {
    let tenant = tenant_oid(&user)?;
    let badge_oid = oid_from_str(&badge_id)
        .map_err(|_| ApiError::BadRequest("Invalid badge id.".to_owned()))?;

    let mut set = doc! { "updatedAt": to_bson_dt(Utc::now()) };
    if let Some(n) = body.name.as_deref().filter(|s| !s.is_empty()) {
        set.insert("name", n);
    }
    if let Some(d) = body.description.as_ref() {
        set.insert("description", d);
    }
    if let Some(i) = body.icon.as_ref() {
        set.insert("icon", i);
    }
    if let Some(c) = body.criteria.as_ref() {
        set.insert(
            "criteria",
            doc! {
                "kind": match c.kind {
                    crate::dto::CriteriaKind::ResolvedCount => "resolved_count",
                    crate::dto::CriteriaKind::CsatScore     => "csat_score",
                    crate::dto::CriteriaKind::StreakDays    => "streak_days",
                },
                "threshold": c.threshold,
            },
        );
    }

    let coll = state.mongo.collection::<Document>(BADGES_COLL);
    let res = coll
        .update_one(
            doc! { "_id": badge_oid, "tenantId": tenant },
            doc! { "$set": set },
        )
        .await
        .map_err(mongo_err("sabchat_gamification.badges.update"))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Badge not found.".to_owned()));
    }

    let updated = coll
        .find_one(doc! { "_id": badge_oid, "tenantId": tenant })
        .await
        .map_err(mongo_err("sabchat_gamification.badges.refetch"))?
        .ok_or_else(|| ApiError::NotFound("Badge not found.".to_owned()))?;

    Ok(Json(BadgeResponse {
        badge: document_to_clean_json(updated),
    }))
}

// ===========================================================================
// DELETE /badges/{id} — delete_badge
// ===========================================================================

/// `DELETE /v1/sabchat/gamification/badges/{id}` — remove a badge from
/// the tenant catalogue. Awarded rows in `sabchat_agent_badges` are
/// left intact (the badge code persists in agent history); deleting
/// the catalogue entry only stops new manual awards.
#[instrument(skip_all, fields(tenant = %user.tenant_id, badge_id = %badge_id))]
pub async fn delete_badge(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Path(badge_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let badge_oid = oid_from_str(&badge_id)
        .map_err(|_| ApiError::BadRequest("Invalid badge id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(BADGES_COLL);
    let res = coll
        .delete_one(doc! { "_id": badge_oid, "tenantId": tenant })
        .await
        .map_err(mongo_err("sabchat_gamification.badges.delete"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Badge not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /award — award_badge
// ===========================================================================

/// `POST /v1/sabchat/gamification/award` — manually award a badge to
/// an agent. Idempotent — the operation is an upsert keyed on
/// `(tenantId, agentId, badgeCode)`. Returns `created: false` on
/// re-award.
#[instrument(skip_all, fields(tenant = %user.tenant_id, agent_id = %body.agent_id, badge_code = %body.badge_code))]
pub async fn award_badge(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Json(body): Json<AwardBadgeBody>,
) -> Result<Json<AwardBadgeResponse>> {
    let tenant = tenant_oid(&user)?;
    let agent_oid = oid_from_str(&body.agent_id)
        .map_err(|_| ApiError::BadRequest("Invalid agentId.".to_owned()))?;
    if body.badge_code.trim().is_empty() {
        return Err(ApiError::Validation("`badgeCode` is required.".to_owned()));
    }

    // Verify the badge exists in this tenant's catalogue. Surfaces a
    // 404 instead of silently creating a dangling ledger row.
    let badges = state.mongo.collection::<Document>(BADGES_COLL);
    let exists = badges
        .find_one(doc! { "tenantId": tenant, "code": &body.badge_code })
        .await
        .map_err(mongo_err("sabchat_gamification.award.badge_lookup"))?;
    if exists.is_none() {
        return Err(ApiError::NotFound(format!(
            "Badge \"{}\" not found in this tenant.",
            body.badge_code
        )));
    }

    let coll = state.mongo.collection::<Document>(AGENT_BADGES_COLL);
    let now = to_bson_dt(Utc::now());
    let id = ObjectId::new();
    let res = coll
        .update_one(
            doc! {
                "tenantId": tenant,
                "agentId": agent_oid,
                "badgeCode": &body.badge_code,
            },
            doc! {
                "$setOnInsert": {
                    "_id": id,
                    "tenantId": tenant,
                    "agentId": agent_oid,
                    "badgeCode": &body.badge_code,
                    "awardedAt": now,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(mongo_err("sabchat_gamification.award.upsert"))?;

    let created = res.upserted_id.is_some();
    let resolved_id = if created {
        id.to_hex()
    } else {
        // Re-award — fetch the existing row so the caller can link to
        // it without a second round-trip on their side.
        let existing = coll
            .find_one(doc! {
                "tenantId": tenant,
                "agentId": agent_oid,
                "badgeCode": &body.badge_code,
            })
            .await
            .map_err(mongo_err("sabchat_gamification.award.refetch"))?
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!("award upserted but row not found"))
            })?;
        existing
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default()
    };

    Ok(Json(AwardBadgeResponse {
        created,
        id: resolved_id,
    }))
}

// ===========================================================================
// GET /leaderboard — leaderboard
// ===========================================================================

/// `GET /v1/sabchat/gamification/leaderboard` — top agents by points
/// for the requested period. Defaults to `all_time` when `period` is
/// absent.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn leaderboard(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Query(query): Query<LeaderboardQuery>,
) -> Result<Json<LeaderboardResponse>> {
    let tenant = tenant_oid(&user)?;
    let period = query.period.unwrap_or_default();
    let period_key = period_key_for(period, Utc::now());

    let limit = query
        .limit
        .unwrap_or(DEFAULT_LEADERBOARD_LIMIT)
        .clamp(1, MAX_LEADERBOARD_LIMIT);

    let coll = state.mongo.collection::<Document>(AGENT_POINTS_COLL);
    let cursor = coll
        .find(doc! {
            "tenantId": tenant,
            "period": period.as_wire(),
            "periodKey": &period_key,
        })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "points": -1, "agentId": 1 })
                .limit(limit)
                .build(),
        )
        .await
        .map_err(mongo_err("sabchat_gamification.leaderboard.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_gamification.leaderboard.collect"))?;

    let rows: Vec<LeaderboardRow> = docs
        .iter()
        .enumerate()
        .map(|(i, d)| LeaderboardRow {
            agent_id: d
                .get_object_id("agentId")
                .map(|o| o.to_hex())
                .unwrap_or_default(),
            points: doc_i64(d, "points"),
            conversations_resolved: doc_i64(d, "conversationsResolved"),
            csat_avg: d
                .get_f64("csatAvg")
                .ok()
                .or_else(|| d.get_i32("csatAvg").ok().map(f64::from))
                .or_else(|| d.get_i64("csatAvg").ok().map(|n| n as f64)),
            rank: (i as i64) + 1,
        })
        .collect();

    Ok(Json(LeaderboardResponse {
        period,
        period_key,
        rows,
    }))
}

// ===========================================================================
// GET /agents/{agentId}/badges — agent_badges
// ===========================================================================

/// `GET /v1/sabchat/gamification/agents/{agentId}/badges` — list every
/// badge the agent has been awarded, newest first.
#[instrument(skip_all, fields(tenant = %user.tenant_id, agent_id = %agent_id))]
pub async fn agent_badges(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Path(agent_id): Path<String>,
) -> Result<Json<AgentBadgesResponse>> {
    let tenant = tenant_oid(&user)?;
    let agent_oid =
        oid_from_str(&agent_id).map_err(|_| ApiError::BadRequest("Invalid agentId.".to_owned()))?;

    let badges = load_agent_badges(&state.mongo, tenant, agent_oid).await?;

    Ok(Json(AgentBadgesResponse {
        agent_id: agent_oid.to_hex(),
        badges,
    }))
}

/// Shared loader used by `agent_badges` + `agent_stats`.
async fn load_agent_badges(
    mongo: &MongoHandle,
    tenant: ObjectId,
    agent_oid: ObjectId,
) -> Result<Vec<AgentBadgeRow>> {
    let coll = mongo.collection::<Document>(AGENT_BADGES_COLL);
    let cursor = coll
        .find(doc! { "tenantId": tenant, "agentId": agent_oid })
        .with_options(
            FindOptions::builder()
                .sort(doc! { "awardedAt": -1 })
                .build(),
        )
        .await
        .map_err(mongo_err("sabchat_gamification.agent_badges.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_gamification.agent_badges.collect"))?;

    Ok(docs
        .iter()
        .map(|d| AgentBadgeRow {
            code: d.get_str("badgeCode").unwrap_or("").to_owned(),
            awarded_at: doc_iso_dt(d, "awardedAt"),
        })
        .collect())
}

// ===========================================================================
// GET /agents/{agentId}/stats — agent_stats
// ===========================================================================

/// `GET /v1/sabchat/gamification/agents/{agentId}/stats` — combined
/// snapshot: leaderboard row + badge ledger for the requested period.
#[instrument(skip_all, fields(tenant = %user.tenant_id, agent_id = %agent_id))]
pub async fn agent_stats(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Path(agent_id): Path<String>,
    Query(query): Query<AgentStatsQuery>,
) -> Result<Json<AgentStatsResponse>> {
    let tenant = tenant_oid(&user)?;
    let agent_oid =
        oid_from_str(&agent_id).map_err(|_| ApiError::BadRequest("Invalid agentId.".to_owned()))?;
    let period = query.period.unwrap_or_default();
    let period_key = period_key_for(period, Utc::now());

    let points_coll = state.mongo.collection::<Document>(AGENT_POINTS_COLL);
    let row = points_coll
        .find_one(doc! {
            "tenantId": tenant,
            "agentId": agent_oid,
            "period": period.as_wire(),
            "periodKey": &period_key,
        })
        .await
        .map_err(mongo_err("sabchat_gamification.agent_stats.find"))?;

    let (points, conversations_resolved, csat_avg) = match row.as_ref() {
        Some(d) => (
            doc_i64(d, "points"),
            doc_i64(d, "conversationsResolved"),
            d.get_f64("csatAvg")
                .ok()
                .or_else(|| d.get_i32("csatAvg").ok().map(f64::from))
                .or_else(|| d.get_i64("csatAvg").ok().map(|n| n as f64)),
        ),
        None => (0, 0, None),
    };

    let badges = load_agent_badges(&state.mongo, tenant, agent_oid).await?;

    Ok(Json(AgentStatsResponse {
        agent_id: agent_oid.to_hex(),
        period,
        period_key,
        points,
        conversations_resolved,
        csat_avg,
        badges,
    }))
}

// ===========================================================================
// POST /recompute — recompute
// ===========================================================================

/// `POST /v1/sabchat/gamification/recompute` — walk all resolved
/// conversations in the current week + current month + all-time,
/// re-score them, and upsert the three per-(period, agent) leaderboard
/// rows.
///
/// Reads:
///
/// - `sabchat_conversations` filtered by `tenantId` and
///   `status == "resolved"` with an `assigneeId` set.
/// - `sabchat_survey_responses` looked up by `conversationId` for the
///   CSAT bonus / average.
///
/// Writes the recomputed rows to `sabchat_agent_points`. The week +
/// month windows clear `sabchat_agent_points` rows for any agent that
/// did not contribute (so a fresh week starts at zero rather than
/// inheriting last week's totals).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn recompute(
    user: AuthUser,
    State(state): State<SabChatGamificationState>,
    Json(_body): Json<RecomputeBody>,
) -> Result<Json<RecomputeResponse>> {
    let tenant = tenant_oid(&user)?;
    let now = Utc::now();

    // ---- Load CSAT survey responses indexed by conversationId -------
    //
    // The survey collection is small enough to hash in memory per
    // tenant. Pull `(conversationId → score)` once and re-use it across
    // the three period passes.
    let surveys = state.mongo.collection::<Document>(SURVEY_RESPONSES_COLL);
    let cursor = surveys
        .find(doc! { "tenantId": tenant })
        .await
        .map_err(mongo_err("sabchat_gamification.recompute.surveys.find"))?;
    let survey_docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(mongo_err("sabchat_gamification.recompute.surveys.collect"))?;
    let mut csat_by_conv: HashMap<ObjectId, u8> = HashMap::with_capacity(survey_docs.len());
    for d in &survey_docs {
        let Ok(conv_id) = d.get_object_id("conversationId") else {
            continue;
        };
        // Score may be persisted as i32 / i64 / f64 — normalise to u8.
        let score = d
            .get_i32("score")
            .ok()
            .map(i64::from)
            .or_else(|| d.get_i64("score").ok())
            .or_else(|| d.get_f64("score").ok().map(|f| f.round() as i64));
        if let Some(s) = score {
            if (1..=5).contains(&s) {
                csat_by_conv.insert(conv_id, s as u8);
            }
        }
    }

    // ---- Load resolved conversations --------------------------------
    let conv_coll = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let cursor = conv_coll
        .find(doc! {
            "tenantId": tenant,
            "status": "resolved",
            "assigneeId": { "$exists": true, "$ne": Bson::Null },
        })
        .await
        .map_err(mongo_err(
            "sabchat_gamification.recompute.conversations.find",
        ))?;
    let conv_docs: Vec<Document> = cursor.try_collect().await.map_err(mongo_err(
        "sabchat_gamification.recompute.conversations.collect",
    ))?;

    let scanned = conv_docs.len() as i64;

    // Per-period running totals: BTreeMap → deterministic order in
    // `.iter()` for the upserts below.
    struct AgentTotals {
        points: i64,
        resolved: i64,
        csat_sum: i64,
        csat_n: i64,
        first_response_sum_min: f64,
        first_response_n: i64,
    }
    impl AgentTotals {
        fn new() -> Self {
            Self {
                points: 0,
                resolved: 0,
                csat_sum: 0,
                csat_n: 0,
                first_response_sum_min: 0.0,
                first_response_n: 0,
            }
        }
    }

    let mut all_time: BTreeMap<ObjectId, AgentTotals> = BTreeMap::new();
    let mut month: BTreeMap<ObjectId, AgentTotals> = BTreeMap::new();
    let mut week: BTreeMap<ObjectId, AgentTotals> = BTreeMap::new();

    let (month_from, _) = period_window(Period::Month, now);
    let (week_from, _) = period_window(Period::Week, now);

    for d in &conv_docs {
        let Ok(conv_id) = d.get_object_id("_id") else {
            continue;
        };
        let Ok(agent_oid) = d.get_object_id("assigneeId") else {
            continue;
        };

        let resolved_at = d
            .get_datetime("resolvedAt")
            .ok()
            .map(|b| b.to_chrono())
            .or_else(|| d.get_datetime("updatedAt").ok().map(|b| b.to_chrono()));

        let csat_score = csat_by_conv.get(&conv_id).copied();
        let sla_breached = d
            .get_document("sla")
            .ok()
            .and_then(|sla| sla.get_bool("breached").ok())
            .unwrap_or(false);

        let pts = points_for_conversation(ConversationOutcome {
            csat_score,
            sla_breached,
        });

        // first-response latency in minutes, if available.
        let first_response_min = match (
            d.get_datetime("firstResponseAt")
                .ok()
                .map(|b| b.to_chrono()),
            d.get_datetime("createdAt").ok().map(|b| b.to_chrono()),
        ) {
            (Some(fr), Some(c)) if fr >= c => Some((fr - c).num_milliseconds() as f64 / 60_000.0),
            _ => None,
        };

        let apply = |bucket: &mut BTreeMap<ObjectId, AgentTotals>| {
            let entry = bucket.entry(agent_oid).or_insert_with(AgentTotals::new);
            entry.points += pts;
            entry.resolved += 1;
            if let Some(s) = csat_score {
                entry.csat_sum += s as i64;
                entry.csat_n += 1;
            }
            if let Some(frm) = first_response_min {
                entry.first_response_sum_min += frm;
                entry.first_response_n += 1;
            }
        };

        apply(&mut all_time);
        if let Some(rt) = resolved_at {
            if rt >= month_from {
                apply(&mut month);
            }
            if rt >= week_from {
                apply(&mut week);
            }
        }
    }

    // ---- Upsert leaderboard rows ------------------------------------
    //
    // We do NOT delete absent rows here — leaderboards keep historical
    // period_keys around. Within the active period the upsert is
    // authoritative for the agents that contributed; agents who logged
    // zero work this period naturally remain absent from the active
    // `period_key` and therefore from the leaderboard `find` query.
    let points_coll = state.mongo.collection::<Document>(AGENT_POINTS_COLL);
    let mut updated_rows: i64 = 0;
    let now_b = to_bson_dt(now);

    for (period, bucket) in [
        (Period::AllTime, &all_time),
        (Period::Month, &month),
        (Period::Week, &week),
    ] {
        let period_key = period_key_for(period, now);
        for (agent_oid_ref, totals) in bucket {
            let agent_oid = *agent_oid_ref;
            let csat_avg: Option<f64> = if totals.csat_n > 0 {
                Some((totals.csat_sum as f64) / (totals.csat_n as f64))
            } else {
                None
            };
            let fr_avg: Option<f64> = if totals.first_response_n > 0 {
                Some(totals.first_response_sum_min / (totals.first_response_n as f64))
            } else {
                None
            };

            let mut set = doc! {
                "tenantId": tenant,
                "agentId": agent_oid,
                "period": period.as_wire(),
                "periodKey": &period_key,
                "points": totals.points,
                "conversationsResolved": totals.resolved,
                "lastUpdatedAt": now_b,
            };
            if let Some(c) = csat_avg {
                set.insert("csatAvg", c);
            } else {
                set.insert("csatAvg", Bson::Null);
            }
            if let Some(fr) = fr_avg {
                set.insert("firstResponseAvgMin", fr);
            } else {
                set.insert("firstResponseAvgMin", Bson::Null);
            }

            points_coll
                .update_one(
                    doc! {
                        "tenantId": tenant,
                        "agentId": agent_oid,
                        "period": period.as_wire(),
                        "periodKey": &period_key,
                    },
                    doc! { "$set": set },
                )
                .upsert(true)
                .await
                .map_err(mongo_err("sabchat_gamification.recompute.upsert"))?;
            updated_rows += 1;
        }
    }

    Ok(Json(RecomputeResponse {
        scanned,
        updated_rows,
    }))
}

// ===========================================================================
// Tiny inline tests — unit-only, no Mongo.
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn period_key_all_time_is_literal_all() {
        let now = Utc.with_ymd_and_hms(2026, 5, 27, 0, 0, 0).single().unwrap();
        assert_eq!(period_key_for(Period::AllTime, now), "all");
    }

    #[test]
    fn period_key_month_uses_year_month() {
        let now = Utc
            .with_ymd_and_hms(2026, 5, 27, 12, 0, 0)
            .single()
            .unwrap();
        assert_eq!(period_key_for(Period::Month, now), "2026-05");
    }

    #[test]
    fn period_key_week_uses_iso_week() {
        // 2026-05-27 is a Wednesday — falls in ISO week 22 of 2026.
        let now = Utc
            .with_ymd_and_hms(2026, 5, 27, 12, 0, 0)
            .single()
            .unwrap();
        let key = period_key_for(Period::Week, now);
        assert!(
            key.starts_with("2026-W") && key.len() == "2026-W22".len(),
            "unexpected week key {key}"
        );
    }

    #[test]
    fn period_window_week_starts_monday() {
        // 2026-05-27 is Wed → Mon 2026-05-25 00:00Z.
        let now = Utc
            .with_ymd_and_hms(2026, 5, 27, 12, 0, 0)
            .single()
            .unwrap();
        let (from, _) = period_window(Period::Week, now);
        assert_eq!(from.year(), 2026);
        assert_eq!(from.month(), 5);
        assert_eq!(from.day(), 25);
        assert_eq!(from.weekday(), chrono::Weekday::Mon);
    }
}
