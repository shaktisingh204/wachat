//! HTTP handlers for the email campaigns surface.
//!
//! Conventions (mirrored from `wachat-broadcast::handlers` and
//! `email-audience::handlers`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes [`AuthUser`] — there is no anonymous access.
//! - Every Mongo filter pins `userId = ObjectId(AuthUser.tenant_id)` so
//!   a tenant can never observe or mutate another tenant's campaign.
//!
//! No business logic lives here beyond the orchestration of:
//! 1. validation (pre-flight on `send`),
//! 2. Mongo I/O,
//! 3. lifecycle state transitions,
//! 4. enqueue onto BullMQ `"email-send"`.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use email_types::{
    EmailCampaignStatus, EmailCampaignType,
    collections::{
        BRAND_KITS, CAMPAIGNS, REPORTS_CACHE, SUBSCRIBERS, SUPPRESSIONS,
    },
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use regex::Regex;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::{Value, json};
use tracing::{instrument, warn};
use wachat_queue::JobOptions;

use crate::dto::{
    CampaignsQuery, CreateCampaignBody, ListResponse, MessageResponse, PreviewQuery,
    PreviewResponse, RecipientsCountResponse, ReportResponse, ScheduleBody, TestSendBody,
    UpdateCampaignBody,
};
use crate::state::EmailCampaignsState;

/// BullMQ queue + job-name constants. The queue name is the contract
/// between this router (producer) and the `email-sender` crate
/// (consumer); keep them in sync.
const SEND_QUEUE: &str = "email-send";
const JOB_TEST: &str = "test-send";
const JOB_START: &str = "start-campaign";

// ===========================================================================
// Tenancy helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

/// Promote a `bson::Document` to `serde_json::Value`. Same approach used
/// in sibling crates so client shapes stay consistent.
fn doc_to_json(d: Document) -> Result<Value> {
    serde_json::to_value(d)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("doc → json")))
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value can't be represented (which in
/// practice never happens for our shapes).
fn json_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

/// Load one campaign by hex id while enforcing tenancy.
async fn load_campaign(
    state: &EmailCampaignsState,
    user: &AuthUser,
    id_hex: &str,
) -> Result<Document> {
    let tenant = tenant_oid(user)?;
    let oid = oid_from_str(id_hex)?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);
    coll.find_one(doc! { "_id": oid, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("campaign {id_hex}")))
}

/// Read a campaign's `status` as a typed enum, falling back to
/// `BadRequest` if the persisted value isn't one of the known states.
fn parse_status(doc_: &Document) -> Result<EmailCampaignStatus> {
    let raw = doc_.get_str("status").map_err(|_| {
        ApiError::Internal(anyhow::anyhow!("campaign missing status field"))
    })?;
    let val: Value = json!(raw);
    serde_json::from_value(val).map_err(|_| {
        ApiError::Internal(anyhow::anyhow!(format!(
            "unrecognised campaign status `{raw}`"
        )))
    })
}

fn status_str(s: EmailCampaignStatus) -> &'static str {
    match s {
        EmailCampaignStatus::Draft => "draft",
        EmailCampaignStatus::Scheduled => "scheduled",
        EmailCampaignStatus::Sending => "sending",
        EmailCampaignStatus::Sent => "sent",
        EmailCampaignStatus::Paused => "paused",
        EmailCampaignStatus::Cancelled => "cancelled",
        EmailCampaignStatus::Failed => "failed",
    }
}

// ===========================================================================
// LIST + GET + CREATE + UPDATE + DELETE
// ===========================================================================

/// `GET /` — list campaigns with optional filters + pagination.
#[instrument(skip(state, user))]
pub async fn list_campaigns(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Query(q): Query<CampaignsQuery>,
) -> Result<Json<ListResponse<Value>>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);

    let mut filter = doc! { "userId": tenant };
    if let Some(s) = q.status {
        filter.insert("status", status_str(s));
    }
    if let Some(k) = q.kind {
        // EmailCampaignType serialises as snake_case
        let raw = match k {
            EmailCampaignType::Regular => "regular",
            EmailCampaignType::Ab => "ab",
            EmailCampaignType::Rss => "rss",
            EmailCampaignType::Plain => "plain",
            EmailCampaignType::Transactional => "transactional",
        };
        filter.insert("type", raw);
    }
    if let Some(ref list_id) = q.list_id {
        let oid = oid_from_str(list_id)?;
        filter.insert("listIds", oid);
    }

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.count")))?;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(q.page.saturating_sub(1) * q.limit)
        .limit(q.limit as i64)
        .build();

    let docs: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.find")))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.collect")))?;

    let items: Vec<Value> = docs.into_iter().filter_map(|d| doc_to_json(d).ok()).collect();
    let has_more = q.page * q.limit < total;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
        has_more,
    }))
}

/// `GET /{id}` — single campaign read (with tenancy guard).
#[instrument(skip(state, user))]
pub async fn get_campaign(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let d = load_campaign(&state, &user, &id).await?;
    Ok(Json(doc_to_json(d)?))
}

/// `POST /` — create a draft campaign.
#[instrument(skip(state, user, body))]
pub async fn create_campaign(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Json(body): Json<CreateCampaignBody>,
) -> Result<(StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now: bson::DateTime = Utc::now().into();
    let id = ObjectId::new();

    let kind_str = match body.kind {
        EmailCampaignType::Regular => "regular",
        EmailCampaignType::Ab => "ab",
        EmailCampaignType::Rss => "rss",
        EmailCampaignType::Plain => "plain",
        EmailCampaignType::Transactional => "transactional",
    };

    let list_oids: Vec<Bson> = body
        .list_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .map(Bson::ObjectId)
        .collect();
    let segment_oids: Vec<Bson> = body
        .segment_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .map(Bson::ObjectId)
        .collect();

    let mut d = doc! {
        "_id": id,
        "userId": tenant,
        "name": body.name.trim(),
        "type": kind_str,
        "status": "draft",
        "subject": body.subject.unwrap_or_default(),
        "fromName": body.from_name.unwrap_or_default(),
        "fromEmail": body.from_email.unwrap_or_default(),
        "listIds": Bson::Array(list_oids),
        "segmentIds": Bson::Array(segment_oids),
        "trackOpens": body.track_opens.unwrap_or(true),
        "trackClicks": body.track_clicks.unwrap_or(true),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(p) = body.preheader {
        d.insert("preheader", p);
    }
    if let Some(b) = body.body {
        d.insert("body", b);
    }
    if let Some(tid) = body.template_id.as_deref() {
        if let Ok(oid) = ObjectId::parse_str(tid) {
            d.insert("templateId", oid);
        }
    }
    if let Some(bk) = body.brand_kit_id.as_deref() {
        if let Ok(oid) = ObjectId::parse_str(bk) {
            d.insert("brandKitId", oid);
        }
    }
    if !body.variants.is_empty() {
        let v = serde_json::to_value(&body.variants)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("variants → json")))?;
        d.insert("variants", json_to_bson(&v));
    }
    if let Some(ab) = body.ab_config.as_ref() {
        let v = serde_json::to_value(ab)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("abConfig → json")))?;
        d.insert("abConfig", json_to_bson(&v));
    }
    if let Some(sched) = body.scheduled_at {
        let bd: bson::DateTime = sched.into();
        d.insert("scheduledAt", bd);
    }

    state
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.insert_one")))?;

    Ok((StatusCode::CREATED, Json(doc_to_json(d)?)))
}

/// `PATCH /{id}` — update draft fields. Returns `409` if the campaign is
/// no longer a draft (any send-related fields must be edited from a new
/// draft instead).
#[instrument(skip(state, user, body))]
pub async fn update_campaign(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateCampaignBody>,
) -> Result<Json<Value>> {
    let existing = load_campaign(&state, &user, &id).await?;
    let status = parse_status(&existing)?;
    if status != EmailCampaignStatus::Draft && status != EmailCampaignStatus::Scheduled {
        return Err(ApiError::Conflict(format!(
            "campaign is `{}`, only draft / scheduled campaigns are editable",
            status_str(status)
        )));
    }

    let mut set = doc! { "updatedAt": bson::DateTime::from(Utc::now()) };
    if let Some(n) = body.name {
        set.insert("name", n.trim());
    }
    if let Some(s) = body.subject {
        set.insert("subject", s);
    }
    if let Some(s) = body.from_name {
        set.insert("fromName", s);
    }
    if let Some(s) = body.from_email {
        set.insert("fromEmail", s);
    }
    if let Some(p) = body.preheader {
        set.insert("preheader", p);
    }
    if let Some(b) = body.body {
        set.insert("body", b);
    }
    if let Some(t) = body.template_id.as_deref() {
        match ObjectId::parse_str(t) {
            Ok(oid) => {
                set.insert("templateId", oid);
            }
            Err(_) => return Err(ApiError::BadRequest("invalid templateId".into())),
        }
    }
    if let Some(t) = body.brand_kit_id.as_deref() {
        match ObjectId::parse_str(t) {
            Ok(oid) => {
                set.insert("brandKitId", oid);
            }
            Err(_) => return Err(ApiError::BadRequest("invalid brandKitId".into())),
        }
    }
    if let Some(list_ids) = body.list_ids {
        let oids: Vec<Bson> = list_ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s).ok())
            .map(Bson::ObjectId)
            .collect();
        set.insert("listIds", Bson::Array(oids));
    }
    if let Some(seg_ids) = body.segment_ids {
        let oids: Vec<Bson> = seg_ids
            .iter()
            .filter_map(|s| ObjectId::parse_str(s).ok())
            .map(Bson::ObjectId)
            .collect();
        set.insert("segmentIds", Bson::Array(oids));
    }
    if let Some(variants) = body.variants {
        let v = serde_json::to_value(&variants)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("variants → json")))?;
        set.insert("variants", json_to_bson(&v));
    }
    if let Some(ab) = body.ab_config {
        let v = serde_json::to_value(&ab)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("abConfig → json")))?;
        set.insert("abConfig", json_to_bson(&v));
    }
    if let Some(b) = body.track_opens {
        set.insert("trackOpens", b);
    }
    if let Some(b) = body.track_clicks {
        set.insert("trackClicks", b);
    }
    if let Some(sched) = body.scheduled_at {
        let bd: bson::DateTime = sched.into();
        set.insert("scheduledAt", bd);
    }

    let coll = state.mongo.collection::<Document>(CAMPAIGNS);
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    coll.update_one(
        doc! { "_id": oid, "userId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("campaigns.update_one")))?;

    let updated = load_campaign(&state, &user, &id).await?;
    Ok(Json(doc_to_json(updated)?))
}

/// `DELETE /{id}` — soft delete: scheduled campaigns flip to
/// `cancelled`; pure drafts are hard-deleted. Anything else (sending,
/// sent, paused, ...) returns `409`.
#[instrument(skip(state, user))]
pub async fn delete_campaign(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let existing = load_campaign(&state, &user, &id).await?;
    let status = parse_status(&existing)?;
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);

    match status {
        EmailCampaignStatus::Draft => {
            coll.delete_one(doc! { "_id": oid, "userId": tenant })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("campaigns.delete_one"))
                })?;
            Ok(Json(MessageResponse {
                message: "Draft campaign deleted.".into(),
            }))
        }
        EmailCampaignStatus::Scheduled => {
            coll.update_one(
                doc! { "_id": oid, "userId": tenant },
                doc! { "$set": {
                    "status": "cancelled",
                    "updatedAt": bson::DateTime::from(Utc::now()),
                }},
            )
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("campaigns.cancel_one"))
            })?;
            Ok(Json(MessageResponse {
                message: "Scheduled campaign cancelled.".into(),
            }))
        }
        other => Err(ApiError::Conflict(format!(
            "cannot delete campaign in `{}` state",
            status_str(other)
        ))),
    }
}

// ===========================================================================
// LIFECYCLE: test-send, send, schedule, pause, resume, cancel
// ===========================================================================

/// `POST /{id}/test-send` — push a `kind: test` job onto the BullMQ
/// `email-send` queue. The `email-sender` worker renders the campaign
/// for each address in `toEmails` and delivers via the tenant's
/// configured provider.
#[instrument(skip(state, user, body))]
pub async fn test_send(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<TestSendBody>,
) -> Result<Json<MessageResponse>> {
    if body.to_emails.is_empty() {
        return Err(ApiError::Validation("toEmails must be non-empty".into()));
    }
    if body.to_emails.len() > 10 {
        return Err(ApiError::Validation(
            "at most 10 recipients per test-send".into(),
        ));
    }
    // Tenancy guard — load and check ownership before enqueue.
    let _campaign = load_campaign(&state, &user, &id).await?;

    let payload = json!({
        "kind": "test",
        "campaignId": id,
        "tenantId": user.tenant_id,
        "toEmails": body.to_emails,
    });
    let opts = JobOptions {
        attempts: 3,
        job_id: Some(format!("email_test_{id}_{}", Utc::now().timestamp_millis())),
        ..Default::default()
    };
    state
        .bull
        .add(SEND_QUEUE, JOB_TEST, &payload, opts)
        .await?;

    Ok(Json(MessageResponse {
        message: format!("Test send queued for {} recipient(s).", body.to_emails.len()),
    }))
}

/// `POST /{id}/send` — full pre-flight then draft → sending.
#[instrument(skip(state, user))]
pub async fn send(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let campaign = load_campaign(&state, &user, &id).await?;
    let status = parse_status(&campaign)?;
    if status != EmailCampaignStatus::Draft {
        return Err(ApiError::Conflict(format!(
            "campaign is `{}`, only draft campaigns can be sent",
            status_str(status)
        )));
    }
    preflight(&campaign)?;

    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);
    let res = coll
        .update_one(
            doc! { "_id": oid, "userId": tenant, "status": "draft" },
            doc! { "$set": {
                "status": "sending",
                "updatedAt": bson::DateTime::from(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("send.update_one")))?;
    if res.matched_count == 0 {
        // Lost the race — another request flipped status under us.
        return Err(ApiError::Conflict(
            "campaign status changed during send transition".into(),
        ));
    }

    // Enqueue start-campaign on the email-send queue.
    let payload = json!({
        "kind": "start-campaign",
        "campaignId": id,
        "tenantId": user.tenant_id,
    });
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!("email_start_{id}")),
        ..Default::default()
    };
    if let Err(e) = state.bull.add(SEND_QUEUE, JOB_START, &payload, opts).await {
        // Best-effort rollback: flip status back to draft so the user can
        // retry. We surface the original error so they know what went
        // wrong.
        let _ = coll
            .update_one(
                doc! { "_id": oid, "userId": tenant, "status": "sending" },
                doc! { "$set": { "status": "draft" } },
            )
            .await;
        return Err(e);
    }

    Ok(Json(MessageResponse {
        message: "Campaign queued for sending.".into(),
    }))
}

/// `POST /{id}/schedule` — flip a draft to `scheduled`. The
/// `email-sender` worker's tick loop picks it up at `scheduledAt`.
#[instrument(skip(state, user, body))]
pub async fn schedule(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ScheduleBody>,
) -> Result<Json<MessageResponse>> {
    if body.scheduled_at <= Utc::now() {
        return Err(ApiError::Validation(
            "scheduledAt must be in the future".into(),
        ));
    }
    let campaign = load_campaign(&state, &user, &id).await?;
    let status = parse_status(&campaign)?;
    if status != EmailCampaignStatus::Draft && status != EmailCampaignStatus::Scheduled {
        return Err(ApiError::Conflict(format!(
            "campaign is `{}`, only draft / scheduled campaigns can be (re)scheduled",
            status_str(status)
        )));
    }
    preflight(&campaign)?;

    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(CAMPAIGNS);
    coll.update_one(
        doc! { "_id": oid, "userId": tenant },
        doc! { "$set": {
            "status": "scheduled",
            "scheduledAt": bson::DateTime::from(body.scheduled_at),
            "updatedAt": bson::DateTime::from(Utc::now()),
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("schedule.update_one")))?;

    Ok(Json(MessageResponse {
        message: format!("Campaign scheduled for {}.", body.scheduled_at),
    }))
}

/// `POST /{id}/pause` — sending / scheduled → paused. The worker
/// observes this on its next deliver tick and skips remaining work.
#[instrument(skip(state, user))]
pub async fn pause(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    transition_to(&state, &user, &id, "paused", &[
        EmailCampaignStatus::Sending,
        EmailCampaignStatus::Scheduled,
    ])
    .await?;
    Ok(Json(MessageResponse {
        message: "Campaign paused.".into(),
    }))
}

/// `POST /{id}/resume` — paused → sending (the worker treats `sending`
/// and `scheduled` identically when picking up paused work).
#[instrument(skip(state, user))]
pub async fn resume(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    transition_to(&state, &user, &id, "sending", &[EmailCampaignStatus::Paused]).await?;
    Ok(Json(MessageResponse {
        message: "Campaign resumed.".into(),
    }))
}

/// `POST /{id}/cancel` — any non-terminal state → cancelled.
#[instrument(skip(state, user))]
pub async fn cancel(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    transition_to(
        &state,
        &user,
        &id,
        "cancelled",
        &[
            EmailCampaignStatus::Draft,
            EmailCampaignStatus::Scheduled,
            EmailCampaignStatus::Sending,
            EmailCampaignStatus::Paused,
        ],
    )
    .await?;
    Ok(Json(MessageResponse {
        message: "Campaign cancelled.".into(),
    }))
}

/// Shared lifecycle helper: ensure current status is in `allowed`, then
/// flip to `next`. Returns `Conflict` if the precondition fails.
async fn transition_to(
    state: &EmailCampaignsState,
    user: &AuthUser,
    id: &str,
    next: &str,
    allowed: &[EmailCampaignStatus],
) -> Result<()> {
    let campaign = load_campaign(state, user, id).await?;
    let status = parse_status(&campaign)?;
    if !allowed.contains(&status) {
        return Err(ApiError::Conflict(format!(
            "cannot transition `{}` → `{next}`",
            status_str(status)
        )));
    }
    let tenant = tenant_oid(user)?;
    let oid = oid_from_str(id)?;
    state
        .mongo
        .collection::<Document>(CAMPAIGNS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": {
                "status": next,
                "updatedAt": bson::DateTime::from(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("transition.update_one")))?;
    Ok(())
}

// ===========================================================================
// PREVIEW, RECIPIENTS-COUNT, REPORT
// ===========================================================================

/// `GET /{id}/preview` — render the campaign body with merge tags
/// substituted from either an actual subscriber doc or a synthetic
/// placeholder.
#[instrument(skip(state, user))]
pub async fn preview(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<PreviewQuery>,
) -> Result<Json<PreviewResponse>> {
    let campaign = load_campaign(&state, &user, &id).await?;

    let subject = campaign.get_str("subject").unwrap_or("").to_owned();
    let body = campaign.get_str("body").unwrap_or("").to_owned();

    // If a subscriber id was supplied, pull merge values from it.
    let mut sample: SampleSubscriber = SampleSubscriber::placeholder(&user.tenant_id);
    if let Some(sid) = q.subscriber_id.as_deref() {
        let tenant = tenant_oid(&user)?;
        let soid = oid_from_str(sid)?;
        let sdoc = state
            .mongo
            .collection::<Document>(SUBSCRIBERS)
            .find_one(doc! { "_id": soid, "userId": tenant })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subscribers.find_one")))?;
        if let Some(d) = sdoc {
            sample = SampleSubscriber::from_doc(&d);
        }
    }

    // Optional brand kit injection (footer / unsubscribe). Look up by id
    // if the campaign references one — best-effort, missing kits do not
    // fail preview.
    let _brand_kit = if let Ok(bk_oid) = campaign.get_object_id("brandKitId") {
        state
            .mongo
            .collection::<Document>(BRAND_KITS)
            .find_one(doc! { "_id": bk_oid, "userId": tenant_oid(&user)? })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("brand_kits.find_one")))?
    } else {
        None
    };

    let rendered_subject = interpolate(&subject, &sample);
    let rendered_html = interpolate(&body, &sample);

    Ok(Json(PreviewResponse {
        subject: rendered_subject,
        html: rendered_html,
    }))
}

/// `GET /{id}/recipients-count` — counts subscribers matching the
/// campaign's `listIds` + `segmentIds`, minus the tenant's suppression
/// list.
///
/// Segments are stored as filter trees on `email_segments` and the full
/// evaluator lives in `email-audience`. To avoid a circular dep, this
/// handler computes the **list** portion exactly and applies a
/// conservative best-effort approximation for segments: subscribers
/// referenced in any of the segment ids via the new `segmentIds` denorm
/// field, falling back to zero when the field is absent. The dedicated
/// `email-sender` worker recomputes the exact segment match at deliver
/// time, so this endpoint is an estimate (the UI labels it as such).
#[instrument(skip(state, user))]
pub async fn recipients_count(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<RecipientsCountResponse>> {
    let campaign = load_campaign(&state, &user, &id).await?;
    let tenant = tenant_oid(&user)?;

    // Gather list + segment ids from the campaign doc.
    let mut list_oids: Vec<ObjectId> = Vec::new();
    if let Ok(arr) = campaign.get_array("listIds") {
        for v in arr {
            if let Bson::ObjectId(o) = v {
                list_oids.push(*o);
            }
        }
    }
    let mut segment_oids: Vec<ObjectId> = Vec::new();
    if let Ok(arr) = campaign.get_array("segmentIds") {
        for v in arr {
            if let Bson::ObjectId(o) = v {
                segment_oids.push(*o);
            }
        }
    }

    // Build subscriber-side filter: subscribed + matches any list or any
    // pre-denormalised segment membership.
    let mut or_clauses: Vec<Document> = Vec::new();
    if !list_oids.is_empty() {
        or_clauses.push(doc! { "listId": { "$in": &list_oids } });
    }
    if !segment_oids.is_empty() {
        or_clauses.push(doc! { "segmentIds": { "$in": &segment_oids } });
    }

    let subs_coll = state.mongo.collection::<Document>(SUBSCRIBERS);
    let gross: u64 = if or_clauses.is_empty() {
        0
    } else {
        let filter = doc! {
            "userId": tenant,
            "status": "subscribed",
            "$or": or_clauses,
        };
        subs_coll.count_documents(filter).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("subscribers.count"))
        })?
    };

    // Subtract suppressions. We approximate the suppressed count by
    // counting tenant suppressions — the precise minus-set computation
    // requires a join the sender worker performs at deliver time.
    let suppressed = state
        .mongo
        .collection::<Document>(SUPPRESSIONS)
        .count_documents(doc! { "userId": tenant })
        .await
        .unwrap_or(0);
    let count = gross.saturating_sub(suppressed);

    Ok(Json(RecipientsCountResponse {
        count,
        gross,
        suppressed,
    }))
}

/// `GET /{id}/report` — read the aggregated KPIs the reports worker
/// rolled up into `email_reports_cache`. Falls back to zeros when no
/// cache row exists yet (campaign hasn't started, or rollup hasn't run).
#[instrument(skip(state, user))]
pub async fn report(
    State(state): State<EmailCampaignsState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<ReportResponse>> {
    let _campaign = load_campaign(&state, &user, &id).await?;
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;

    let cache = state
        .mongo
        .collection::<Document>(REPORTS_CACHE)
        .find_one(doc! {
            "userId": tenant,
            "campaignId": oid,
            "bucket": "lifetime",
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reports_cache.find_one")))?;

    if let Some(d) = cache {
        let resp = ReportResponse {
            sent: d.get_i64("sent").unwrap_or(0).max(0) as u64,
            delivered: d.get_i64("delivered").unwrap_or(0).max(0) as u64,
            opens: d.get_i64("opens").unwrap_or(0).max(0) as u64,
            unique_opens: d.get_i64("uniqueOpens").unwrap_or(0).max(0) as u64,
            clicks: d.get_i64("clicks").unwrap_or(0).max(0) as u64,
            unique_clicks: d.get_i64("uniqueClicks").unwrap_or(0).max(0) as u64,
            bounces: d.get_i64("bounces").unwrap_or(0).max(0) as u64,
            complaints: d.get_i64("complaints").unwrap_or(0).max(0) as u64,
            unsubscribes: d.get_i64("unsubscribes").unwrap_or(0).max(0) as u64,
            raw: doc_to_json(d).ok(),
        };
        Ok(Json(resp))
    } else {
        Ok(Json(ReportResponse::default()))
    }
}

// ===========================================================================
// Pre-flight + merge-tag interpolation
// ===========================================================================

/// Pre-flight checks the campaign must pass before any send can be
/// enqueued. Returns the **first** failure as a `Validation` error so the
/// UI can surface a single actionable message.
fn preflight(campaign: &Document) -> Result<()> {
    let subject = campaign.get_str("subject").unwrap_or("").trim();
    if subject.is_empty() {
        return Err(ApiError::Validation("subject is required".into()));
    }
    let from_email = campaign.get_str("fromEmail").unwrap_or("").trim();
    if !is_email_shape(from_email) {
        return Err(ApiError::Validation("fromEmail is not a valid email address".into()));
    }
    let has_body = campaign
        .get_str("body")
        .ok()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_template = campaign.get_object_id("templateId").is_ok();
    if !has_body && !has_template {
        return Err(ApiError::Validation("either body or templateId is required".into()));
    }
    let has_lists = campaign
        .get_array("listIds")
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    let has_segments = campaign
        .get_array("segmentIds")
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_lists && !has_segments {
        return Err(ApiError::Validation(
            "at least one listId or segmentId is required".into(),
        ));
    }

    // Merge-tag validity: every `{{ ... }}` payload must be a simple
    // snake-case identifier (a–z, 0–9, _). Anything else is flagged.
    if let Some(s) = campaign.get_str("body").ok() {
        check_merge_tags(s)?;
    }
    check_merge_tags(subject)?;

    Ok(())
}

/// Quick-and-dirty RFC-5322 surface check. The full SMTP-side validation
/// happens inside the provider; we only catch obvious typos here.
fn is_email_shape(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    let mut parts = s.splitn(2, '@');
    let local = parts.next().unwrap_or("");
    let domain = parts.next().unwrap_or("");
    !local.is_empty() && domain.contains('.')
}

/// Reject any `{{ ... }}` payload that isn't a simple lowercase
/// identifier. Whitespace inside the braces is tolerated.
fn check_merge_tags(s: &str) -> Result<()> {
    // Matches anything wrapped in `{{ }}`. We then validate the inner
    // payload against `^[a-z_][a-z0-9_]*$`.
    let outer = Regex::new(r"\{\{\s*([^{}]*?)\s*\}\}").unwrap();
    let inner = Regex::new(r"^[a-z_][a-z0-9_]*$").unwrap();
    for cap in outer.captures_iter(s) {
        let tag = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        if !inner.is_match(tag) {
            return Err(ApiError::Validation(format!(
                "broken merge tag `{{{{ {tag} }}}}` — expected snake_case identifier"
            )));
        }
    }
    Ok(())
}

/// Minimal merge-tag substitution shared by the preview endpoint. The
/// full sender-side renderer (with brand-kit, tracking pixel, link
/// rewrites) lives in `email-sender::render`.
fn interpolate(template: &str, sub: &SampleSubscriber) -> String {
    let outer = Regex::new(r"\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}").unwrap();
    outer
        .replace_all(template, |caps: &regex::Captures<'_>| {
            let tag = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            sub.lookup(tag).unwrap_or_default()
        })
        .into_owned()
}

/// Subset of `EmailSubscriber` used by the preview substituter. Lives
/// here (rather than in `dto`) because it never crosses the wire.
struct SampleSubscriber {
    email: String,
    first_name: String,
    last_name: String,
    unsubscribe_url: String,
}

impl SampleSubscriber {
    fn placeholder(tenant_id: &str) -> Self {
        Self {
            email: "sample@example.com".to_owned(),
            first_name: "Sam".to_owned(),
            last_name: "Subscriber".to_owned(),
            unsubscribe_url: format!(
                "https://example.com/u/{tenant_id}?token=preview"
            ),
        }
    }
    fn from_doc(d: &Document) -> Self {
        Self {
            email: d.get_str("email").unwrap_or("").to_owned(),
            first_name: d.get_str("firstName").unwrap_or("").to_owned(),
            last_name: d.get_str("lastName").unwrap_or("").to_owned(),
            // Real unsubscribe URLs are minted inside the sender; the
            // preview just shows a placeholder so the link in the
            // template is still clickable.
            unsubscribe_url: "https://example.com/unsubscribe?preview=1".to_owned(),
        }
    }
    fn lookup(&self, tag: &str) -> Option<String> {
        match tag {
            "email" => Some(self.email.clone()),
            "first_name" | "firstName" => Some(self.first_name.clone()),
            "last_name" | "lastName" => Some(self.last_name.clone()),
            "unsubscribe_url" | "unsubscribeUrl" => Some(self.unsubscribe_url.clone()),
            _ => None,
        }
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_shape_basic() {
        assert!(is_email_shape("a@b.co"));
        assert!(!is_email_shape("nope"));
        assert!(!is_email_shape("@b.co"));
        assert!(!is_email_shape("a@nodot"));
    }

    #[test]
    fn merge_tag_validation_passes_simple_tags() {
        assert!(check_merge_tags("Hi {{ first_name }}, hello {{email}}!").is_ok());
    }

    #[test]
    fn merge_tag_validation_rejects_garbage() {
        assert!(check_merge_tags("Hi {{ first name }}!").is_err());
        assert!(check_merge_tags("Hi {{ FIRST_NAME }}!").is_err());
        assert!(check_merge_tags("Hi {{ 1bad }}!").is_err());
    }

    #[test]
    fn interpolate_substitutes_known_tags_and_blanks_unknown() {
        let s = SampleSubscriber::placeholder("tenant-1");
        let out = interpolate("Hi {{ first_name }} <{{ email }}> and {{ missing }}!", &s);
        assert_eq!(out, "Hi Sam <sample@example.com> and !");
    }

    /// Silence unused-import warning on `warn!` (used for future best-effort logging).
    #[test]
    fn _unused_warn() {
        warn!("noop");
    }
}
