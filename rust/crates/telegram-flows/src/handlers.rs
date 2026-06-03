//! HTTP handlers for the Telegram Flows visual-flow API.
//!
//! Storage layout:
//!   - `telegram_flows`            → current (draft / published / disabled) doc per flow
//!   - `telegram_flow_versions`    → immutable snapshots created on publish
//!   - `telegram_flow_runs`        → run-log records (also written by the test endpoint)
//!
//! Every handler is project-scoped via [`require_project`], which mirrors the
//! pattern used by `telegram-ads` and the rest of the Telegram crates.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, TimeZone, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::Deserialize;

use crate::dto::*;
use crate::state::TelegramFlowsState;
use crate::validation::validate_flow;

const PROJECTS: &str = "projects";
const FLOWS: &str = "telegram_flows";
const VERSIONS: &str = "telegram_flow_versions";
const RUNS: &str = "telegram_flow_runs";

// ── tiny helpers ─────────────────────────────────────────────────────────────

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err<T: AckLike>(msg: impl Into<String>) -> Json<T> {
    let mut a = T::default();
    a.set_error(msg.into());
    Json(a)
}
fn dt(o: Option<bson::DateTime>) -> DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}
fn dt_opt(o: Option<bson::DateTime>) -> Option<DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

/// Small "fill the `error` field on an envelope" trait so the various Resp
/// types can share the [`err`] helper without copy-paste.
trait AckLike: Default {
    fn set_error(&mut self, msg: String);
}

impl AckLike for AckResult {
    fn set_error(&mut self, msg: String) {
        self.success = false;
        self.error = Some(msg);
    }
}
impl AckLike for FlowResp {
    fn set_error(&mut self, msg: String) {
        self.error = Some(msg);
    }
}
impl AckLike for ListResp {
    fn set_error(&mut self, msg: String) {
        self.error = Some(msg);
    }
}
impl AckLike for VersionsResp {
    fn set_error(&mut self, msg: String) {
        self.error = Some(msg);
    }
}
impl AckLike for VersionResp {
    fn set_error(&mut self, msg: String) {
        self.error = Some(msg);
    }
}
impl AckLike for TestResp {
    fn set_error(&mut self, msg: String) {
        self.success = false;
        self.error = Some(msg);
    }
}
impl AckLike for RunsResp {
    fn set_error(&mut self, msg: String) {
        self.error = Some(msg);
    }
}

async fn require_project(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ObjectId, String> {
    let project_oid = parse_oid(project_id).ok_or_else(|| "invalid project id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Project not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Project not found.".to_owned());
    }
    Ok(project_oid)
}

// ── serde helpers (bson <-> dto) ────────────────────────────────────────────

fn trigger_to_bson(t: &FlowTrigger) -> Bson {
    bson::to_bson(t).unwrap_or_else(|_| Bson::Document(Document::new()))
}
fn nodes_to_bson(ns: &[FlowNode]) -> Bson {
    bson::to_bson(ns).unwrap_or(Bson::Array(vec![]))
}
fn edges_to_bson(es: &[FlowEdge]) -> Bson {
    bson::to_bson(es).unwrap_or(Bson::Array(vec![]))
}
fn bson_to_trigger(b: Option<&Bson>) -> FlowTrigger {
    b.and_then(|v| bson::from_bson::<FlowTrigger>(v.clone()).ok())
        .unwrap_or_default()
}
fn bson_to_nodes(b: Option<&Bson>) -> Vec<FlowNode> {
    b.and_then(|v| bson::from_bson::<Vec<FlowNode>>(v.clone()).ok())
        .unwrap_or_default()
}
fn bson_to_edges(b: Option<&Bson>) -> Vec<FlowEdge> {
    b.and_then(|v| bson::from_bson::<Vec<FlowEdge>>(v.clone()).ok())
        .unwrap_or_default()
}

fn doc_to_flow_row(d: &Document) -> Option<FlowRow> {
    Some(FlowRow {
        id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("Untitled flow").to_owned(),
        description: d.get_str("description").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("draft").to_owned(),
        version: d.get_i64("version").unwrap_or(1),
        latest_published_version: d.get_i64("latestPublishedVersion").unwrap_or(0),
        trigger: bson_to_trigger(d.get("trigger")),
        nodes: bson_to_nodes(d.get("nodes")),
        edges: bson_to_edges(d.get("edges")),
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
        last_run_at: dt_opt(d.get_datetime("lastRunAt").ok().copied()),
        run_count: d.get_i64("runCount").unwrap_or(0),
        error_count: d.get_i64("errorCount").unwrap_or(0),
    })
}

fn doc_to_version_row(d: &Document) -> Option<VersionRow> {
    Some(VersionRow {
        version: d.get_i64("version").unwrap_or(0),
        status: d.get_str("status").unwrap_or("published").to_owned(),
        published_at: dt_opt(d.get_datetime("publishedAt").ok().copied()),
        trigger: bson_to_trigger(d.get("trigger")),
        nodes: bson_to_nodes(d.get("nodes")),
        edges: bson_to_edges(d.get("edges")),
    })
}

fn doc_to_run_row(d: &Document) -> Option<RunRow> {
    let steps: Vec<TestStep> = d
        .get_array("steps")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| bson::from_bson::<TestStep>(b.clone()).ok())
                .collect()
        })
        .unwrap_or_default();
    Some(RunRow {
        id: d.get_object_id("_id").ok()?.to_hex(),
        flow_id: d.get_object_id("flowId").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        status: d.get_str("status").unwrap_or("success").to_owned(),
        started_at: dt(d.get_datetime("startedAt").ok().copied()),
        finished_at: dt_opt(d.get_datetime("finishedAt").ok().copied()),
        duration_ms: d.get_i64("durationMs").ok(),
        error: d.get_str("error").ok().map(str::to_owned),
        steps,
    })
}

// ── List ────────────────────────────────────────────────────────────────────

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };

    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(50).clamp(1, 200);

    let mut filter = doc! { "projectId": project_oid };
    if let Some(status) = q.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(search) = q.search.as_deref().filter(|s| !s.is_empty()) {
        // Mongo doesn't accept special-regex characters; we escape the common
        // ones so a user pasting `foo.bar` doesn't blow up the query.
        let escaped = regex_escape(search);
        filter.insert("name", doc! { "$regex": escaped, "$options": "i" });
    }

    let coll = s.mongo.collection::<Document>(FLOWS);
    let total = coll.count_documents(filter.clone()).await.unwrap_or(0) as i64;

    let cursor = match coll
        .find(filter)
        .sort(doc! { "updatedAt": -1 })
        .skip(((page - 1) as u64) * (limit as u64))
        .limit(limit as i64)
        .await
    {
        Ok(c) => c,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let flows = docs.iter().filter_map(doc_to_flow_row).collect();
    Json(ListResp {
        flows,
        total,
        page,
        limit,
        error: None,
    })
}

fn regex_escape(s: &str) -> String {
    let specials = [
        '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '\\', '^', '$',
    ];
    let mut out = String::with_capacity(s.len() + 4);
    for ch in s.chars() {
        if specials.contains(&ch) {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

// ── Create ──────────────────────────────────────────────────────────────────

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Json(body): Json<CreateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };

    let trigger = body.trigger.unwrap_or(FlowTrigger {
        kind: "incoming_message".to_owned(),
        ..Default::default()
    });
    let nodes = body.nodes.unwrap_or_default();
    let edges = body.edges.unwrap_or_default();
    let now = bson::DateTime::now();

    let name = body
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Untitled flow".to_owned());

    let doc = doc! {
        "projectId": project_oid,
        "userId": user_oid,
        "name": name,
        "description": body.description.unwrap_or_default(),
        "status": "draft",
        "version": 1_i64,
        "latestPublishedVersion": 0_i64,
        "trigger": trigger_to_bson(&trigger),
        "nodes": nodes_to_bson(&nodes),
        "edges": edges_to_bson(&edges),
        "runCount": 0_i64,
        "errorCount": 0_i64,
        "createdAt": now,
        "updatedAt": now,
    };

    match s.mongo.collection::<Document>(FLOWS).insert_one(doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                flow_id: Some(id),
                message: Some("Flow created.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ── Get one ─────────────────────────────────────────────────────────────────

pub async fn get_one(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<FlowResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let coll = s.mongo.collection::<Document>(FLOWS);
    let doc = match coll
        .find_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Flow not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    Json(FlowResp {
        flow: doc_to_flow_row(&doc),
        error: None,
    })
}

// ── Update (drafts only) ────────────────────────────────────────────────────

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };

    let coll = s.mongo.collection::<Document>(FLOWS);
    let current = match coll
        .find_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Flow not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    // Published flows are immutable from this endpoint — callers must
    // explicitly cycle through "disable" or create a new version (the editor
    // does this by saving over a draft and re-publishing).
    let status = current.get_str("status").unwrap_or("draft").to_owned();
    if status == "published" {
        return Json(AckResult {
            success: false,
            error: Some(
                "Cannot edit a published flow. Disable it first or create a new version."
                    .to_owned(),
            ),
            ..Default::default()
        });
    }

    let now = bson::DateTime::now();
    let mut set = doc! { "updatedAt": now };
    if let Some(n) = body.name {
        let trimmed = n.trim().to_owned();
        if !trimmed.is_empty() {
            set.insert("name", trimmed);
        }
    }
    if let Some(d) = body.description {
        set.insert("description", d);
    }
    if let Some(t) = body.trigger {
        set.insert("trigger", trigger_to_bson(&t));
    }
    if let Some(ns) = body.nodes {
        set.insert("nodes", nodes_to_bson(&ns));
    }
    if let Some(es) = body.edges {
        set.insert("edges", edges_to_bson(&es));
    }

    match coll
        .update_one(
            doc! { "_id": flow_oid, "projectId": project_oid },
            doc! { "$set": set },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Flow not found."),
        Ok(_) => Json(AckResult {
            success: true,
            flow_id: Some(flow_id),
            message: Some("Saved.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ── Delete ──────────────────────────────────────────────────────────────────

pub async fn delete_one(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let coll = s.mongo.collection::<Document>(FLOWS);
    match coll
        .delete_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(r) if r.deleted_count == 0 => err("Flow not found."),
        Ok(_) => {
            // Best-effort: nuke versions + runs alongside the flow doc.
            let _ = s
                .mongo
                .collection::<Document>(VERSIONS)
                .delete_many(doc! { "flowId": flow_oid, "projectId": project_oid })
                .await;
            let _ = s
                .mongo
                .collection::<Document>(RUNS)
                .delete_many(doc! { "flowId": flow_oid, "projectId": project_oid })
                .await;
            Json(AckResult {
                success: true,
                flow_id: Some(flow_id),
                message: Some("Deleted.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ── Publish ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct PublishBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn publish(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<PublishBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let coll = s.mongo.collection::<Document>(FLOWS);
    let current = match coll
        .find_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Flow not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };

    let trigger = bson_to_trigger(current.get("trigger"));
    let nodes = bson_to_nodes(current.get("nodes"));
    let edges = bson_to_edges(current.get("edges"));
    let errors = validate_flow(&trigger, &nodes, &edges);
    if !errors.is_empty() {
        return Json(AckResult {
            success: false,
            error: Some("Validation failed.".to_owned()),
            validation_errors: errors,
            ..Default::default()
        });
    }

    let new_version = current.get_i64("version").unwrap_or(1);
    let now = bson::DateTime::now();

    // Snapshot the current graph into the versions collection — these rows are
    // immutable history for the "Versions" panel.
    let snapshot = doc! {
        "flowId": flow_oid,
        "projectId": project_oid,
        "version": new_version,
        "status": "published",
        "publishedAt": now,
        "trigger": trigger_to_bson(&trigger),
        "nodes": nodes_to_bson(&nodes),
        "edges": edges_to_bson(&edges),
    };
    let _ = s
        .mongo
        .collection::<Document>(VERSIONS)
        .insert_one(snapshot)
        .await;

    match coll
        .update_one(
            doc! { "_id": flow_oid, "projectId": project_oid },
            doc! {
                "$set": {
                    "status": "published",
                    "latestPublishedVersion": new_version,
                    "updatedAt": now,
                },
                "$inc": { "version": 1_i64 },
            },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            flow_id: Some(flow_id),
            message: Some("Published.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ── Enable / Disable ────────────────────────────────────────────────────────

async fn set_status(
    user: &AuthUser,
    state: &TelegramFlowsState,
    flow_id: &str,
    body_project: &str,
    new_status: &str,
) -> Json<AckResult> {
    let project_oid = match require_project(user, &state.mongo, body_project).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    match state
        .mongo
        .collection::<Document>(FLOWS)
        .update_one(
            doc! { "_id": flow_oid, "projectId": project_oid },
            doc! { "$set": { "status": new_status, "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Flow not found."),
        Ok(_) => Json(AckResult {
            success: true,
            flow_id: Some(flow_id.to_owned()),
            message: Some(format!("Status set to {new_status}.")),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct StatusBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn enable(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<StatusBody>,
) -> Json<AckResult> {
    set_status(&user, &s, &flow_id, &body.project_id, "published").await
}

pub async fn disable(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<StatusBody>,
) -> Json<AckResult> {
    set_status(&user, &s, &flow_id, &body.project_id, "disabled").await
}

// ── Test (simulated run, no Telegram side effects) ──────────────────────────

pub async fn test(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<TestBody>,
) -> Json<TestResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let coll = s.mongo.collection::<Document>(FLOWS);
    let current = match coll
        .find_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Flow not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };

    let trigger = bson_to_trigger(current.get("trigger"));
    let nodes = bson_to_nodes(current.get("nodes"));
    let edges = bson_to_edges(current.get("edges"));

    // Static walk: starting from the first non-trigger action node connected
    // from the trigger, walk forward following edge `source -> target` until
    // there are no outgoing edges or we hit a step count cap. This is purely
    // declarative — no Telegram API is touched.
    let steps = simulate(&trigger, &nodes, &edges, &body.simulated_message);

    let now = bson::DateTime::now();
    let run_doc = doc! {
        "flowId": flow_oid,
        "projectId": project_oid,
        "status": "test",
        "startedAt": now,
        "finishedAt": now,
        "durationMs": 0_i64,
        "steps": bson::to_bson(&steps).unwrap_or(Bson::Array(vec![])),
        "simulated": true,
        "botId": body.bot_id.clone().unwrap_or_default(),
    };
    let _ = s
        .mongo
        .collection::<Document>(RUNS)
        .insert_one(run_doc)
        .await;
    let _ = coll
        .update_one(
            doc! { "_id": flow_oid, "projectId": project_oid },
            doc! { "$set": { "lastRunAt": now }, "$inc": { "runCount": 1_i64 } },
        )
        .await;

    Json(TestResp {
        success: true,
        steps,
        error: None,
    })
}

fn simulate(
    trigger: &FlowTrigger,
    nodes: &[FlowNode],
    edges: &[FlowEdge],
    msg: &SimulatedMessage,
) -> Vec<TestStep> {
    let mut steps = Vec::new();

    // ── Trigger match ──────────────────────────────────────────────────────
    let (trigger_match, trigger_msg) = match trigger.kind.as_str() {
        "incoming_message" => (
            msg.text.is_some(),
            "Incoming message matched the trigger.".to_owned(),
        ),
        "command" => {
            let want = trigger.command.clone().unwrap_or_default();
            let got = msg.command.clone().unwrap_or_default();
            let ok = !want.is_empty() && got == want;
            (
                ok,
                if ok {
                    format!("Command /{want} matched.")
                } else {
                    format!("Command did not match (wanted /{want}, got /{got}).")
                },
            )
        }
        "callback_query" => {
            let prefix = trigger.data_prefix.clone().unwrap_or_default();
            let data = msg.callback_data.clone().unwrap_or_default();
            let ok = !data.is_empty() && data.starts_with(&prefix);
            (
                ok,
                if ok {
                    format!("Callback data '{data}' matches prefix '{prefix}'.")
                } else {
                    format!("Callback data '{data}' does not match prefix '{prefix}'.")
                },
            )
        }
        "schedule" => (true, "Schedule fired (simulated).".to_owned()),
        "business_connection" => (true, "Business connection event (simulated).".to_owned()),
        _ => (false, format!("Unknown trigger kind '{}'.", trigger.kind)),
    };
    steps.push(TestStep {
        node_id: "trigger".to_owned(),
        node_type: format!("trigger:{}", trigger.kind),
        status: if trigger_match { "success" } else { "skipped" }.to_owned(),
        message: trigger_msg,
        output: None,
    });
    if !trigger_match {
        return steps;
    }

    // ── Find an entry node — prefer a node connected from `trigger`/`start`,
    //   else fall back to the first node.
    let mut entry: Option<&FlowNode> = None;
    for e in edges {
        if e.source == "trigger" || e.source == "start" {
            if let Some(n) = nodes.iter().find(|n| n.id == e.target) {
                entry = Some(n);
                break;
            }
        }
    }
    if entry.is_none() {
        entry = nodes.first();
    }
    let Some(start) = entry else {
        return steps;
    };

    // ── Forward walk with cycle protection ────────────────────────────────
    let mut current = start;
    let mut visited: std::collections::HashSet<&str> = std::collections::HashSet::new();
    let mut hops = 0usize;
    loop {
        if !visited.insert(current.id.as_str()) || hops > 64 {
            break;
        }
        hops += 1;

        let (status, message, output) = describe_node(current, msg);
        steps.push(TestStep {
            node_id: current.id.clone(),
            node_type: current.kind.clone(),
            status,
            message,
            output,
        });

        if current.kind == "end" {
            break;
        }

        // Pick a single outgoing edge — branch_by_* nodes use the first edge
        // whose label/sourceHandle matches; otherwise the first edge wins.
        let next_id = pick_next(current, edges, msg);
        let Some(nid) = next_id else { break };
        let Some(next) = nodes.iter().find(|n| n.id == nid) else {
            break;
        };
        current = next;
    }

    steps
}

fn describe_node(
    node: &FlowNode,
    _msg: &SimulatedMessage,
) -> (String, String, Option<serde_json::Value>) {
    let preview = match node.kind.as_str() {
        "send_message" => format!(
            "send_message → \"{}\"",
            node.data
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("(no text)")
        ),
        "send_media" => format!(
            "send_media → {}",
            node.data
                .get("caption")
                .and_then(|v| v.as_str())
                .unwrap_or("(media)")
        ),
        "send_keyboard" => "send_keyboard → inline keyboard".to_owned(),
        "wait_for_reply" => "wait_for_reply → pause for user input".to_owned(),
        "branch_by_text" => "branch_by_text → routing on message text".to_owned(),
        "branch_by_callback" => "branch_by_callback → routing on callback data".to_owned(),
        "assign_agent" => "assign_agent → handing over to a human".to_owned(),
        "tag_contact" => "tag_contact → applying tags".to_owned(),
        "set_variable" => "set_variable → updating flow variable".to_owned(),
        "http_request" => "http_request → external API call".to_owned(),
        "run_subflow" => "run_subflow → invoking nested flow".to_owned(),
        "end" => "end → flow finished".to_owned(),
        other => format!("{other} → executed"),
    };
    ("success".to_owned(), preview, Some(node.data.clone()))
}

fn pick_next(current: &FlowNode, edges: &[FlowEdge], msg: &SimulatedMessage) -> Option<String> {
    let outgoing: Vec<&FlowEdge> = edges.iter().filter(|e| e.source == current.id).collect();
    if outgoing.is_empty() {
        return None;
    }
    match current.kind.as_str() {
        "branch_by_text" => {
            if let Some(text) = msg.text.as_deref() {
                if let Some(m) = outgoing.iter().find(|e| {
                    e.label
                        .as_deref()
                        .map(|l| !l.is_empty() && text.contains(l))
                        .unwrap_or(false)
                }) {
                    return Some(m.target.clone());
                }
            }
            outgoing.first().map(|e| e.target.clone())
        }
        "branch_by_callback" => {
            if let Some(data) = msg.callback_data.as_deref() {
                if let Some(m) = outgoing.iter().find(|e| {
                    e.label
                        .as_deref()
                        .map(|l| !l.is_empty() && data.starts_with(l))
                        .unwrap_or(false)
                }) {
                    return Some(m.target.clone());
                }
            }
            outgoing.first().map(|e| e.target.clone())
        }
        _ => outgoing.first().map(|e| e.target.clone()),
    }
}

// ── Versions ────────────────────────────────────────────────────────────────

pub async fn list_versions(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<VersionsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let cursor = match s
        .mongo
        .collection::<Document>(VERSIONS)
        .find(doc! { "flowId": flow_oid, "projectId": project_oid })
        .sort(doc! { "version": -1 })
        .await
    {
        Ok(c) => c,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let versions = docs.iter().filter_map(doc_to_version_row).collect();
    Json(VersionsResp {
        versions,
        error: None,
    })
}

pub async fn get_version(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path((flow_id, version)): Path<(String, i64)>,
    Query(q): Query<ProjectScopedQuery>,
) -> Json<VersionResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let doc = match s
        .mongo
        .collection::<Document>(VERSIONS)
        .find_one(doc! { "flowId": flow_oid, "projectId": project_oid, "version": version })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Version not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    Json(VersionResp {
        version: doc_to_version_row(&doc),
        error: None,
    })
}

// ── Duplicate ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct DuplicateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

pub async fn duplicate(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Json(body): Json<DuplicateBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let coll = s.mongo.collection::<Document>(FLOWS);
    let src = match coll
        .find_one(doc! { "_id": flow_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => return err("Flow not found."),
        Err(e) => return err(format!("mongo: {e}")),
    };
    let now = bson::DateTime::now();
    let name = src.get_str("name").unwrap_or("Untitled flow").to_owned();
    let new_doc = doc! {
        "projectId": project_oid,
        "userId": user_oid,
        "name": format!("{name} (copy)"),
        "description": src.get_str("description").unwrap_or("").to_owned(),
        "status": "draft",
        "version": 1_i64,
        "latestPublishedVersion": 0_i64,
        "trigger": src.get("trigger").cloned().unwrap_or(Bson::Document(Document::new())),
        "nodes": src.get("nodes").cloned().unwrap_or(Bson::Array(vec![])),
        "edges": src.get("edges").cloned().unwrap_or(Bson::Array(vec![])),
        "runCount": 0_i64,
        "errorCount": 0_i64,
        "createdAt": now,
        "updatedAt": now,
    };
    match coll.insert_one(new_doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                flow_id: Some(id),
                message: Some("Duplicated.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ── Runs ────────────────────────────────────────────────────────────────────

pub async fn list_runs(
    user: AuthUser,
    State(s): State<TelegramFlowsState>,
    Path(flow_id): Path<String>,
    Query(q): Query<RunsQuery>,
) -> Json<RunsResp> {
    let project_id = match q.project_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let flow_oid = match parse_oid(&flow_id) {
        Some(o) => o,
        None => return err("Invalid flow id."),
    };
    let limit = q.limit.unwrap_or(25).clamp(1, 100);

    // Cursor = the last run's ObjectId hex (ObjectIds are time-ordered).
    let mut filter = doc! { "flowId": flow_oid, "projectId": project_oid };
    if let Some(cur) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        if let Some(oid) = parse_oid(cur) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }

    let cursor = match s
        .mongo
        .collection::<Document>(RUNS)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit as i64)
        .await
    {
        Ok(c) => c,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => return err(format!("mongo: {e}")),
    };
    let runs: Vec<RunRow> = docs.iter().filter_map(doc_to_run_row).collect();
    let next_cursor = runs.last().map(|r| r.id.clone());
    Json(RunsResp {
        runs,
        next_cursor,
        error: None,
    })
}
