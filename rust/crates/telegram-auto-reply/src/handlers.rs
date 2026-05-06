use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;

use crate::dto::{
    AckResult, DeleteQuery, ListQuery, ListResp, RuleRow, ToggleBody, UpsertBody,
};
use crate::state::TelegramAutoReplyState;

const PROJECTS: &str = "projects";
const BOTS: &str = "telegram_bots";
const RULES: &str = "telegram_auto_replies";

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
fn dt_or_now(o: Option<bson::DateTime>) -> chrono::DateTime<Utc> {
    o.and_then(|b| Utc.timestamp_millis_opt(b.timestamp_millis()).single())
        .unwrap_or_else(Utc::now)
}

async fn require_bot(
    user: &AuthUser,
    mongo: &MongoHandle,
    bot_id_hex: &str,
) -> Result<Document, String> {
    let bot_oid = parse_oid(bot_id_hex).ok_or_else(|| "invalid bot id".to_owned())?;
    let user_oid = parse_user_oid(user).ok_or_else(|| "invalid auth subject".to_owned())?;
    let bot = mongo
        .collection::<Document>(BOTS)
        .find_one(doc! { "_id": bot_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    let project_oid = bot
        .get_object_id("projectId")
        .map_err(|_| "bot is missing projectId".to_owned())?;
    let project = mongo
        .collection::<Document>(PROJECTS)
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| format!("mongo: {e}"))?
        .ok_or_else(|| "Bot not found.".to_owned())?;
    if project.get_object_id("userId").ok() != Some(user_oid) {
        return Err("Bot not found.".to_owned());
    }
    Ok(bot)
}

fn doc_to_rule(d: &Document) -> Option<RuleRow> {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    let v: serde_json::Value = serde_json::from_value(raw).ok()?;
    Some(RuleRow {
        _id: d.get_object_id("_id").ok()?.to_hex(),
        bot_id: d.get_object_id("botId").ok()?.to_hex(),
        name: d.get_str("name").unwrap_or("").to_owned(),
        trigger: v.get("trigger").cloned().unwrap_or(serde_json::Value::Null),
        pattern: d.get_str("pattern").ok().map(str::to_owned),
        case_sensitive: d.get_bool("caseSensitive").unwrap_or(false),
        match_mode: d.get_str("matchMode").unwrap_or("contains").to_owned(),
        response: v.get("response").cloned().unwrap_or(serde_json::Value::Null),
        is_active: d.get_bool("isActive").unwrap_or(true),
        priority: d
            .get_i64("priority")
            .or_else(|_| d.get_i32("priority").map(i64::from))
            .unwrap_or(100),
        inside_business_hours_only: d.get_bool("insideBusinessHoursOnly").unwrap_or(false),
        hits: d
            .get_i64("hits")
            .or_else(|_| d.get_i32("hits").map(i64::from))
            .unwrap_or(0),
        created_at: dt_or_now(d.get_datetime("createdAt").ok().copied()),
        updated_at: dt_or_now(d.get_datetime("updatedAt").ok().copied()),
    })
}

// =========================================================================
//  GET /v1/telegram/auto-reply?botId=…
// =========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Query(q): Query<ListQuery>,
) -> Json<ListResp> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Json(ListResp {
                rules: vec![],
                error: Some("botId is required".to_owned()),
            });
        }
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => {
            return Json(ListResp {
                rules: vec![],
                error: Some(e),
            });
        }
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => {
            return Json(ListResp {
                rules: vec![],
                error: Some("bot is malformed".to_owned()),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(RULES)
        .find(doc! { "botId": bot_oid })
        .sort(doc! { "priority": 1, "createdAt": 1 })
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(ListResp {
                rules: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(ListResp {
                rules: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let rules = docs.iter().filter_map(doc_to_rule).collect();
    Json(ListResp { rules, error: None })
}

// =========================================================================
//  POST /v1/telegram/auto-reply  — upsert
// =========================================================================

pub async fn upsert(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Json(body): Json<UpsertBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let project_oid = match bot.get_object_id("projectId") {
        Ok(o) => o,
        Err(_) => return err("Bot is missing projectId."),
    };

    let now = bson::DateTime::now();
    let trigger_doc = bson::to_bson(&body.trigger).unwrap_or(bson::Bson::Null);
    let response_doc = bson::to_bson(&body.response).unwrap_or(bson::Bson::Null);
    let mut set = doc! {
        "botId": bot_oid,
        "projectId": project_oid,
        "name": body.name,
        "trigger": trigger_doc,
        "caseSensitive": body.case_sensitive.unwrap_or(false),
        "matchMode": body.match_mode.unwrap_or_else(|| "contains".to_owned()),
        "response": response_doc,
        "isActive": body.is_active.unwrap_or(true),
        "priority": body.priority.unwrap_or(100),
        "insideBusinessHoursOnly": body.inside_business_hours_only.unwrap_or(false),
        "updatedAt": now,
    };
    if let Some(p) = body.pattern {
        set.insert("pattern", p);
    }

    let coll = s.mongo.collection::<Document>(RULES);

    if let Some(rule_id) = body.rule_id.as_deref() {
        let oid = match parse_oid(rule_id) {
            Some(o) => o,
            None => return err("Invalid rule id."),
        };
        let res = coll
            .update_one(doc! { "_id": oid, "botId": bot_oid }, doc! { "$set": set })
            .await;
        match res {
            Ok(r) if r.matched_count == 0 => err("Rule not found."),
            Ok(_) => Json(AckResult {
                success: true,
                rule_id: Some(rule_id.to_owned()),
                message: Some("Rule updated.".to_owned()),
                ..Default::default()
            }),
            Err(e) => err(format!("mongo: {e}")),
        }
    } else {
        set.insert("hits", 0i64);
        set.insert("createdAt", now);
        match coll.insert_one(set).await {
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
}

// =========================================================================
//  DELETE /v1/telegram/auto-reply/{rule_id}?botId=…
// =========================================================================

pub async fn delete_rule(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Query(q): Query<DeleteQuery>,
) -> Json<AckResult> {
    let bot_id = match q.bot_id.as_deref() {
        Some(p) if !p.is_empty() => p,
        _ => return err("botId is required"),
    };
    let bot = match require_bot(&user, &s.mongo, bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => return err("Invalid rule id."),
    };

    match s
        .mongo
        .collection::<Document>(RULES)
        .delete_one(doc! { "_id": rule_oid, "botId": bot_oid })
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

// =========================================================================
//  POST /v1/telegram/auto-reply/{rule_id}/toggle
// =========================================================================

pub async fn toggle(
    user: AuthUser,
    State(s): State<TelegramAutoReplyState>,
    Path(rule_id): Path<String>,
    Json(body): Json<ToggleBody>,
) -> Json<AckResult> {
    let bot = match require_bot(&user, &s.mongo, &body.bot_id).await {
        Ok(b) => b,
        Err(e) => return err(e),
    };
    let bot_oid = match bot.get_object_id("_id") {
        Ok(o) => o,
        Err(_) => return err("Bot not found."),
    };
    let rule_oid = match parse_oid(&rule_id) {
        Some(o) => o,
        None => return err("Invalid rule id."),
    };

    match s
        .mongo
        .collection::<Document>(RULES)
        .update_one(
            doc! { "_id": rule_oid, "botId": bot_oid },
            doc! { "$set": { "isActive": body.is_active, "updatedAt": bson::DateTime::now() } },
        )
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            rule_id: Some(rule_id),
            message: Some("Rule toggled.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}
