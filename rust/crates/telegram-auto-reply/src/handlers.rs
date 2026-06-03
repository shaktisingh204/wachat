//! HTTP handlers for `/v1/telegram/auto-reply`.
//!
//! Multi-tenant — every handler resolves the caller's project via
//! `require_project` before touching any rule.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;

use crate::dto::{
    AckResult, ConflictPair, ConflictsQuery, ConflictsResp, Cooldown, GetQuery, ListQuery,
    ListResp, MatchBody, MatchResp, ReorderBody, RuleRow, RunRow, RunsQuery, RunsResp, ScopedBody,
    TestBody, TestResp, UpsertBody,
};
use crate::engine::{Probe, conflict_signature, doc_to_json, evaluate_rule};
use crate::state::TelegramAutoReplyState;

const PROJECTS: &str = "projects";
const RULES: &str = "telegram_auto_reply_rules";
const RUNS: &str = "telegram_auto_reply_runs";

// ---------------------------------------------------------------------------
//  helpers
// ---------------------------------------------------------------------------

fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
}
fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}
fn dt(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}
fn dt_opt(o: Option<bson::DateTime>) -> Option<chrono::DateTime<Utc>> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
}

pub async fn require_project(
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

fn doc_to_cooldown(d: &Document) -> Cooldown {
    let sub = d.get_document("cooldown").ok();
    let i = |k: &str| -> Option<i64> {
        sub.and_then(|s| {
            s.get_i64(k)
                .ok()
                .or_else(|| s.get_i32(k).ok().map(i64::from))
        })
    };
    Cooldown {
        per_chat_seconds: i("perChatSeconds"),
        per_rule_seconds: i("perRuleSeconds"),
        per_day_limit: i("perDayLimit"),
    }
}

fn doc_to_rule_row(d: &Document, fired_7d: i64) -> Option<RuleRow> {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    let v: serde_json::Value = serde_json::from_value(raw).ok()?;
    Some(RuleRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        project_id: d.get_object_id("projectId").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok().map(|o| o.to_hex()),
        name: d.get_str("name").unwrap_or("").to_owned(),
        status: d.get_str("status").unwrap_or("enabled").to_owned(),
        priority: d
            .get_i64("priority")
            .or_else(|_| d.get_i32("priority").map(i64::from))
            .unwrap_or(100),
        trigger: v.get("trigger").cloned().unwrap_or(Value::Null),
        conditions: v
            .get("conditions")
            .and_then(|c| c.as_array())
            .cloned()
            .unwrap_or_default(),
        actions: v
            .get("actions")
            .and_then(|c| c.as_array())
            .cloned()
            .unwrap_or_default(),
        cooldown: doc_to_cooldown(d),
        run_count: d
            .get_i64("runCount")
            .or_else(|_| d.get_i32("runCount").map(i64::from))
            .unwrap_or(0),
        error_count: d
            .get_i64("errorCount")
            .or_else(|_| d.get_i32("errorCount").map(i64::from))
            .unwrap_or(0),
        last_run_at: dt_opt(d.get_datetime("lastRunAt").ok().copied()),
        fired_7d,
        created_at: dt(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt(d.get_datetime("updatedAt").ok().copied()),
    })
}

fn cooldown_to_doc(c: &Cooldown) -> Document {
    let mut out = Document::new();
    if let Some(v) = c.per_chat_seconds {
        out.insert("perChatSeconds", v);
    }
    if let Some(v) = c.per_rule_seconds {
        out.insert("perRuleSeconds", v);
    }
    if let Some(v) = c.per_day_limit {
        out.insert("perDayLimit", v);
    }
    out
}

async fn fired_7d_counts(
    mongo: &MongoHandle,
    project_oid: ObjectId,
) -> std::collections::HashMap<String, i64> {
    let since =
        bson::DateTime::from_millis((Utc::now() - ChronoDuration::days(7)).timestamp_millis());
    let pipeline = vec![
        doc! { "$match": { "projectId": project_oid, "firedAt": { "$gte": since } } },
        doc! { "$group": { "_id": "$ruleId", "n": { "$sum": 1 } } },
    ];
    let mut out = std::collections::HashMap::new();
    let Ok(mut cursor) = mongo.collection::<Document>(RUNS).aggregate(pipeline).await else {
        return out;
    };
    while let Ok(Some(d)) = cursor.try_next().await {
        if let Ok(id) = d.get_object_id("_id")
            && let Some(n) = d
                .get_i64("n")
                .ok()
                .or_else(|| d.get_i32("n").ok().map(i64::from))
        {
            out.insert(id.to_hex(), n);
        }
    }
    out
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/auto-reply/?projectId=…&botId=&status=&search=
// ---------------------------------------------------------------------------

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let project_id = match q.project_id.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => {
            return Json(ListResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ListResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let page = q.page.unwrap_or(1).max(1);
    let page_size = q.page_size.unwrap_or(50).clamp(1, 200);

    let mut filter = doc! { "projectId": project_oid };
    if let Some(bot_id) = q.bot_id.as_deref().filter(|p| !p.is_empty()) {
        match parse_oid(bot_id) {
            Some(oid) => {
                filter.insert("botId", oid);
            }
            None => {
                return Json(ListResp {
                    error: Some("invalid botId".to_owned()),
                    ..Default::default()
                });
            }
        }
    }
    if let Some(status) = q.status.as_deref().filter(|p| !p.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(search) = q.search.as_deref().filter(|p| !p.is_empty()) {
        let escaped = regex::escape(search);
        filter.insert("name", doc! { "$regex": escaped, "$options": "i" });
    }

    let total = match s
        .mongo
        .collection::<Document>(RULES)
        .count_documents(filter.clone())
        .await
    {
        Ok(n) => n as i64,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let cursor = match s
        .mongo
        .collection::<Document>(RULES)
        .find(filter)
        .sort(doc! { "priority": 1, "createdAt": 1 })
        .skip(((page - 1) * page_size) as u64)
        .limit(page_size)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let fired = fired_7d_counts(&s.mongo, project_oid).await;
    let rules: Vec<RuleRow> = docs
        .iter()
        .filter_map(|d| {
            let id = d.get_object_id("_id").ok()?.to_hex();
            let n = fired.get(&id).copied().unwrap_or(0);
            doc_to_rule_row(d, n)
        })
        .collect();

    Json(ListResp {
        rules,
        total,
        page,
        page_size,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/auto-reply/{rule_id}?projectId=…
// ---------------------------------------------------------------------------

pub async fn get_one(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Query(q): Query<GetQuery>,
) -> Json<serde_json::Value> {
    let project_id = match q.project_id.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => {
            return Json(serde_json::json!({ "error": "projectId is required" }));
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return Json(serde_json::json!({ "error": e })),
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => return Json(serde_json::json!({ "error": "invalid rule id" })),
    };
    match s
        .mongo
        .collection::<Document>(RULES)
        .find_one(doc! { "_id": rule_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => {
            let fired = fired_7d_counts(&s.mongo, project_oid).await;
            let n = fired.get(&rule_oid.to_hex()).copied().unwrap_or(0);
            match doc_to_rule_row(&d, n) {
                Some(row) => Json(serde_json::json!({ "rule": row })),
                None => Json(serde_json::json!({ "error": "malformed rule" })),
            }
        }
        Ok(None) => Json(serde_json::json!({ "error": "Rule not found." })),
        Err(e) => Json(serde_json::json!({ "error": format!("mongo: {e}") })),
    }
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/auto-reply/  — create
// ---------------------------------------------------------------------------

pub async fn create(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let bot_oid = match body.bot_id.as_deref().filter(|p| !p.is_empty()) {
        Some(b) => match parse_oid(b) {
            Some(o) => Some(o),
            None => return err("invalid botId"),
        },
        None => None,
    };

    let now = bson::DateTime::now();
    let trigger = bson::to_bson(&body.trigger).unwrap_or(Bson::Null);
    let conditions = bson::to_bson(&body.conditions).unwrap_or(Bson::Array(vec![]));
    let actions = bson::to_bson(&body.actions).unwrap_or(Bson::Array(vec![]));
    let cooldown = cooldown_to_doc(&body.cooldown.unwrap_or_default());

    let mut doc = doc! {
        "projectId": project_oid,
        "name": body.name.trim(),
        "status": body.status.unwrap_or_else(|| "enabled".to_owned()),
        "priority": body.priority.unwrap_or(100),
        "trigger": trigger,
        "conditions": conditions,
        "actions": actions,
        "cooldown": cooldown,
        "runCount": 0i64,
        "errorCount": 0i64,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(oid) = bot_oid {
        doc.insert("botId", oid);
    }

    match s.mongo.collection::<Document>(RULES).insert_one(doc).await {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                rule_id: Some(id),
                message: Some("Rule created.".to_owned()),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  PUT /v1/telegram/auto-reply/{rule_id} — full update
// ---------------------------------------------------------------------------

pub async fn update(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    if body.name.trim().is_empty() {
        return err("name is required");
    }
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => return err("invalid rule id"),
    };
    let trigger = bson::to_bson(&body.trigger).unwrap_or(Bson::Null);
    let conditions = bson::to_bson(&body.conditions).unwrap_or(Bson::Array(vec![]));
    let actions = bson::to_bson(&body.actions).unwrap_or(Bson::Array(vec![]));
    let cooldown = cooldown_to_doc(&body.cooldown.unwrap_or_default());

    let mut set = doc! {
        "name": body.name.trim(),
        "status": body.status.unwrap_or_else(|| "enabled".to_owned()),
        "priority": body.priority.unwrap_or(100),
        "trigger": trigger,
        "conditions": conditions,
        "actions": actions,
        "cooldown": cooldown,
        "updatedAt": bson::DateTime::now(),
    };
    let mut unset = Document::new();
    match body.bot_id.as_deref().filter(|p| !p.is_empty()) {
        Some(b) => match parse_oid(b) {
            Some(o) => {
                set.insert("botId", o);
            }
            None => return err("invalid botId"),
        },
        None => {
            unset.insert("botId", "");
        }
    }

    let mut update_doc = doc! { "$set": set };
    if !unset.is_empty() {
        update_doc.insert("$unset", unset);
    }

    match s
        .mongo
        .collection::<Document>(RULES)
        .update_one(
            doc! { "_id": rule_oid, "projectId": project_oid },
            update_doc,
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Rule not found."),
        Ok(_) => Json(AckResult {
            success: true,
            rule_id: Some(rule_id),
            message: Some("Rule updated.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  DELETE /v1/telegram/auto-reply/{rule_id}
// ---------------------------------------------------------------------------

pub async fn delete_rule(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Query(q): Query<GetQuery>,
) -> Json<AckResult> {
    let project_id = match q.project_id.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => return err("projectId is required"),
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => return err("invalid rule id"),
    };
    match s
        .mongo
        .collection::<Document>(RULES)
        .delete_one(doc! { "_id": rule_oid, "projectId": project_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            rule_id: Some(rule_id),
            message: Some("Rule deleted.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/auto-reply/{rule_id}/enable
//  POST /v1/telegram/auto-reply/{rule_id}/disable
// ---------------------------------------------------------------------------

async fn set_status(
    user: &AuthUser,
    s: &TelegramAutoReplyState,
    rule_id: &str,
    project_id: &str,
    status: &str,
) -> Json<AckResult> {
    let project_oid = match require_project(user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let rule_oid = match parse_oid(rule_id) {
        Some(o) => o,
        None => return err("invalid rule id"),
    };
    match s
        .mongo
        .collection::<Document>(RULES)
        .update_one(
            doc! { "_id": rule_oid, "projectId": project_oid },
            doc! { "$set": { "status": status, "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(r) if r.matched_count == 0 => err("Rule not found."),
        Ok(_) => Json(AckResult {
            success: true,
            rule_id: Some(rule_id.to_owned()),
            message: Some(format!("Rule {status}.")),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

pub async fn enable(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Json(body): Json<ScopedBody>,
) -> Json<AckResult> {
    set_status(&user, &s, &rule_id, &body.project_id, "enabled").await
}

pub async fn disable(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Json(body): Json<ScopedBody>,
) -> Json<AckResult> {
    set_status(&user, &s, &rule_id, &body.project_id, "disabled").await
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/auto-reply/{rule_id}/test
// ---------------------------------------------------------------------------

pub async fn test_rule(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Json(body): Json<TestBody>,
) -> Json<TestResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TestResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => {
            return Json(TestResp {
                error: Some("invalid rule id".to_owned()),
                ..Default::default()
            });
        }
    };
    let rule_doc = match s
        .mongo
        .collection::<Document>(RULES)
        .find_one(doc! { "_id": rule_oid, "projectId": project_oid })
        .await
    {
        Ok(Some(d)) => d,
        Ok(None) => {
            return Json(TestResp {
                error: Some("Rule not found.".to_owned()),
                ..Default::default()
            });
        }
        Err(e) => {
            return Json(TestResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };

    let rule_json = doc_to_json(&rule_doc);
    let probe: Probe = body.simulated_message.into();
    let outcome = evaluate_rule(&rule_json, &probe);
    let actions = if outcome.matched {
        rule_json
            .get("actions")
            .and_then(|a| a.as_array())
            .cloned()
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    Json(TestResp {
        matched: outcome.matched,
        actions_that_would_fire: actions,
        steps: outcome.steps,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/auto-reply/reorder
// ---------------------------------------------------------------------------

pub async fn reorder(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Json(body): Json<ReorderBody>,
) -> Json<AckResult> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let coll = s.mongo.collection::<Document>(RULES);
    for (i, id) in body.ordered_ids.iter().enumerate() {
        let Some(oid) = parse_oid(id) else { continue };
        let _ = coll
            .update_one(
                doc! { "_id": oid, "projectId": project_oid },
                doc! { "$set": { "priority": (i as i64) + 1, "updatedAt": bson::DateTime::now() } },
            )
            .await;
    }
    Json(AckResult {
        success: true,
        message: Some("Priorities updated.".to_owned()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/auto-reply/{rule_id}/runs?cursor=&limit=&projectId=
// ---------------------------------------------------------------------------

pub async fn runs(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Query(q): Query<RunsQuery>,
) -> Json<RunsResp> {
    let project_id = match q.project_id.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => {
            return Json(RunsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(RunsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => {
            return Json(RunsResp {
                error: Some("invalid rule id".to_owned()),
                ..Default::default()
            });
        }
    };
    let limit = q.limit.unwrap_or(25).clamp(1, 200);

    let mut filter = doc! { "ruleId": rule_oid, "projectId": project_oid };
    if let Some(cursor) = q.cursor.as_deref().filter(|p| !p.is_empty())
        && let Some(oid) = parse_oid(cursor)
    {
        filter.insert("_id", doc! { "$lt": oid });
    }

    let cursor = match s
        .mongo
        .collection::<Document>(RUNS)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(RunsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();
    let runs: Vec<RunRow> = docs
        .iter()
        .filter_map(|d| {
            Some(RunRow {
                _id: d.get_object_id("_id").ok()?.to_hex(),
                rule_id: d.get_object_id("ruleId").ok()?.to_hex(),
                project_id: d.get_object_id("projectId").ok()?.to_hex(),
                bot_id: d.get_object_id("botId").ok().map(|o| o.to_hex()),
                chat_id: d.get_str("chatId").ok().map(str::to_owned),
                trigger_summary: d.get_str("triggerSummary").unwrap_or("").to_owned(),
                actions_count: d
                    .get_i64("actionsCount")
                    .or_else(|_| d.get_i32("actionsCount").map(i64::from))
                    .unwrap_or(0),
                status: d.get_str("status").unwrap_or("fired").to_owned(),
                fired_at: dt(d.get_datetime("firedAt").ok().copied()),
            })
        })
        .collect();
    let next_cursor = if (runs.len() as i64) >= limit {
        runs.last().map(|r| r._id.clone())
    } else {
        None
    };
    Json(RunsResp {
        runs,
        next_cursor,
        error: None,
    })
}

// ---------------------------------------------------------------------------
//  POST /v1/telegram/auto-reply/match — internal
// ---------------------------------------------------------------------------

pub async fn match_endpoint(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Json(body): Json<MatchBody>,
) -> Json<MatchResp> {
    let project_oid = match require_project(&user, &s.mongo, &body.project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(MatchResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };
    let bot_oid = match body.bot_id.as_deref().filter(|p| !p.is_empty()) {
        Some(b) => match parse_oid(b) {
            Some(o) => Some(o),
            None => {
                return Json(MatchResp {
                    error: Some("invalid botId".to_owned()),
                    ..Default::default()
                });
            }
        },
        None => None,
    };
    let probe: Probe = body.update.into();
    match crate::match_rules(&s.mongo, project_oid, bot_oid, &probe).await {
        Ok(matched) => Json(MatchResp {
            matched,
            error: None,
        }),
        Err(e) => Json(MatchResp {
            error: Some(e),
            ..Default::default()
        }),
    }
}

// ---------------------------------------------------------------------------
//  GET /v1/telegram/auto-reply/conflicts?projectId=…
// ---------------------------------------------------------------------------

pub async fn conflicts(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Query(q): Query<ConflictsQuery>,
) -> Json<ConflictsResp> {
    let project_id = match q.project_id.as_deref().filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => {
            return Json(ConflictsResp {
                error: Some("projectId is required".to_owned()),
                ..Default::default()
            });
        }
    };
    let project_oid = match require_project(&user, &s.mongo, project_id).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ConflictsResp {
                error: Some(e),
                ..Default::default()
            });
        }
    };

    let cursor = match s
        .mongo
        .collection::<Document>(RULES)
        .find(doc! { "projectId": project_oid })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ConflictsResp {
                error: Some(format!("mongo: {e}")),
                ..Default::default()
            });
        }
    };
    let docs: Vec<Document> = cursor.try_collect().await.unwrap_or_default();

    struct Sig {
        id: String,
        name: String,
        kind: String,
        words: Vec<String>,
    }
    let sigs: Vec<Sig> = docs
        .iter()
        .filter_map(|d| {
            let id = d.get_object_id("_id").ok()?.to_hex();
            let name = d.get_str("name").unwrap_or("").to_owned();
            let trig_bson = d.get("trigger").cloned().unwrap_or(Bson::Null);
            let trig: Value = serde_json::from_value(trig_bson.into_relaxed_extjson()).ok()?;
            let (kind, words) = conflict_signature(&trig);
            Some(Sig {
                id,
                name,
                kind,
                words,
            })
        })
        .collect();

    let mut pairs: Vec<ConflictPair> = Vec::new();
    for i in 0..sigs.len() {
        for j in (i + 1)..sigs.len() {
            let a = &sigs[i];
            let b = &sigs[j];
            if a.kind.is_empty() || b.kind.is_empty() {
                continue;
            }
            let shared: Vec<String> = a
                .words
                .iter()
                .filter(|w| b.words.contains(w))
                .cloned()
                .collect();
            if !shared.is_empty() {
                pairs.push(ConflictPair {
                    rule_a_id: a.id.clone(),
                    rule_a_name: a.name.clone(),
                    rule_b_id: b.id.clone(),
                    rule_b_name: b.name.clone(),
                    reason: format!("shared {} pattern: {}", a.kind, shared.join(", ")),
                });
            }
        }
    }

    Json(ConflictsResp { pairs, error: None })
}
