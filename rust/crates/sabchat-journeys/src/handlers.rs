//! HTTP handlers for the SabChat **outbound journeys** domain.
//!
//! | Collection                  | Direction | Notes                              |
//! |-----------------------------|-----------|------------------------------------|
//! | `sabchat_journeys`          | r/w       | journey definitions                |
//! | `sabchat_journey_runs`      | r/w       | one row per enrolled contact       |
//! | `sabchat_journey_outbox`    | w         | `message` steps land here          |
//! | `sabchat_contacts`          | r         | tag-segment enrollment             |
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.
//! The cron-callable `/tick` advances each *due* run (`status = "active"`,
//! `next_run_at <= now`, parent journey `active`) by exactly one step.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use tracing::instrument;

use crate::dto::{
    CreateJourneyBody, EnrollBody, EnrollResponse, IdResponse, JourneyDetailResponse, JourneyStep,
    ListJourneysResponse, OutboxResponse, SuccessResponse, TickBody, TickReport, UpdateJourneyBody,
    VALID_JOURNEY_STATUSES, VALID_STEP_KINDS,
};
use crate::state::SabChatJourneysState;

const JOURNEYS_COLL: &str = "sabchat_journeys";
const RUNS_COLL: &str = "sabchat_journey_runs";
const OUTBOX_COLL: &str = "sabchat_journey_outbox";
const CONTACTS_COLL: &str = "sabchat_contacts";

// ===========================================================================
// Helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn internal(ctx: &'static str) -> impl Fn(mongodb::error::Error) -> ApiError {
    move |e| ApiError::Internal(anyhow::Error::new(e).context(ctx))
}

/// Validate + normalize steps: reject unknown kinds, backfill ids.
fn prepare_steps(mut steps: Vec<JourneyStep>) -> Result<Vec<JourneyStep>> {
    for s in &mut steps {
        if !VALID_STEP_KINDS.contains(&s.kind.as_str()) {
            return Err(ApiError::BadRequest(format!(
                "invalid step kind `{}`; expected one of: {}",
                s.kind,
                VALID_STEP_KINDS.join(", "),
            )));
        }
        if s.id.trim().is_empty() {
            s.id = ObjectId::new().to_hex();
        }
        if s.kind == "message" && s.text.as_deref().map(str::trim).unwrap_or("").is_empty() {
            return Err(ApiError::BadRequest("a message step needs text".to_owned()));
        }
    }
    Ok(steps)
}

fn steps_to_bson(steps: &[JourneyStep]) -> Result<Bson> {
    bson::to_bson(steps).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("steps.to_bson")))
}

// ===========================================================================
// POST /journeys — create_journey
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_journey(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Json(body): Json<CreateJourneyBody>,
) -> Result<Json<IdResponse>> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let steps = prepare_steps(body.steps)?;

    let tenant_id = tenant_oid(&user)?;
    let now = now_bson();
    let new_oid = ObjectId::new();
    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "name": name,
        "status": "draft",
        "steps": steps_to_bson(&steps)?,
        "enrolled_count": 0_i64,
        "completed_count": 0_i64,
        "created_at": now,
        "updated_at": now,
    };
    state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .insert_one(doc)
        .await
        .map_err(internal("sabchat_journeys.insert_one"))?;

    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /journeys — list_journeys
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_journeys(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
) -> Result<Json<ListJourneysResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let opts = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .find(doc! { "tenant_id": tenant_id })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_journeys.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_journeys.collect"))?;
    Ok(Json(ListJourneysResponse {
        journeys: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

// ===========================================================================
// GET /journeys/{id} — get_journey (journey + recent runs)
// ===========================================================================

#[instrument(skip_all, fields(journey_id = %journey_id))]
pub async fn get_journey(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Path(journey_id): Path<String>,
) -> Result<Json<JourneyDetailResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let jid = oid_from_str(&journey_id)
        .map_err(|_| ApiError::BadRequest("invalid journey id".to_owned()))?;

    let journey = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .find_one(doc! { "_id": jid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_journeys.find_one"))?
        .ok_or_else(|| ApiError::NotFound("journey not found".to_owned()))?;

    let opts = FindOptions::builder()
        .sort(doc! { "updated_at": -1 })
        .limit(100)
        .build();
    let cursor = state
        .mongo
        .collection::<Document>(RUNS_COLL)
        .find(doc! { "tenant_id": tenant_id, "journey_id": jid })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_journey_runs.find"))?;
    let runs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_journey_runs.collect"))?;

    Ok(Json(JourneyDetailResponse {
        journey: document_to_clean_json(journey),
        runs: runs.into_iter().map(document_to_clean_json).collect(),
    }))
}

// ===========================================================================
// PATCH /journeys/{id} — update_journey
// ===========================================================================

#[instrument(skip_all, fields(journey_id = %journey_id))]
pub async fn update_journey(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Path(journey_id): Path<String>,
    Json(body): Json<UpdateJourneyBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let jid = oid_from_str(&journey_id)
        .map_err(|_| ApiError::BadRequest("invalid journey id".to_owned()))?;

    let mut set = doc! { "updated_at": now_bson() };
    if let Some(name) = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        set.insert("name", name);
    }
    if let Some(status) = body.status.as_deref().map(str::trim) {
        if !VALID_JOURNEY_STATUSES.contains(&status) {
            return Err(ApiError::BadRequest(format!(
                "invalid status `{status}`; expected one of: {}",
                VALID_JOURNEY_STATUSES.join(", "),
            )));
        }
        set.insert("status", status);
    }
    if let Some(steps) = body.steps {
        let prepared = prepare_steps(steps)?;
        set.insert("steps", steps_to_bson(&prepared)?);
    }
    if set.len() <= 1 {
        return Err(ApiError::BadRequest("no updatable fields supplied".to_owned()));
    }

    let res = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .update_one(
            doc! { "_id": jid, "tenant_id": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(internal("sabchat_journeys.update_one"))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("journey not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "journey updated".to_owned(),
    }))
}

// ===========================================================================
// DELETE /journeys/{id} — delete_journey (+ cascade runs + pending outbox)
// ===========================================================================

#[instrument(skip_all, fields(journey_id = %journey_id))]
pub async fn delete_journey(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Path(journey_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let jid = oid_from_str(&journey_id)
        .map_err(|_| ApiError::BadRequest("invalid journey id".to_owned()))?;

    let res = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .delete_one(doc! { "_id": jid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_journeys.delete_one"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("journey not found".to_owned()));
    }
    let _ = state
        .mongo
        .collection::<Document>(RUNS_COLL)
        .delete_many(doc! { "tenant_id": tenant_id, "journey_id": jid })
        .await;
    let _ = state
        .mongo
        .collection::<Document>(OUTBOX_COLL)
        .delete_many(doc! { "tenant_id": tenant_id, "journey_id": jid, "status": "pending" })
        .await;
    Ok(Json(SuccessResponse {
        message: "journey deleted".to_owned(),
    }))
}

// ===========================================================================
// POST /journeys/{id}/enroll — enroll contacts (ids or tag segment)
// ===========================================================================

#[instrument(skip_all, fields(journey_id = %journey_id))]
pub async fn enroll(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Path(journey_id): Path<String>,
    Json(body): Json<EnrollBody>,
) -> Result<Json<EnrollResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let jid = oid_from_str(&journey_id)
        .map_err(|_| ApiError::BadRequest("invalid journey id".to_owned()))?;

    // Journey must exist in this tenant.
    let exists = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .find_one(doc! { "_id": jid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_journeys.find_one"))?
        .is_some();
    if !exists {
        return Err(ApiError::NotFound("journey not found".to_owned()));
    }

    // Resolve the target contact ids: explicit list ∪ tag segment.
    let mut contact_ids: Vec<ObjectId> = body
        .contact_ids
        .iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect();

    if let Some(tag) = body.tag.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let cursor = state
            .mongo
            .collection::<Document>(CONTACTS_COLL)
            .find(doc! { "tenant_id": tenant_id, "tags": tag })
            .await
            .map_err(internal("sabchat_contacts.find"))?;
        let docs: Vec<Document> = cursor
            .try_collect()
            .await
            .map_err(internal("sabchat_contacts.collect"))?;
        for d in docs {
            if let Ok(id) = d.get_object_id("_id") {
                contact_ids.push(id);
            }
        }
    }

    contact_ids.sort();
    contact_ids.dedup();
    if contact_ids.is_empty() {
        return Ok(Json(EnrollResponse { enrolled: 0 }));
    }

    let now = now_bson();
    let mut enrolled = 0_i64;
    let runs = state.mongo.collection::<Document>(RUNS_COLL);
    for cid in contact_ids {
        // Skip a contact already on an active run of this journey.
        let dup = runs
            .find_one(doc! {
                "tenant_id": tenant_id,
                "journey_id": jid,
                "contact_id": cid,
                "status": "active",
            })
            .await
            .map_err(internal("sabchat_journey_runs.find_one"))?
            .is_some();
        if dup {
            continue;
        }
        runs.insert_one(doc! {
            "_id": ObjectId::new(),
            "tenant_id": tenant_id,
            "journey_id": jid,
            "contact_id": cid,
            "status": "active",
            "current_step": 0_i64,
            "next_run_at": now,
            "started_at": now,
            "updated_at": now,
        })
        .await
        .map_err(internal("sabchat_journey_runs.insert_one"))?;
        enrolled += 1;
    }

    if enrolled > 0 {
        let _ = state
            .mongo
            .collection::<Document>(JOURNEYS_COLL)
            .update_one(
                doc! { "_id": jid, "tenant_id": tenant_id },
                doc! { "$inc": { "enrolled_count": enrolled }, "$set": { "updated_at": now } },
            )
            .await;
    }
    Ok(Json(EnrollResponse { enrolled }))
}

// ===========================================================================
// POST /tick — cron-callable run advancer
// ===========================================================================

/// Advance every due run by one step. A run is *due* when it is `active`,
/// its `next_run_at` is in the past, and its parent journey is `active`.
#[instrument(skip_all)]
pub async fn tick(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Json(body): Json<TickBody>,
) -> Result<Json<TickReport>> {
    let tenant_id = tenant_oid(&user)?;
    tick_tenant(&state, tenant_id, body.limit.unwrap_or(500).clamp(1, 5000)).await
}

/// Shared tick body — reused by the HTTP handler (and available to a cron
/// worker that has already resolved the tenant).
pub async fn tick_tenant(
    state: &SabChatJourneysState,
    tenant_id: ObjectId,
    limit: i64,
) -> Result<Json<TickReport>> {
    let now = now_bson();
    let runs_coll = state.mongo.collection::<Document>(RUNS_COLL);

    let opts = FindOptions::builder()
        .sort(doc! { "next_run_at": 1 })
        .limit(limit)
        .build();
    let cursor = runs_coll
        .find(doc! { "tenant_id": tenant_id, "status": "active", "next_run_at": doc! { "$lte": now } })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_journey_runs.find_due"))?;
    let due: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_journey_runs.collect_due"))?;

    let mut report = TickReport {
        advanced: 0,
        messages_enqueued: 0,
        completed: 0,
    };

    for run in due {
        let Ok(run_id) = run.get_object_id("_id") else {
            continue;
        };
        let Ok(journey_id) = run.get_object_id("journey_id") else {
            continue;
        };
        let contact_id = run.get_object_id("contact_id").ok();
        let current_step = run.get_i64("current_step").unwrap_or(0);

        // Load the parent journey; only advance if it is still active.
        let journey = state
            .mongo
            .collection::<Document>(JOURNEYS_COLL)
            .find_one(doc! { "_id": journey_id, "tenant_id": tenant_id })
            .await
            .map_err(internal("sabchat_journeys.find_one"))?;
        let Some(journey) = journey else {
            // Orphaned run — close it.
            let _ = runs_coll
                .update_one(
                    doc! { "_id": run_id },
                    doc! { "$set": { "status": "failed", "updated_at": now } },
                )
                .await;
            continue;
        };
        if journey.get_str("status").unwrap_or("draft") != "active" {
            continue;
        }
        let steps = journey.get_array("steps").cloned().unwrap_or_default();

        // Past the end → complete.
        if current_step as usize >= steps.len() {
            complete_run(state, tenant_id, run_id, journey_id, now).await;
            report.completed += 1;
            continue;
        }

        let step = steps[current_step as usize].as_document();
        let kind = step.and_then(|d| d.get_str("kind").ok()).unwrap_or("goal");

        match kind {
            "wait" => {
                let mins = step.and_then(|d| d.get_i64("wait_minutes").ok()).unwrap_or(60).max(1);
                let next = bson::DateTime::from_chrono(Utc::now() + Duration::minutes(mins));
                let _ = runs_coll
                    .update_one(
                        doc! { "_id": run_id },
                        doc! { "$set": { "current_step": current_step + 1, "next_run_at": next, "updated_at": now } },
                    )
                    .await;
                report.advanced += 1;
            }
            "message" => {
                let channel = step
                    .and_then(|d| d.get_str("channel").ok())
                    .unwrap_or("chat")
                    .to_owned();
                let text = step
                    .and_then(|d| d.get_str("text").ok())
                    .unwrap_or("")
                    .to_owned();
                state
                    .mongo
                    .collection::<Document>(OUTBOX_COLL)
                    .insert_one(doc! {
                        "_id": ObjectId::new(),
                        "tenant_id": tenant_id,
                        "journey_id": journey_id,
                        "run_id": run_id,
                        "contact_id": contact_id,
                        "channel": channel,
                        "text": text,
                        "status": "pending",
                        "created_at": now,
                    })
                    .await
                    .map_err(internal("sabchat_journey_outbox.insert_one"))?;
                // Advance immediately; the next due-scan picks it up.
                let _ = runs_coll
                    .update_one(
                        doc! { "_id": run_id },
                        doc! { "$set": { "current_step": current_step + 1, "next_run_at": now, "updated_at": now } },
                    )
                    .await;
                report.advanced += 1;
                report.messages_enqueued += 1;
            }
            _ => {
                // "goal" or unknown → complete the run.
                complete_run(state, tenant_id, run_id, journey_id, now).await;
                report.completed += 1;
            }
        }
    }

    Ok(Json(report))
}

async fn complete_run(
    state: &SabChatJourneysState,
    tenant_id: ObjectId,
    run_id: ObjectId,
    journey_id: ObjectId,
    now: bson::DateTime,
) {
    let _ = state
        .mongo
        .collection::<Document>(RUNS_COLL)
        .update_one(
            doc! { "_id": run_id },
            doc! { "$set": { "status": "completed", "completed_at": now, "updated_at": now } },
        )
        .await;
    let _ = state
        .mongo
        .collection::<Document>(JOURNEYS_COLL)
        .update_one(
            doc! { "_id": journey_id, "tenant_id": tenant_id },
            doc! { "$inc": { "completed_count": 1_i64 } },
        )
        .await;
}

// ===========================================================================
// GET /outbox — pending deliveries (drained by the channel dispatcher)
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_outbox(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
) -> Result<Json<OutboxResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let opts = FindOptions::builder()
        .sort(doc! { "created_at": 1 })
        .limit(200)
        .build();
    let cursor = state
        .mongo
        .collection::<Document>(OUTBOX_COLL)
        .find(doc! { "tenant_id": tenant_id, "status": "pending" })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_journey_outbox.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_journey_outbox.collect"))?;
    Ok(Json(OutboxResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

// ===========================================================================
// POST /outbox/{id}/sent — mark an outbox row delivered
// ===========================================================================

#[instrument(skip_all, fields(outbox_id = %outbox_id))]
pub async fn mark_outbox_sent(
    user: AuthUser,
    State(state): State<SabChatJourneysState>,
    Path(outbox_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let oid = oid_from_str(&outbox_id)
        .map_err(|_| ApiError::BadRequest("invalid outbox id".to_owned()))?;
    let res = state
        .mongo
        .collection::<Document>(OUTBOX_COLL)
        .update_one(
            doc! { "_id": oid, "tenant_id": tenant_id },
            doc! { "$set": { "status": "sent", "sent_at": now_bson() } },
        )
        .await
        .map_err(internal("sabchat_journey_outbox.update_one"))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("outbox item not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "marked sent".to_owned(),
    }))
}
