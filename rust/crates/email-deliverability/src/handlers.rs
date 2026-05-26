//! HTTP handlers for the email-deliverability surface.
//!
//! Conventions:
//!
//! - Every handler returns `Result<Json<T>, ApiError>` and is wrapped in
//!   `tracing::instrument`.
//! - Tenancy is enforced by scoping every Mongo filter by
//!   `user_id = AuthUser.tenant_id`.
//! - Mongo errors are wrapped through `anyhow::Error::context(...)` so
//!   the failure surface from the driver carries useful breadcrumbs.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::instrument;

use crate::dkim::{DEFAULT_DKIM_BITS, generate_dkim_keypair};
use crate::dns::check_domain as run_dns_check;
use crate::dto::{
    CheckDomainQuery, DkimGenerateBody, DkimGenerateResponse, DkimRotateResponse, DnsSnapshot,
    DomainRow, ListDomainsResponse, MessageResponse, PlacementResponse, RunPlacementBody,
    RunPlacementResponse, ScoreResponse, StartWarmupBody, UpdateWarmupBody, WarmupDay,
    WarmupListResponse, WarmupRun,
};
use crate::state::EmailDeliverabilityState;

// Collection names — kept inline for readability.
const SNAPSHOTS_COLL: &str = "email_dns_snapshots";
const SETTINGS_COLL: &str = "email_settings";
const WARMUP_COLL: &str = "email_warmup_runs";
const PLACEMENT_COLL: &str = "email_placement_tests";
const EVENTS_COLL: &str = "email_events";

// ===========================================================================
// Helpers
// ===========================================================================

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn dt_to_rfc3339(dt: bson::DateTime) -> String {
    dt.try_to_rfc3339_string()
        .unwrap_or_else(|_| dt.to_chrono().to_rfc3339())
}

fn random_selector() -> String {
    // 8 hex chars; ~32 bits of entropy is plenty for a DNS selector since
    // a clash inside a single tenant is a UX issue rather than a security
    // one.
    let mut s = String::with_capacity(11);
    s.push_str("sab");
    for _ in 0..8 {
        let nibble: u8 = rand::random::<u8>() & 0x0f;
        s.push(char::from_digit(nibble as u32, 16).unwrap_or('0'));
    }
    s
}

// ===========================================================================
// Domains + DNS check
// ===========================================================================

/// `GET /domains` — return the set of domains the tenant has touched
/// (anything they've ever run a DNS check on, plus their configured
/// `email_settings.senderDomain` if any).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_domains(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
) -> Result<Json<ListDomainsResponse>> {
    let coll = state.mongo.collection::<Document>(SNAPSHOTS_COLL);
    let filter = doc! { "userId": &user.tenant_id };
    let opts = FindOptions::builder()
        .sort(doc! { "checkedAt": -1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("snapshots.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("snapshots.collect")))?;

    let mut seen: std::collections::BTreeMap<String, DomainRow> = std::collections::BTreeMap::new();
    for d in docs {
        let Ok(domain) = d.get_str("domain") else {
            continue;
        };
        if seen.contains_key(domain) {
            continue;
        }
        let last_score = d.get_i32("score").ok().map(|v| v.clamp(0, 100) as u8);
        let last_checked_at = d
            .get_datetime("checkedAt")
            .ok()
            .map(|dt| dt_to_rfc3339(*dt));
        seen.insert(
            domain.to_owned(),
            DomainRow {
                domain: domain.to_owned(),
                last_score,
                last_checked_at,
            },
        );
    }

    Ok(Json(ListDomainsResponse {
        domains: seen.into_values().collect(),
    }))
}

/// `POST /domains/{domain}/check?selector=...` — run a live DNS check
/// and persist the snapshot.
#[instrument(skip_all, fields(tenant = %user.tenant_id, domain = %domain))]
pub async fn check_domain(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Path(domain): Path<String>,
    Query(q): Query<CheckDomainQuery>,
) -> Result<Json<DnsSnapshot>> {
    let selector_owned = q.selector.clone();
    let selector = selector_owned.as_deref();
    let snapshot = run_dns_check(&domain, selector)
        .await
        .map_err(|e| ApiError::Internal(e.context("run_dns_check")))?;

    let snapshot_doc = bson::to_document(&snapshot).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("snapshot -> bson::Document"))
    })?;

    let mut to_insert = snapshot_doc.clone();
    to_insert.insert("_id", ObjectId::new());
    to_insert.insert("userId", &user.tenant_id);
    to_insert.insert("checkedAt", now_bson());

    let coll = state.mongo.collection::<Document>(SNAPSHOTS_COLL);
    coll.insert_one(to_insert).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_dns_snapshots.insert_one"))
    })?;

    Ok(Json(snapshot))
}

// ===========================================================================
// DKIM generate + rotate
// ===========================================================================

/// `POST /domains/{domain}/dkim/generate` — generate a new keypair and
/// stash it under `email_settings.dkim.pending`.
#[instrument(skip_all, fields(tenant = %user.tenant_id, domain = %domain))]
pub async fn dkim_generate(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Path(domain): Path<String>,
    Json(body): Json<DkimGenerateBody>,
) -> Result<Json<DkimGenerateResponse>> {
    let bits = body.bits.unwrap_or(DEFAULT_DKIM_BITS as u32) as usize;
    let (private_pem, dns_record, normalised_bits) = generate_dkim_keypair(bits)
        .map_err(|e| ApiError::Internal(e.context("generate_dkim_keypair")))?;

    let selector = body
        .selector
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(random_selector);

    let coll = state.mongo.collection::<Document>(SETTINGS_COLL);
    coll.update_one(
        doc! {
            "userId": &user.tenant_id,
            "domain": &domain,
        },
        doc! {
            "$set": {
                "dkim.pending": {
                    "selector": &selector,
                    "privateKey": &private_pem,
                    "dnsRecord": &dns_record,
                    "bits": normalised_bits as i32,
                    "createdAt": now_bson(),
                }
            },
            "$setOnInsert": {
                "userId": &user.tenant_id,
                "domain": &domain,
                "createdAt": now_bson(),
            }
        },
    )
    .upsert(true)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_settings.dkim.pending")))?;

    Ok(Json(DkimGenerateResponse {
        selector,
        private_key: private_pem,
        dns_record,
        bits: normalised_bits,
    }))
}

/// `POST /domains/{domain}/dkim/rotate` — promote `dkim.pending` to
/// `dkim.active`. The old active key (if any) is moved to
/// `dkim.rotating` with a `rotatingUntil` 7 days in the future so the
/// signing service can keep accepting messages signed by the old key for
/// in-flight queues.
#[instrument(skip_all, fields(tenant = %user.tenant_id, domain = %domain))]
pub async fn dkim_rotate(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Path(domain): Path<String>,
) -> Result<Json<DkimRotateResponse>> {
    let coll = state.mongo.collection::<Document>(SETTINGS_COLL);
    let existing = coll
        .find_one(doc! { "userId": &user.tenant_id, "domain": &domain })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_settings.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("email_settings for domain {domain}")))?;

    let dkim = existing.get_document("dkim").cloned().unwrap_or_default();
    let pending = dkim
        .get_document("pending")
        .cloned()
        .map_err(|_| ApiError::BadRequest("no pending DKIM key to rotate".to_owned()))?;
    let active = dkim.get_document("active").cloned().ok();

    let new_selector = pending
        .get_str("selector")
        .map_err(|_| ApiError::BadRequest("pending DKIM missing selector".to_owned()))?
        .to_owned();
    let prev_selector = active
        .as_ref()
        .and_then(|a| a.get_str("selector").ok())
        .map(|s| s.to_owned());

    let rotating_until = bson::DateTime::from_chrono(Utc::now() + chrono::Duration::days(7));

    let mut set_doc = doc! {
        "dkim.active": pending.clone(),
        "dkim.pending": Bson::Null,
        "updatedAt": now_bson(),
    };
    if let Some(prev) = active {
        let mut rotating = prev;
        rotating.insert("rotatingUntil", rotating_until);
        set_doc.insert("dkim.rotating", rotating);
    }

    coll.update_one(
        doc! { "userId": &user.tenant_id, "domain": &domain },
        doc! { "$set": set_doc },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("email_settings.dkim.rotate.update"))
    })?;

    Ok(Json(DkimRotateResponse {
        active_selector: new_selector,
        rotating_selector: prev_selector,
    }))
}

// ===========================================================================
// Warmup
// ===========================================================================

/// `GET /warmup` — list active warmup runs for the tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_warmup(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
) -> Result<Json<WarmupListResponse>> {
    let coll = state.mongo.collection::<Document>(WARMUP_COLL);
    let cursor = coll
        .find(doc! {
            "userId": &user.tenant_id,
            "status": { "$in": ["pending", "running", "paused"] },
        })
        .sort(doc! { "startedAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("warmup.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("warmup.collect")))?;
    let runs = docs.into_iter().map(doc_to_warmup).collect();
    Ok(Json(WarmupListResponse { runs }))
}

/// `POST /warmup` — start a new warmup. The schedule the caller passes
/// is persisted as-is; if it's empty we synthesize a 30-day Mailchimp-
/// style ramp.
#[instrument(skip_all, fields(tenant = %user.tenant_id, domain = %body.domain))]
pub async fn start_warmup(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Json(body): Json<StartWarmupBody>,
) -> Result<Json<WarmupRun>> {
    let trimmed = body.domain.trim();
    if trimmed.is_empty() {
        return Err(ApiError::BadRequest("domain is required".to_owned()));
    }

    let schedule = if body.schedule.is_empty() {
        default_warmup_schedule()
    } else {
        body.schedule
    };

    let id = ObjectId::new();
    let schedule_bson: Vec<Bson> = schedule
        .iter()
        .map(|d| {
            let mut row = doc! { "day": d.day as i32, "cap": d.cap as i32 };
            if let Some(s) = d.sent_today {
                row.insert("sentToday", s as i32);
            }
            Bson::Document(row)
        })
        .collect();

    let now = now_bson();
    let doc = doc! {
        "_id": id,
        "userId": &user.tenant_id,
        "domain": trimmed,
        "status": "pending",
        "schedule": Bson::Array(schedule_bson),
        "currentDay": 1_i32,
        "startedAt": now,
        "notes": body.notes.clone(),
    };

    let coll = state.mongo.collection::<Document>(WARMUP_COLL);
    coll.insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("warmup.insert_one")))?;

    Ok(Json(WarmupRun {
        id: id.to_hex(),
        domain: trimmed.to_owned(),
        status: "pending".to_owned(),
        schedule,
        current_day: 1,
        started_at: Utc::now().to_rfc3339(),
        completed_at: None,
        notes: body.notes,
    }))
}

/// `PATCH /warmup/{id}` — pause / resume / cancel.
#[instrument(skip_all, fields(tenant = %user.tenant_id, id = %id))]
pub async fn update_warmup(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWarmupBody>,
) -> Result<Json<MessageResponse>> {
    let oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("invalid warmup id".to_owned()))?;

    let next_status = match body.action.as_str() {
        "pause" => "paused",
        "resume" => "running",
        "cancel" => "completed",
        other => {
            return Err(ApiError::BadRequest(format!(
                "unknown warmup action `{other}`"
            )));
        }
    };

    let mut set = doc! { "status": next_status };
    if next_status == "completed" {
        set.insert("completedAt", now_bson());
    }

    let coll = state.mongo.collection::<Document>(WARMUP_COLL);
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": &user.tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("warmup.update_one")))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound(format!("warmup run {id}")));
    }
    Ok(Json(MessageResponse {
        message: format!("warmup {} -> {}", id, next_status),
    }))
}

fn default_warmup_schedule() -> Vec<WarmupDay> {
    // Mailchimp-style ramp: start at 50/day, double every ~3 days, cap
    // at 50k by day 30. The numbers are deliberately conservative — the
    // operator can tune via the JSON body.
    let caps = [
        50u32, 100, 200, 400, 800, 1_500, 3_000, 5_000, 8_000, 12_000, 16_000, 20_000, 25_000,
        30_000, 35_000, 40_000, 45_000, 50_000, 50_000, 50_000, 50_000, 50_000, 50_000, 50_000,
        50_000, 50_000, 50_000, 50_000, 50_000, 50_000,
    ];
    caps.iter()
        .enumerate()
        .map(|(i, cap)| WarmupDay {
            day: (i as u32) + 1,
            cap: *cap,
            sent_today: None,
        })
        .collect()
}

fn doc_to_warmup(d: Document) -> WarmupRun {
    let id = d
        .get_object_id("_id")
        .map(|o| o.to_hex())
        .unwrap_or_default();
    let domain = d.get_str("domain").unwrap_or_default().to_owned();
    let status = d.get_str("status").unwrap_or("pending").to_owned();
    let current_day = d.get_i32("currentDay").unwrap_or(1).max(0) as u32;
    let started_at = d
        .get_datetime("startedAt")
        .ok()
        .map(|dt| dt_to_rfc3339(*dt))
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let completed_at = d.get_datetime("completedAt").ok().map(|dt| dt_to_rfc3339(*dt));
    let notes = d.get_str("notes").ok().map(|s| s.to_owned());
    let schedule = d
        .get_array("schedule")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| {
                    let row = b.as_document()?;
                    Some(WarmupDay {
                        day: row.get_i32("day").unwrap_or(0).max(0) as u32,
                        cap: row.get_i32("cap").unwrap_or(0).max(0) as u32,
                        sent_today: row.get_i32("sentToday").ok().map(|v| v.max(0) as u32),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    WarmupRun {
        id,
        domain,
        status,
        schedule,
        current_day,
        started_at,
        completed_at,
        notes,
    }
}

// ===========================================================================
// Placement test
// ===========================================================================

/// `GET /placement` — return the most recent placement test for the tenant.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn get_placement(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
) -> Result<Json<PlacementResponse>> {
    let coll = state.mongo.collection::<Document>(PLACEMENT_COLL);
    let doc_opt = coll
        .find_one(doc! { "userId": &user.tenant_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("placement.find_one")))?;

    let last = match doc_opt {
        Some(d) => Some(doc_to_json(&d)?),
        None => None,
    };
    Ok(Json(PlacementResponse { last }))
}

/// `POST /placement/run` — record the intent to run a placement test.
/// The real seedlist integration will land in a later phase; for now
/// this just persists a `pending` doc the dashboard can render.
#[instrument(skip_all, fields(tenant = %user.tenant_id, domain = %body.domain))]
pub async fn run_placement(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
    Json(body): Json<RunPlacementBody>,
) -> Result<Json<RunPlacementResponse>> {
    if body.domain.trim().is_empty() {
        return Err(ApiError::BadRequest("domain is required".to_owned()));
    }

    let id = ObjectId::new();
    let now = now_bson();
    let doc = doc! {
        "_id": id,
        "userId": &user.tenant_id,
        "domain": body.domain.trim(),
        "campaignId": body.campaign_id.clone(),
        "status": "pending",
        "createdAt": now,
    };
    let coll = state.mongo.collection::<Document>(PLACEMENT_COLL);
    coll.insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("placement.insert_one")))?;

    Ok(Json(RunPlacementResponse {
        id: id.to_hex(),
        status: "pending".to_owned(),
    }))
}

// ===========================================================================
// Score rollup
// ===========================================================================

/// `GET /score` — rolled-up deliverability score. The DNS half uses the
/// most-recent snapshot per domain (averaged); the events half uses the
/// bounce / complaint ratio over the last 30 days of `email_events`.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn get_score(
    user: AuthUser,
    State(state): State<EmailDeliverabilityState>,
) -> Result<Json<ScoreResponse>> {
    let window_days: u32 = 30;
    let since = bson::DateTime::from_chrono(Utc::now() - chrono::Duration::days(window_days as i64));

    let snapshots = state.mongo.collection::<Document>(SNAPSHOTS_COLL);
    let cursor = snapshots
        .find(doc! { "userId": &user.tenant_id })
        .sort(doc! { "checkedAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("score.snapshots.find")))?;
    let snap_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("score.snapshots.collect"))
    })?;

    let mut latest_by_domain: std::collections::BTreeMap<String, i32> =
        std::collections::BTreeMap::new();
    for d in snap_docs {
        let Ok(domain) = d.get_str("domain") else {
            continue;
        };
        if latest_by_domain.contains_key(domain) {
            continue;
        }
        let s = d.get_i32("score").unwrap_or(0);
        latest_by_domain.insert(domain.to_owned(), s.clamp(0, 100));
    }
    let dns_score: u8 = if latest_by_domain.is_empty() {
        0
    } else {
        let sum: i32 = latest_by_domain.values().sum();
        ((sum / latest_by_domain.len() as i32).clamp(0, 100)) as u8
    };

    // Events half — count send / bounce / complaint in the last 30 days.
    let events = state.mongo.collection::<Document>(EVENTS_COLL);
    let sent = events
        .count_documents(doc! {
            "userId": &user.tenant_id,
            "kind": { "$in": ["send", "delivered"] },
            "occurredAt": { "$gte": since },
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("score.events.sent")))?;
    let bounces = events
        .count_documents(doc! {
            "userId": &user.tenant_id,
            "kind": { "$in": ["bounce_hard", "bounce_soft"] },
            "occurredAt": { "$gte": since },
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("score.events.bounces")))?;
    let complaints = events
        .count_documents(doc! {
            "userId": &user.tenant_id,
            "kind": "complaint",
            "occurredAt": { "$gte": since },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("score.events.complaints"))
        })?;

    let (bounce_rate, complaint_rate) = if sent == 0 {
        (0.0, 0.0)
    } else {
        (
            bounces as f64 / sent as f64,
            complaints as f64 / sent as f64,
        )
    };

    // Events score: start at 100, dock 200 * bounce_rate (so 5% bounce =
    // -10) and 1000 * complaint_rate (so 0.1% complaint = -1). Clamp.
    let events_score = (100.0 - bounce_rate * 200.0 - complaint_rate * 1000.0)
        .clamp(0.0, 100.0) as u8;

    // Combined: DNS 60%, events 40%.
    let combined = ((dns_score as f64) * 0.6 + (events_score as f64) * 0.4).round() as u8;

    Ok(Json(ScoreResponse {
        score: combined,
        dns_score,
        bounce_rate,
        complaint_rate,
        window_days,
    }))
}

// ===========================================================================
// Tiny utility — Document -> serde_json::Value via BSON canonicalisation
// ===========================================================================

fn doc_to_json(d: &Document) -> Result<Value> {
    let bson = Bson::Document(d.clone());
    serde_json::to_value(bson).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("bson::Document -> serde_json::Value"))
    })
}

// Suppress unused warning when MongoHandle is only used through state.
#[allow(dead_code)]
fn _types(_: &MongoHandle) {}

// ===========================================================================
// Webhooks (SES / Sendgrid)
// ===========================================================================

async fn resolve_provider_token(
    mongo: &sabnode_db::mongo::MongoHandle,
    provider: &str,
    token: &str,
) -> Result<String> {
    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let path = format!("providerSecrets.{}", provider);
    let d = coll
        .find_one(doc! { &path: token })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_settings.find_one")))?
        .ok_or_else(|| ApiError::Unauthorized("invalid provider token".to_owned()))?;
    let user_id = d
        .get_object_id("userId")
        .map(|o| o.to_hex())
        .or_else(|_| d.get_str("userId").map(|s| s.to_owned()))
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("email_settings.userId missing")))?;
    Ok(user_id)
}

#[instrument(skip_all, fields(provider = "ses"))]
pub async fn ses_webhook(
    State(state): State<EmailDeliverabilityState>,
    Path(token): Path<String>,
    Json(payload): Json<Value>,
) -> Result<Json<MessageResponse>> {
    let _tenant_id = resolve_provider_token(&state.mongo, "ses", &token).await?;

    // SES sends an SNS envelope. If it's a Bounce, we pause warmups for the domain.
    // The message is embedded as a JSON string in payload["Message"].
    if let Some(msg_str) = payload.get("Message").and_then(|v| v.as_str()) {
        if let Ok(msg) = serde_json::from_str::<Value>(msg_str) {
            let event_type = msg.get("notificationType").or(msg.get("eventType")).and_then(|v| v.as_str()).unwrap_or("");
            if event_type == "Bounce" || event_type == "Complaint" {
                if let Some(mail) = msg.get("mail") {
                    if let Some(source) = mail.get("source").and_then(|v| v.as_str()) {
                        let domain = source.split('@').last().unwrap_or(source);
                        let coll = state.mongo.collection::<Document>(WARMUP_COLL);
                        let _ = coll.update_many(
                            doc! { "userId": &_tenant_id, "domain": domain },
                            doc! { "$set": { "status": "paused" } }
                        ).await;
                    }
                }
            }
        }
    }

    Ok(Json(MessageResponse {
        message: "ok".to_owned(),
    }))
}

#[instrument(skip_all, fields(provider = "sendgrid"))]
pub async fn sendgrid_webhook(
    State(state): State<EmailDeliverabilityState>,
    Path(token): Path<String>,
    Json(events): Json<Vec<Value>>,
) -> Result<Json<MessageResponse>> {
    let _tenant_id = resolve_provider_token(&state.mongo, "sendgrid", &token).await?;

    for event in events {
        let event_type = event.get("event").and_then(|v| v.as_str()).unwrap_or("");
        if event_type == "bounce" || event_type == "spamreport" || event_type == "dropped" {
            // Sendgrid doesn't provide the sender domain natively in the bounce payload
            // but we can extract it from the 'email' if we assume bouncing to the same domain? No.
            // Usually, custom args could pass domain, but if missing, we just pause all active warmups?
            // Actually, if we get a bounce, we might check if 'sg_message_id' matches something?
            // Let's try to extract domain from a custom arg if available.
            if let Some(domain) = event.get("domain").and_then(|v| v.as_str()) {
                let coll = state.mongo.collection::<Document>(WARMUP_COLL);
                let _ = coll.update_many(
                    doc! { "userId": &_tenant_id, "domain": domain },
                    doc! { "$set": { "status": "paused" } }
                ).await;
            }
        }
    }

    Ok(Json(MessageResponse {
        message: "ok".to_owned(),
    }))
}
