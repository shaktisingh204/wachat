//! Axum handlers for `/v1/email/events`.
//!
//! Provider webhooks are **un-authenticated** (HTTP-wise) — providers
//! cannot present a JWT. Provenance is validated by matching the
//! `{token}` path parameter against
//! `email_settings.providerSecrets.<provider>` for the addressed
//! tenant.
//!
//! The tracking pixel + redirect handlers are also un-authenticated;
//! they verify a signed token (HMAC-SHA256).
//!
//! Only `GET /` (list events) requires a JWT.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Redirect, Response},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use email_types::collections::{EVENTS as EVENTS_COLL, SETTINGS, SUPPRESSIONS};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde_json::{Value, json};
use tracing::{instrument, warn};

use crate::dto::{
    BrevoEvent, EventRow, IngestAck, ListEventsQuery, ListEventsResponse, MailgunEvent,
    PostmarkBatch, PostmarkEvent, SendgridEvent, SesNotification, SnsEnvelope,
};
use crate::fanout::fanout;
use crate::state::EmailEventsState;
use crate::tracking::{TrackingPayload, decode, load_secret};

/// 1x1 transparent PNG — bytes baked at compile time so the handler
/// never touches the filesystem.
///
/// (35-byte minimal PNG.)
const TRACKING_PIXEL: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    0x00, 0x00, 0x00, 0x01, // width 1
    0x00, 0x00, 0x00, 0x01, // height 1
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth / colour type / etc.
    0x1F, 0x15, 0xC4, 0x89, // IHDR CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT length
    0x49, 0x44, 0x41, 0x54, // "IDAT"
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // zlib stream
    0x0D, 0x0A, 0x2D, 0xB4, // IDAT CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // "IEND"
    0xAE, 0x42, 0x60, 0x82, // IEND CRC
];

// ===========================================================================
// Helpers
// ===========================================================================

/// Resolve a per-tenant provider token. Returns the `userId` (tenant
/// hex) on a hit.
///
/// `email_settings` carries a `providerSecrets` sub-doc shaped:
/// ```json
/// { "sendgrid": "<token>", "mailgun": "<token>", … }
/// ```
async fn resolve_provider_token(
    mongo: &sabnode_db::mongo::MongoHandle,
    provider: &str,
    token: &str,
) -> Result<String> {
    let coll = mongo.collection::<Document>(SETTINGS);
    let path = format!("providerSecrets.{provider}");
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

/// Common shape we build for every normalized event before insert.
struct NormalizedEvent {
    kind: &'static str,
    email: String,
    campaign_id: Option<ObjectId>,
    journey_id: Option<ObjectId>,
    subscriber_id: Option<ObjectId>,
    message_id: Option<String>,
    url: Option<String>,
    user_agent: Option<String>,
    ip: Option<String>,
    reason: Option<String>,
    occurred_at: DateTime<Utc>,
}

fn try_parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}

fn ts_from_seconds(secs: i64) -> DateTime<Utc> {
    Utc.timestamp_opt(secs, 0).single().unwrap_or_else(Utc::now)
}

fn ts_from_rfc3339(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

async fn insert_and_fanout(
    state: &EmailEventsState,
    tenant_id: &str,
    provider: &'static str,
    events: Vec<NormalizedEvent>,
) -> Result<IngestAck> {
    let mongo = state.mongo.clone();
    let http = state.http.clone();
    let tenant_oid = ObjectId::parse_str(tenant_id).ok();
    let tenant_id = tenant_id.to_owned();
    let now = Utc::now();
    let mut accepted: u64 = 0;
    let mut skipped: u64 = 0;
    let mut docs: Vec<Document> = Vec::with_capacity(events.len());
    let mut suppressions: Vec<(String, &'static str)> = Vec::new();
    let mut fanout_payloads: Vec<(String, Value)> = Vec::with_capacity(events.len());

    for ev in events {
        // Drop events that don't carry an email — we can't index or
        // suppress without one.
        if ev.email.is_empty() {
            skipped += 1;
            continue;
        }

        let id = ObjectId::new();
        let user_id_bson = tenant_oid
            .as_ref()
            .map(|o| bson::Bson::ObjectId(*o))
            .unwrap_or_else(|| bson::Bson::String(tenant_id.clone()));

        let mut d = doc! {
            "_id": id,
            "userId": user_id_bson.clone(),
            "kind": ev.kind,
            "email": &ev.email,
            "provider": provider,
            "occurredAt": bson::DateTime::from_chrono(ev.occurred_at),
            "ingestedAt": bson::DateTime::from_chrono(now),
        };
        if let Some(c) = ev.campaign_id {
            d.insert("campaignId", c);
        }
        if let Some(j) = ev.journey_id {
            d.insert("journeyId", j);
        }
        if let Some(s) = ev.subscriber_id {
            d.insert("subscriberId", s);
        }
        if let Some(m) = &ev.message_id {
            d.insert("messageId", m);
        }
        if let Some(u) = &ev.url {
            d.insert("url", u);
        }
        if let Some(ua) = &ev.user_agent {
            d.insert("userAgent", ua);
        }
        if let Some(ip) = &ev.ip {
            d.insert("ip", ip);
        }
        if let Some(r) = &ev.reason {
            d.insert("reason", r);
        }

        // Bounce / complaint → upsert suppression so future sends skip.
        match ev.kind {
            "bounce_hard" => suppressions.push((ev.email.clone(), "bounce")),
            "complaint" => suppressions.push((ev.email.clone(), "complaint")),
            _ => {}
        }

        // Build the outbound payload (camelCase, matches Mongo doc).
        let mut payload = json!({
            "id": id.to_hex(),
            "userId": tenant_id,
            "kind": ev.kind,
            "email": ev.email,
            "provider": provider,
            "occurredAt": ev.occurred_at.to_rfc3339(),
        });
        if let Some(c) = &ev.campaign_id {
            payload["campaignId"] = json!(c.to_hex());
        }
        if let Some(j) = &ev.journey_id {
            payload["journeyId"] = json!(j.to_hex());
        }
        if let Some(s) = &ev.subscriber_id {
            payload["subscriberId"] = json!(s.to_hex());
        }
        if let Some(m) = &ev.message_id {
            payload["messageId"] = json!(m);
        }
        if let Some(u) = &ev.url {
            payload["url"] = json!(u);
        }
        if let Some(r) = &ev.reason {
            payload["reason"] = json!(r);
        }

        fanout_payloads.push((ev.kind.to_owned(), payload));
        docs.push(d);
        accepted += 1;
    }

    if !docs.is_empty() {
        mongo
            .collection::<Document>(EVENTS_COLL)
            .insert_many(docs)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("email_events.insert_many"))
            })?;
    }

    // Upsert suppressions for bounces / complaints.
    if !suppressions.is_empty() {
        let coll = mongo.collection::<Document>(SUPPRESSIONS);
        for (email, reason) in suppressions {
            let user_id_bson = tenant_oid
                .as_ref()
                .map(|o| bson::Bson::ObjectId(*o))
                .unwrap_or_else(|| bson::Bson::String(tenant_id.clone()));
            let _ = coll
                .update_one(
                    doc! { "userId": user_id_bson.clone(), "email": &email },
                    doc! {
                        "$set": {
                            "reason": reason,
                            "updatedAt": bson::DateTime::from_chrono(now),
                        },
                        "$setOnInsert": {
                            "userId": user_id_bson,
                            "email": &email,
                            "createdAt": bson::DateTime::from_chrono(now),
                        },
                    },
                )
                .upsert(true)
                .await;
        }
    }

    // Outbound fan-out is fire-and-forget — never blocks the ack.
    fanout(&mongo, &http, &tenant_id, fanout_payloads).await;

    Ok(IngestAck { accepted, skipped })
}

// ===========================================================================
// Sendgrid
// ===========================================================================

#[instrument(skip_all, fields(provider = "sendgrid"))]
pub async fn ingest_sendgrid(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
    Json(events): Json<Vec<SendgridEvent>>,
) -> Result<Json<IngestAck>> {
    let tenant_id = resolve_provider_token(&state.mongo, "sendgrid", &token).await?;
    let mut normalized: Vec<NormalizedEvent> = Vec::with_capacity(events.len());
    for e in events {
        let Some(kind) = map_sendgrid_kind(&e.event) else {
            continue;
        };
        let email = e.email.clone().unwrap_or_default();
        let occurred_at = e.timestamp.map(ts_from_seconds).unwrap_or_else(Utc::now);
        normalized.push(NormalizedEvent {
            kind,
            email,
            campaign_id: e.campaign_id.as_deref().and_then(try_parse_oid),
            journey_id: e.journey_id.as_deref().and_then(try_parse_oid),
            subscriber_id: e.subscriber_id.as_deref().and_then(try_parse_oid),
            message_id: e.sg_message_id.clone(),
            url: e.url.clone(),
            user_agent: e.useragent.clone(),
            ip: e.ip.clone(),
            reason: e.reason.clone(),
            occurred_at,
        });
    }
    let ack = insert_and_fanout(&state, &tenant_id, "sendgrid", normalized).await?;
    Ok(Json(ack))
}

fn map_sendgrid_kind(s: &str) -> Option<&'static str> {
    Some(match s {
        "processed" => "send",
        "delivered" => "delivered",
        "open" => "open",
        "click" => "click",
        "bounce" => "bounce_hard",
        "soft_bounce" => "bounce_soft",
        "dropped" => "dropped",
        "deferred" => "deferred",
        "spamreport" => "complaint",
        "unsubscribe" | "group_unsubscribe" => "unsubscribe",
        _ => return None,
    })
}

// ===========================================================================
// Mailgun
// ===========================================================================

#[instrument(skip_all, fields(provider = "mailgun"))]
pub async fn ingest_mailgun(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
    axum::extract::Form(e): axum::extract::Form<MailgunEvent>,
) -> Result<Json<IngestAck>> {
    let tenant_id = resolve_provider_token(&state.mongo, "mailgun", &token).await?;
    let Some(kind) = map_mailgun_kind(&e.event) else {
        return Ok(Json(IngestAck {
            accepted: 0,
            skipped: 1,
        }));
    };
    let occurred_at = e
        .timestamp
        .as_deref()
        .and_then(|t| t.parse::<f64>().ok())
        .map(|f| ts_from_seconds(f as i64))
        .unwrap_or_else(Utc::now);
    let normalized = vec![NormalizedEvent {
        kind,
        email: e.recipient.clone().unwrap_or_default(),
        campaign_id: e.campaign_id.as_deref().and_then(try_parse_oid),
        journey_id: e.journey_id.as_deref().and_then(try_parse_oid),
        subscriber_id: e.subscriber_id.as_deref().and_then(try_parse_oid),
        message_id: e.message_id.clone().or(e.message_id_header.clone()),
        url: e.url.clone(),
        user_agent: e.user_agent.clone(),
        ip: e.ip.clone(),
        reason: e.reason.clone(),
        occurred_at,
    }];
    let ack = insert_and_fanout(&state, &tenant_id, "mailgun", normalized).await?;
    Ok(Json(ack))
}

fn map_mailgun_kind(s: &str) -> Option<&'static str> {
    Some(match s {
        "accepted" | "sent" => "send",
        "delivered" => "delivered",
        "opened" => "open",
        "clicked" => "click",
        "bounced" | "failed" => "bounce_hard",
        "complained" => "complaint",
        "unsubscribed" => "unsubscribe",
        "dropped" => "dropped",
        _ => return None,
    })
}

// ===========================================================================
// SES via SNS
// ===========================================================================

#[instrument(skip_all, fields(provider = "ses"))]
pub async fn ingest_ses(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
    Json(envelope): Json<SnsEnvelope>,
) -> Result<Json<IngestAck>> {
    let tenant_id = resolve_provider_token(&state.mongo, "ses", &token).await?;

    // SES → SNS → Notification: the body is a JSON string nested
    // inside the envelope; the SubscriptionConfirmation case is a
    // bootstrap step we ack without processing.
    let kind = envelope.kind.as_deref().unwrap_or("Notification");
    if kind == "SubscriptionConfirmation" {
        return Ok(Json(IngestAck {
            accepted: 0,
            skipped: 0,
        }));
    }

    let Some(msg) = envelope.message else {
        return Ok(Json(IngestAck {
            accepted: 0,
            skipped: 1,
        }));
    };
    let notif: SesNotification = match serde_json::from_str(&msg) {
        Ok(n) => n,
        Err(e) => {
            warn!(?e, "ses: invalid notification body");
            return Ok(Json(IngestAck {
                accepted: 0,
                skipped: 1,
            }));
        }
    };

    let type_str = notif
        .event_type
        .as_deref()
        .or(notif.notification_type.as_deref())
        .unwrap_or("");
    let Some(kind) = map_ses_kind(type_str) else {
        return Ok(Json(IngestAck {
            accepted: 0,
            skipped: 1,
        }));
    };

    let (message_id, destinations, occurred_at) = if let Some(m) = &notif.mail {
        let ts = m
            .timestamp
            .as_deref()
            .map(ts_from_rfc3339)
            .unwrap_or_else(Utc::now);
        (m.message_id.clone(), m.destination.clone(), ts)
    } else {
        (None, vec![], Utc::now())
    };

    let mut normalized: Vec<NormalizedEvent> = Vec::with_capacity(destinations.len().max(1));
    if destinations.is_empty() {
        normalized.push(NormalizedEvent {
            kind,
            email: String::new(),
            campaign_id: None,
            journey_id: None,
            subscriber_id: None,
            message_id,
            url: None,
            user_agent: None,
            ip: None,
            reason: None,
            occurred_at,
        });
    } else {
        for email in destinations {
            normalized.push(NormalizedEvent {
                kind,
                email,
                campaign_id: None,
                journey_id: None,
                subscriber_id: None,
                message_id: message_id.clone(),
                url: None,
                user_agent: None,
                ip: None,
                reason: None,
                occurred_at,
            });
        }
    }

    let ack = insert_and_fanout(&state, &tenant_id, "ses", normalized).await?;
    Ok(Json(ack))
}

fn map_ses_kind(s: &str) -> Option<&'static str> {
    Some(match s {
        "Send" => "send",
        "Delivery" => "delivered",
        "Open" => "open",
        "Click" => "click",
        "Bounce" => "bounce_hard",
        "Complaint" => "complaint",
        "Reject" | "Rendering Failure" => "dropped",
        "DeliveryDelay" => "deferred",
        _ => return None,
    })
}

// ===========================================================================
// Postmark
// ===========================================================================

#[instrument(skip_all, fields(provider = "postmark"))]
pub async fn ingest_postmark(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
    Json(batch): Json<PostmarkBatch>,
) -> Result<Json<IngestAck>> {
    let tenant_id = resolve_provider_token(&state.mongo, "postmark", &token).await?;
    let events: Vec<PostmarkEvent> = match batch {
        PostmarkBatch::One(e) => vec![e],
        PostmarkBatch::Many(v) => v,
    };
    let mut normalized: Vec<NormalizedEvent> = Vec::with_capacity(events.len());
    for e in events {
        let Some(kind) = e.record_type.as_deref().and_then(map_postmark_kind) else {
            continue;
        };
        let email = e.email.clone().or(e.recipient.clone()).unwrap_or_default();
        let (cid, jid, sid) = postmark_ids(&e);
        let occurred_at = e
            .received_at
            .as_deref()
            .map(ts_from_rfc3339)
            .unwrap_or_else(Utc::now);
        normalized.push(NormalizedEvent {
            kind,
            email,
            campaign_id: cid,
            journey_id: jid,
            subscriber_id: sid,
            message_id: e.message_id.clone(),
            url: e.original_link.clone(),
            user_agent: e.user_agent.clone(),
            ip: None,
            reason: e.description.clone(),
            occurred_at,
        });
    }
    let ack = insert_and_fanout(&state, &tenant_id, "postmark", normalized).await?;
    Ok(Json(ack))
}

fn map_postmark_kind(s: &str) -> Option<&'static str> {
    Some(match s {
        "Delivery" => "delivered",
        "Open" => "open",
        "Click" => "click",
        "Bounce" => "bounce_hard",
        "SpamComplaint" => "complaint",
        "SubscriptionChange" => "unsubscribe",
        _ => return None,
    })
}

/// Pull campaign/journey/subscriber ids out of Postmark `Metadata`.
fn postmark_ids(e: &PostmarkEvent) -> (Option<ObjectId>, Option<ObjectId>, Option<ObjectId>) {
    let Some(meta) = &e.metadata else {
        return (None, None, None);
    };
    let get = |k: &str| meta.get(k).and_then(|v| v.as_str()).and_then(try_parse_oid);
    (get("campaignId"), get("journeyId"), get("subscriberId"))
}

// ===========================================================================
// Brevo
// ===========================================================================

#[instrument(skip_all, fields(provider = "brevo"))]
pub async fn ingest_brevo(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
    Json(e): Json<BrevoEvent>,
) -> Result<Json<IngestAck>> {
    let tenant_id = resolve_provider_token(&state.mongo, "brevo", &token).await?;
    let Some(kind) = map_brevo_kind(&e.event) else {
        return Ok(Json(IngestAck {
            accepted: 0,
            skipped: 1,
        }));
    };
    let occurred_at = e.ts.map(ts_from_seconds).unwrap_or_else(Utc::now);
    let normalized = vec![NormalizedEvent {
        kind,
        email: e.email.clone().unwrap_or_default(),
        campaign_id: e.campaign_id.as_deref().and_then(try_parse_oid),
        journey_id: e.journey_id.as_deref().and_then(try_parse_oid),
        subscriber_id: e.subscriber_id.as_deref().and_then(try_parse_oid),
        message_id: e.message_id.clone(),
        url: e.link.clone(),
        user_agent: None,
        ip: None,
        reason: e.reason.clone(),
        occurred_at,
    }];
    let ack = insert_and_fanout(&state, &tenant_id, "brevo", normalized).await?;
    Ok(Json(ack))
}

fn map_brevo_kind(s: &str) -> Option<&'static str> {
    Some(match s {
        "sent" => "send",
        "delivered" => "delivered",
        "opened" | "unique_opened" => "open",
        "click" => "click",
        "soft_bounce" => "bounce_soft",
        "hard_bounce" | "blocked" | "invalid_email" => "bounce_hard",
        "complaint" => "complaint",
        "unsubscribed" => "unsubscribe",
        "deferred" => "deferred",
        _ => return None,
    })
}

// ===========================================================================
// Tracking pixel + click redirect
// ===========================================================================

/// `GET /track/open/{token}` — log an `open` event and serve a 1x1
/// transparent PNG.
///
/// Failures to decode or persist must NOT bubble — we always return
/// the pixel so broken tokens don't surface as visible errors in
/// recipients' inboxes.
#[instrument(skip_all)]
pub async fn track_open(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
) -> Response {
    let secret = load_secret();
    if let Ok(payload) = decode(&secret, &token) {
        record_tracking_event(&state, "open", &payload, None).await;
    }
    let body = axum::body::Body::from(TRACKING_PIXEL);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "no-store, max-age=0")
        .body(body)
        .unwrap_or_else(|_| StatusCode::OK.into_response())
}

/// `GET /track/click/{token}` — log a `click` event and 302-redirect
/// to the URL embedded in the token.
///
/// If the token is invalid we return 404 — a recipient who hit a
/// stale link can't make us serve an open redirect.
#[instrument(skip_all)]
pub async fn track_click(
    State(state): State<EmailEventsState>,
    Path(token): Path<String>,
) -> Response {
    let secret = load_secret();
    let payload = match decode(&secret, &token) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    if payload.u.is_empty() {
        return StatusCode::NOT_FOUND.into_response();
    }
    let target = payload.u.clone();
    record_tracking_event(&state, "click", &payload, Some(target.clone())).await;
    Redirect::temporary(&target).into_response()
}

async fn record_tracking_event(
    state: &EmailEventsState,
    kind: &'static str,
    payload: &TrackingPayload,
    click_url: Option<String>,
) {
    let now = Utc::now();
    let id = ObjectId::new();
    let user_id_bson = match ObjectId::parse_str(&payload.t) {
        Ok(o) => bson::Bson::ObjectId(o),
        Err(_) => bson::Bson::String(payload.t.clone()),
    };
    let mut d = doc! {
        "_id": id,
        "userId": user_id_bson.clone(),
        "kind": kind,
        "email": &payload.e,
        "provider": "tracking",
        "occurredAt": bson::DateTime::from_chrono(now),
        "ingestedAt": bson::DateTime::from_chrono(now),
    };
    if let Ok(c) = ObjectId::parse_str(&payload.c) {
        d.insert("campaignId", c);
    }
    if let Ok(j) = ObjectId::parse_str(&payload.j) {
        d.insert("journeyId", j);
    }
    if let Ok(s) = ObjectId::parse_str(&payload.s) {
        d.insert("subscriberId", s);
    }
    if let Some(u) = click_url.clone() {
        d.insert("url", u);
    }

    if let Err(e) = state
        .mongo
        .collection::<Document>(EVENTS_COLL)
        .insert_one(d.clone())
        .await
    {
        warn!(?e, "tracking insert failed");
        return;
    }

    let mut out = json!({
        "id": id.to_hex(),
        "userId": payload.t,
        "kind": kind,
        "email": payload.e,
        "provider": "tracking",
        "occurredAt": now.to_rfc3339(),
    });
    if !payload.c.is_empty() {
        out["campaignId"] = json!(payload.c);
    }
    if !payload.j.is_empty() {
        out["journeyId"] = json!(payload.j);
    }
    if !payload.s.is_empty() {
        out["subscriberId"] = json!(payload.s);
    }
    if let Some(u) = click_url {
        out["url"] = json!(u);
    }
    fanout(
        &state.mongo,
        &state.http,
        &payload.t,
        vec![(kind.to_owned(), out)],
    )
    .await;
}

// ===========================================================================
// List events
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_events(
    user: AuthUser,
    State(state): State<EmailEventsState>,
    Query(q): Query<ListEventsQuery>,
) -> Result<Json<ListEventsResponse>> {
    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let mut filter = Document::new();
    let user_id_bson = ObjectId::parse_str(&user.tenant_id)
        .map(bson::Bson::ObjectId)
        .unwrap_or_else(|_| bson::Bson::String(user.tenant_id.clone()));
    filter.insert("userId", user_id_bson);
    if let Some(k) = &q.kind {
        filter.insert("kind", k);
    }
    if let Some(c) = q.campaign_id.as_deref().and_then(try_parse_oid) {
        filter.insert("campaignId", c);
    }
    if let Some(j) = q.journey_id.as_deref().and_then(try_parse_oid) {
        filter.insert("journeyId", j);
    }

    let coll = state.mongo.collection::<Document>(EVENTS_COLL);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_events.count")))?;
    let cursor = coll
        .find(filter)
        .sort(doc! { "occurredAt": -1 })
        .skip(skip)
        .limit(limit as i64)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_events.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("email_events.drain")))?;

    let items: Vec<EventRow> = docs.iter().map(doc_to_row).collect();
    let has_more = page * limit < total;
    Ok(Json(ListEventsResponse {
        items,
        total,
        page,
        limit,
        has_more,
    }))
}

fn doc_to_row(d: &Document) -> EventRow {
    let occurred_at = d
        .get_datetime("occurredAt")
        .ok()
        .and_then(|dt| dt.try_to_rfc3339_string().ok())
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    EventRow {
        id: d
            .get_object_id("_id")
            .map(|o| o.to_hex())
            .unwrap_or_default(),
        kind: d.get_str("kind").unwrap_or("").to_owned(),
        email: d.get_str("email").unwrap_or("").to_owned(),
        campaign_id: d.get_object_id("campaignId").ok().map(|o| o.to_hex()),
        journey_id: d.get_object_id("journeyId").ok().map(|o| o.to_hex()),
        subscriber_id: d.get_object_id("subscriberId").ok().map(|o| o.to_hex()),
        url: d.get_str("url").ok().map(|s| s.to_owned()),
        reason: d.get_str("reason").ok().map(|s| s.to_owned()),
        provider: d.get_str("provider").unwrap_or("").to_owned(),
        occurred_at,
    }
}
