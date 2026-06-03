//! HTTP handlers for the email journeys surface.
//!
//! Conventions:
//!   * Every handler returns `Result<Json<T>, ApiError>`.
//!   * Every handler takes [`AuthUser`] — there is no anonymous access.
//!   * Every Mongo filter pins `userId = ObjectId(AuthUser.tenant_id)`.
//!
//! No business logic beyond:
//!   1. validation (activate-time BFS to enforce trigger + reachable exit),
//!   2. Mongo I/O,
//!   3. lifecycle transitions,
//!   4. BullMQ enqueue onto `"email-journey"`.

use std::collections::{HashMap, HashSet, VecDeque};

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use email_types::{
    EmailJourneyStatus, EmailJourneyTriggerKind,
    collections::{JOURNEY_RUNS, JOURNEYS, SUBSCRIBERS},
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use serde_json::{Map, Value, json};
use tracing::instrument;
use wachat_queue::JobOptions;

use crate::dto::{
    CreateJourneyBody, EnrollBody, JourneysQuery, ListResponse, MessageResponse, PageQuery,
    ReportResponse, RunsQuery, UpdateJourneyBody,
};
use crate::state::EmailJourneysState;
use crate::templates;

/// BullMQ queue + job names. Producers MUST keep these in sync with
/// the worker side (`email-journey-worker::queue`).
const JOURNEY_QUEUE: &str = "email-journey";
const JOB_TICK: &str = "journey-tick";

// ===========================================================================
// Helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    oid_from_str(&user.tenant_id)
}

fn doc_to_json(d: Document) -> Result<Value> {
    serde_json::to_value(d)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("doc → json")))
}

fn json_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

async fn load_journey(
    state: &EmailJourneysState,
    user: &AuthUser,
    id_hex: &str,
) -> Result<Document> {
    let tenant = tenant_oid(user)?;
    let oid = oid_from_str(id_hex)?;
    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .find_one(doc! { "_id": oid, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("journey {id_hex}")))
}

fn parse_status(doc_: &Document) -> Result<EmailJourneyStatus> {
    let raw = doc_
        .get_str("status")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("journey missing status field")))?;
    let val: Value = json!(raw);
    serde_json::from_value(val).map_err(|_| {
        ApiError::Internal(anyhow::anyhow!(format!(
            "unrecognised journey status `{raw}`"
        )))
    })
}

fn status_str(s: EmailJourneyStatus) -> &'static str {
    match s {
        EmailJourneyStatus::Draft => "draft",
        EmailJourneyStatus::Active => "active",
        EmailJourneyStatus::Paused => "paused",
        EmailJourneyStatus::Archived => "archived",
    }
}

fn trigger_kind_str(k: EmailJourneyTriggerKind) -> &'static str {
    match k {
        EmailJourneyTriggerKind::ListJoin => "list_join",
        EmailJourneyTriggerKind::TagAdded => "tag_added",
        EmailJourneyTriggerKind::TagRemoved => "tag_removed",
        EmailJourneyTriggerKind::SegmentEnter => "segment_enter",
        EmailJourneyTriggerKind::CampaignOpen => "campaign_open",
        EmailJourneyTriggerKind::CampaignClick => "campaign_click",
        EmailJourneyTriggerKind::FieldChanged => "field_changed",
        EmailJourneyTriggerKind::DateAnniversary => "date_anniversary",
        EmailJourneyTriggerKind::Webhook => "webhook",
    }
}

// ===========================================================================
// LIST + GET + CREATE + UPDATE + DELETE
// ===========================================================================

#[instrument(skip(state, user))]
pub async fn list_journeys(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Query(q): Query<JourneysQuery>,
) -> Result<Json<ListResponse<Value>>> {
    let tenant = tenant_oid(&user)?;
    let coll = state.mongo.collection::<Document>(JOURNEYS);

    let mut filter = doc! { "userId": tenant };
    if let Some(s) = q.status {
        filter.insert("status", status_str(s));
    }
    if let Some(k) = q.trigger_kind {
        filter.insert("trigger.kind", trigger_kind_str(k));
    }

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.count")))?;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(q.page.saturating_sub(1) * q.limit)
        .limit(q.limit as i64)
        .build();

    let docs: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.find")))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.collect")))?;

    let items: Vec<Value> = docs
        .into_iter()
        .filter_map(|d| doc_to_json(d).ok())
        .collect();
    let has_more = q.page * q.limit < total;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
        has_more,
    }))
}

#[instrument(skip(state, user))]
pub async fn get_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let d = load_journey(&state, &user, &id).await?;
    Ok(Json(doc_to_json(d)?))
}

#[instrument(skip(state, user, body))]
pub async fn create_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Json(body): Json<CreateJourneyBody>,
) -> Result<(StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    let tenant = tenant_oid(&user)?;
    let now: bson::DateTime = Utc::now().into();
    let id = ObjectId::new();

    let nodes_v = serde_json::to_value(&body.nodes)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("nodes → json")))?;
    let edges_v = serde_json::to_value(&body.edges)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("edges → json")))?;

    // Default trigger if none supplied — list_join with empty config.
    let trigger_v = body
        .trigger
        .unwrap_or_else(|| json!({ "kind": "list_join", "config": {} }));

    let d = doc! {
        "_id": id,
        "userId": tenant,
        "name": body.name.trim(),
        "description": body.description.unwrap_or_default(),
        "status": "draft",
        "nodes": json_to_bson(&nodes_v),
        "edges": json_to_bson(&edges_v),
        "trigger": json_to_bson(&trigger_v),
        "reentryPolicy": "never",
        "stats": doc! {
            "entered": 0i64,
            "completed": 0i64,
            "active": 0i64,
            "goalReached": 0i64,
        },
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.insert_one")))?;

    Ok((StatusCode::CREATED, Json(doc_to_json(d)?)))
}

#[instrument(skip(state, user, body))]
pub async fn update_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<UpdateJourneyBody>,
) -> Result<Json<Value>> {
    let existing = load_journey(&state, &user, &id).await?;
    let status = parse_status(&existing)?;
    if status == EmailJourneyStatus::Archived {
        return Err(ApiError::Conflict(
            "archived journeys cannot be edited".into(),
        ));
    }

    let mut set = doc! { "updatedAt": bson::DateTime::from(Utc::now()) };
    if let Some(n) = body.name {
        set.insert("name", n.trim());
    }
    if let Some(desc) = body.description {
        set.insert("description", desc);
    }
    if let Some(nodes) = body.nodes {
        let v = serde_json::to_value(&nodes)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("nodes → json")))?;
        set.insert("nodes", json_to_bson(&v));
    }
    if let Some(edges) = body.edges {
        let v = serde_json::to_value(&edges)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("edges → json")))?;
        set.insert("edges", json_to_bson(&v));
    }
    if let Some(trig) = body.trigger {
        set.insert("trigger", json_to_bson(&trig));
    }

    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .update_one(doc! { "_id": oid, "userId": tenant }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.update_one")))?;

    let updated = load_journey(&state, &user, &id).await?;
    Ok(Json(doc_to_json(updated)?))
}

#[instrument(skip(state, user))]
pub async fn delete_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let existing = load_journey(&state, &user, &id).await?;
    let status = parse_status(&existing)?;
    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = state.mongo.collection::<Document>(JOURNEYS);

    match status {
        EmailJourneyStatus::Draft => {
            coll.delete_one(doc! { "_id": oid, "userId": tenant })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("journeys.delete_one"))
                })?;
            Ok(Json(MessageResponse {
                message: "Draft journey deleted.".into(),
            }))
        }
        EmailJourneyStatus::Active | EmailJourneyStatus::Paused => {
            coll.update_one(
                doc! { "_id": oid, "userId": tenant },
                doc! { "$set": {
                    "status": "archived",
                    "updatedAt": bson::DateTime::from(Utc::now()),
                } },
            )
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.archive")))?;
            Ok(Json(MessageResponse {
                message: "Journey archived.".into(),
            }))
        }
        EmailJourneyStatus::Archived => {
            Err(ApiError::Conflict("journey is already archived".into()))
        }
    }
}

// ===========================================================================
// LIFECYCLE: activate, pause, clone
// ===========================================================================

#[instrument(skip(state, user))]
pub async fn activate_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let journey = load_journey(&state, &user, &id).await?;
    let status = parse_status(&journey)?;
    if status == EmailJourneyStatus::Archived {
        return Err(ApiError::Conflict(
            "archived journeys cannot be activated".into(),
        ));
    }

    validate_for_activate(&journey)?;

    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": {
                "status": "active",
                "updatedAt": bson::DateTime::from(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.activate")))?;

    Ok(Json(MessageResponse {
        message: "Journey activated.".into(),
    }))
}

#[instrument(skip(state, user))]
pub async fn pause_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let journey = load_journey(&state, &user, &id).await?;
    let status = parse_status(&journey)?;
    if status != EmailJourneyStatus::Active {
        return Err(ApiError::Conflict(format!(
            "journey is `{}`, only active journeys can be paused",
            status_str(status)
        )));
    }

    let tenant = tenant_oid(&user)?;
    let oid = oid_from_str(&id)?;
    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .update_one(
            doc! { "_id": oid, "userId": tenant },
            doc! { "$set": {
                "status": "paused",
                "updatedAt": bson::DateTime::from(Utc::now()),
            } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.pause")))?;

    Ok(Json(MessageResponse {
        message: "Journey paused. Existing runs will continue ticking; the trigger is ignored."
            .into(),
    }))
}

#[instrument(skip(state, user))]
pub async fn clone_journey(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<Value>)> {
    let mut journey = load_journey(&state, &user, &id).await?;
    let new_id = ObjectId::new();
    let now: bson::DateTime = Utc::now().into();

    journey.insert("_id", new_id);
    let original_name = journey.get_str("name").unwrap_or("Journey").to_owned();
    journey.insert("name", format!("{original_name} (Copy)"));
    journey.insert("status", "draft");
    journey.insert(
        "stats",
        doc! {
            "entered": 0i64,
            "completed": 0i64,
            "active": 0i64,
            "goalReached": 0i64,
        },
    );
    journey.insert("createdAt", now);
    journey.insert("updatedAt", now);

    state
        .mongo
        .collection::<Document>(JOURNEYS)
        .insert_one(&journey)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("journeys.clone.insert")))?;

    Ok((StatusCode::CREATED, Json(doc_to_json(journey)?)))
}

// ===========================================================================
// RUNS — list + get + report
// ===========================================================================

#[instrument(skip(state, user))]
pub async fn list_runs(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RunsQuery>,
) -> Result<Json<ListResponse<Value>>> {
    let _journey = load_journey(&state, &user, &id).await?;
    let tenant = tenant_oid(&user)?;
    let journey_oid = oid_from_str(&id)?;

    let mut filter = doc! { "userId": tenant, "journeyId": journey_oid };
    if let Some(ref s) = q.status {
        if !s.is_empty() {
            filter.insert("status", s.clone());
        }
    }

    let coll = state.mongo.collection::<Document>(JOURNEY_RUNS);
    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("runs.count")))?;

    let opts = FindOptions::builder()
        .sort(doc! { "enteredAt": -1 })
        .skip(q.page.saturating_sub(1) * q.limit)
        .limit(q.limit as i64)
        .build();

    let docs: Vec<Document> = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("runs.find")))?
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("runs.collect")))?;

    let items: Vec<Value> = docs
        .into_iter()
        .filter_map(|d| doc_to_json(d).ok())
        .collect();
    let has_more = q.page * q.limit < total;
    Ok(Json(ListResponse {
        items,
        total,
        page: q.page,
        limit: q.limit,
        has_more,
    }))
}

#[instrument(skip(state, user))]
pub async fn get_run(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path((id, run_id)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let _journey = load_journey(&state, &user, &id).await?;
    let tenant = tenant_oid(&user)?;
    let journey_oid = oid_from_str(&id)?;
    let run_oid = oid_from_str(&run_id)?;

    let d = state
        .mongo
        .collection::<Document>(JOURNEY_RUNS)
        .find_one(doc! {
            "_id": run_oid,
            "userId": tenant,
            "journeyId": journey_oid,
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("runs.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("run {run_id}")))?;

    Ok(Json(doc_to_json(d)?))
}

#[instrument(skip(state, user))]
pub async fn report(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<ReportResponse>> {
    let _journey = load_journey(&state, &user, &id).await?;
    let tenant = tenant_oid(&user)?;
    let journey_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(JOURNEY_RUNS);
    let base = doc! { "userId": tenant, "journeyId": journey_oid };

    let entered = coll
        .count_documents(base.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("report.count.entered")))?;

    async fn count_status(
        coll: &mongodb::Collection<Document>,
        base: &Document,
        s: &str,
    ) -> Result<u64> {
        let mut f = base.clone();
        f.insert("status", s);
        coll.count_documents(f).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context(format!("report.count.{s}")))
        })
    }

    let active = count_status(&coll, &base, "active").await?;
    let waiting = count_status(&coll, &base, "waiting").await?;
    let completed = count_status(&coll, &base, "completed").await?;
    let exited = count_status(&coll, &base, "exited").await?;
    let errored = count_status(&coll, &base, "errored").await?;

    // Per-node breakdown: stream runs, walk `history[]`.
    // History items shape: { nodeId, kind, decision?, at }.
    let cursor = coll
        .find(base.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("report.runs.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("report.runs.collect")))?;

    let mut per_node: HashMap<String, (u64, u64, u64)> = HashMap::new(); // (total, true, false)
    for d in &docs {
        let Ok(history) = d.get_array("history") else {
            continue;
        };
        for h in history {
            let Some(hd) = h.as_document() else {
                continue;
            };
            let Some(node_id) = hd.get_str("nodeId").ok() else {
                continue;
            };
            let entry = per_node.entry(node_id.to_owned()).or_default();
            entry.0 += 1;
            match hd.get_str("decision").ok() {
                Some("true") => entry.1 += 1,
                Some("false") => entry.2 += 1,
                _ => {}
            }
        }
    }

    let mut per_node_json = Map::new();
    for (k, (total, t, f)) in per_node {
        per_node_json.insert(
            k,
            json!({
                "count": total,
                "trueCount": t,
                "falseCount": f,
            }),
        );
    }

    Ok(Json(ReportResponse {
        entered,
        active,
        waiting,
        completed,
        exited,
        errored,
        per_node: per_node_json,
    }))
}

// ===========================================================================
// ENROL (manual) + TEMPLATES library
// ===========================================================================

#[instrument(skip(state, user, body))]
pub async fn enroll_subscriber(
    State(state): State<EmailJourneysState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<EnrollBody>,
) -> Result<Json<MessageResponse>> {
    let journey = load_journey(&state, &user, &id).await?;
    let status = parse_status(&journey)?;
    if status != EmailJourneyStatus::Active && status != EmailJourneyStatus::Draft {
        return Err(ApiError::Conflict(format!(
            "journey is `{}`, manual enrol requires active or draft state",
            status_str(status)
        )));
    }

    // Subscriber must belong to the same tenant.
    let tenant = tenant_oid(&user)?;
    let sub_oid = oid_from_str(&body.subscriber_id)?;
    let _sub = state
        .mongo
        .collection::<Document>(SUBSCRIBERS)
        .find_one(doc! { "_id": sub_oid, "userId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("subscribers.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("subscriber {}", body.subscriber_id)))?;

    // Pick the entry node — the unique `type=trigger` node, falling back
    // to the first node in the array.
    let entry_node_id = entry_node_id_of(&journey)
        .ok_or_else(|| ApiError::Validation("journey has no trigger / entry node".into()))?;

    // Create the run doc.
    let journey_oid = oid_from_str(&id)?;
    let run_oid = ObjectId::new();
    let now: bson::DateTime = Utc::now().into();
    let run_doc = doc! {
        "_id": run_oid,
        "userId": tenant,
        "journeyId": journey_oid,
        "subscriberId": sub_oid,
        "currentNodeId": entry_node_id.clone(),
        "status": "active",
        "enteredAt": now,
        "history": Bson::Array(Vec::new()),
    };
    state
        .mongo
        .collection::<Document>(JOURNEY_RUNS)
        .insert_one(run_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("runs.insert_one")))?;

    // Enqueue tick for the entry node.
    let payload = json!({
        "kind": "journey-tick",
        "journeyId": id,
        "runId": run_oid.to_hex(),
        "nodeId": entry_node_id,
    });
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!("journey_tick_{}", run_oid.to_hex())),
        ..Default::default()
    };
    state
        .bull
        .add(JOURNEY_QUEUE, JOB_TICK, &payload, opts)
        .await?;

    Ok(Json(MessageResponse {
        message: format!("Subscriber {} enrolled in journey.", body.subscriber_id),
    }))
}

#[instrument(skip(_state, _user))]
pub async fn list_templates(
    State(_state): State<EmailJourneysState>,
    _user: AuthUser,
    Query(_q): Query<PageQuery>,
) -> Result<Json<Vec<Value>>> {
    Ok(Json(templates::library()))
}

// ===========================================================================
// Validation: must have a trigger node + every path must reach an exit
// ===========================================================================

/// Run a BFS over the journey's nodes + edges to confirm that:
///   1. exactly one trigger / entry node exists (we pick the first
///      `type=trigger`),
///   2. every reachable node has at least one path to a node whose
///      `type` is `exit`.
///
/// Returns `ApiError::Validation` describing the first violation. The
/// check is intentionally conservative — a node with zero outgoing
/// edges that isn't itself an exit will trip the second rule.
fn validate_for_activate(journey: &Document) -> Result<()> {
    let nodes = journey
        .get_array("nodes")
        .map_err(|_| ApiError::Validation("journey has no nodes array".into()))?;
    let edges = journey
        .get_array("edges")
        .map_err(|_| ApiError::Validation("journey has no edges array".into()))?;

    if nodes.is_empty() {
        return Err(ApiError::Validation(
            "journey must have at least one node".into(),
        ));
    }

    // Index nodes by id + collect node types.
    let mut node_kind: HashMap<String, String> = HashMap::new();
    let mut trigger_id: Option<String> = None;
    for n in nodes {
        let Some(nd) = n.as_document() else {
            continue;
        };
        let Some(id) = nd.get_str("id").ok() else {
            continue;
        };
        let kind = nd.get_str("type").unwrap_or("").to_owned();
        if kind == "trigger" && trigger_id.is_none() {
            trigger_id = Some(id.to_owned());
        }
        node_kind.insert(id.to_owned(), kind);
    }

    let trigger_id = trigger_id.ok_or_else(|| {
        ApiError::Validation("journey must contain exactly one trigger node".into())
    })?;

    // Adjacency map: source → [target...].
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for e in edges {
        let Some(ed) = e.as_document() else {
            continue;
        };
        let (Some(s), Some(t)) = (
            ed.get_str("source").ok().map(str::to_owned),
            ed.get_str("target").ok().map(str::to_owned),
        ) else {
            continue;
        };
        adj.entry(s).or_default().push(t);
    }

    // BFS from trigger; collect reachable nodes.
    let mut reachable: HashSet<String> = HashSet::new();
    let mut q: VecDeque<String> = VecDeque::new();
    q.push_back(trigger_id.clone());
    reachable.insert(trigger_id.clone());
    while let Some(cur) = q.pop_front() {
        if let Some(neighbors) = adj.get(&cur) {
            for n in neighbors {
                if reachable.insert(n.clone()) {
                    q.push_back(n.clone());
                }
            }
        }
    }

    // Every reachable node must have a path to an exit. We invert: do a
    // BFS from every exit on the reversed graph; reachable-from-exit
    // covers "can reach an exit". Then require trigger ∈ that set.
    let mut rev_adj: HashMap<String, Vec<String>> = HashMap::new();
    for (s, ts) in &adj {
        for t in ts {
            rev_adj.entry(t.clone()).or_default().push(s.clone());
        }
    }
    let mut can_reach_exit: HashSet<String> = HashSet::new();
    let mut q2: VecDeque<String> = VecDeque::new();
    for (id, k) in &node_kind {
        if k == "exit" && reachable.contains(id) {
            can_reach_exit.insert(id.clone());
            q2.push_back(id.clone());
        }
    }
    if can_reach_exit.is_empty() {
        return Err(ApiError::Validation(
            "journey must have at least one reachable exit node".into(),
        ));
    }
    while let Some(cur) = q2.pop_front() {
        if let Some(preds) = rev_adj.get(&cur) {
            for p in preds {
                if can_reach_exit.insert(p.clone()) {
                    q2.push_back(p.clone());
                }
            }
        }
    }
    if !can_reach_exit.contains(&trigger_id) {
        return Err(ApiError::Validation(
            "every path from the trigger must reach an exit node".into(),
        ));
    }

    Ok(())
}

/// Return the id of the journey's entry / trigger node — the unique
/// `type=trigger` node, or the first node in the array as a fallback.
fn entry_node_id_of(journey: &Document) -> Option<String> {
    let nodes = journey.get_array("nodes").ok()?;
    let mut first_id: Option<String> = None;
    for n in nodes {
        let Some(nd) = n.as_document() else { continue };
        let Some(id) = nd.get_str("id").ok() else {
            continue;
        };
        let kind = nd.get_str("type").unwrap_or("");
        if kind == "trigger" {
            return Some(id.to_owned());
        }
        if first_id.is_none() {
            first_id = Some(id.to_owned());
        }
    }
    first_id
}
