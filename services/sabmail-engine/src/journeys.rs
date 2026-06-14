//! Journey/automation execution engine (Rust). Advances each enrolled
//! person through the stored journey graph (trigger → send → wait →
//! condition → exit) on each tick. Mirrors the TS reference engine but is
//! the production owner when the Rust engine runs.

use std::sync::Arc;

use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime, Document};
use serde::Serialize;

use crate::{db, errors::EngineResult, send, state::AppState};

#[derive(Debug, Default, Serialize)]
pub struct TickResult {
    pub processed: u64,
    pub sent: u64,
    pub completed: u64,
    pub failed: u64,
}

fn node_type(node: &Document) -> String {
    let raw = node
        .get_str("type")
        .ok()
        .map(|s| s.to_string())
        .or_else(|| {
            node.get_document("data")
                .ok()
                .and_then(|d| d.get_str("type").ok())
                .map(|s| s.to_string())
        })
        .unwrap_or_default()
        .to_lowercase();
    if raw.contains("send") || raw.contains("email") || raw.contains("message") {
        "send".into()
    } else if raw.contains("wait") || raw.contains("delay") || raw.contains("sleep") {
        "wait".into()
    } else if raw.contains("condition") || raw.contains("branch") || raw.contains("if") || raw.contains("split") {
        "condition".into()
    } else if raw.contains("exit") || raw.contains("end") || raw.contains("stop") {
        "exit".into()
    } else if raw.contains("trigger") || raw.contains("entry") || raw.contains("start") {
        "trigger".into()
    } else {
        "other".into()
    }
}

fn find_node<'a>(nodes: &'a [Bson], id: &str) -> Option<&'a Document> {
    nodes
        .iter()
        .filter_map(|n| n.as_document())
        .find(|n| n.get_str("id").map(|v| v == id).unwrap_or(false))
}

fn first_next(edges: &[Bson], from_id: &str) -> Option<String> {
    edges
        .iter()
        .filter_map(|e| e.as_document())
        .find(|e| e.get_str("source").map(|v| v == from_id).unwrap_or(false))
        .and_then(|e| e.get_str("target").ok())
        .map(|s| s.to_string())
}

/* ── condition / branch evaluation (mirrors the TS engine) ───────────────
 *
 * A condition node carries a single predicate at `node.data.predicate`
 * (a flat `node.data.{field,op,value}` is accepted as a fallback). The
 * predicate is evaluated against a per-person context (the contact doc + the
 * person's recent deliverability events) so the journey branches per person.
 * Mirrors src/lib/sabmail/journey-engine.ts exactly: supported fields, ops,
 * derived flags/counts and the yes/no edge-picking logic.
 * ──────────────────────────────────────────────────────────────────────── */

/// A condition predicate as authored by the visual builder.
struct ConditionPredicate {
    field: String,
    op: String,
    value: Option<String>,
}

/// The per-person facts a predicate is evaluated against.
#[derive(Default)]
struct ConditionContext {
    email: String,
    name: Option<String>,
    tags: Vec<String>,
    /// Flattened custom fields off the contact doc (string-coerced).
    custom: std::collections::HashMap<String, String>,
    opened: bool,
    clicked: bool,
    replied: bool,
    bounced: bool,
    inbound_count: i64,
    event_count: i64,
}

const CONDITION_OPS: &[&str] = &[
    "equals", "notEquals", "contains", "exists", "notExists", "gt", "lt",
];

/// Read a condition node's predicate from `node.data.predicate`, falling back to
/// a flat `node.data.{field,op,value}`. Returns `None` when no usable field/op is
/// present (the caller then keeps the historic structural default).
fn read_predicate(node: &Document) -> Option<ConditionPredicate> {
    let data = node.get_document("data").ok()?;
    // Prefer a nested `predicate` object; otherwise read field/op/value off data.
    let src: &Document = data.get_document("predicate").unwrap_or(data);
    let field = src.get_str("field").ok()?.trim().to_string();
    let op = src.get_str("op").ok()?.trim().to_string();
    if field.is_empty() || !CONDITION_OPS.contains(&op.as_str()) {
        return None;
    }
    // value tolerates string / number / bool in bson.
    let value = match src.get("value") {
        Some(Bson::String(s)) => Some(s.clone()),
        Some(Bson::Int32(n)) => Some(n.to_string()),
        Some(Bson::Int64(n)) => Some(n.to_string()),
        Some(Bson::Double(n)) => Some(n.to_string()),
        Some(Bson::Boolean(b)) => Some(b.to_string()),
        _ => None,
    };
    Some(ConditionPredicate { field, op, value })
}

/// Coerce a bson value to a comparable lowercased/trimmed string.
fn bson_cmp_string(b: &Bson) -> String {
    match b {
        Bson::String(s) => s.trim().to_lowercase(),
        Bson::Int32(n) => n.to_string(),
        Bson::Int64(n) => n.to_string(),
        Bson::Double(n) => n.to_string(),
        Bson::Boolean(v) => v.to_string(),
        Bson::Array(a) => a
            .iter()
            .map(bson_cmp_string)
            .collect::<Vec<_>>()
            .join(",")
            .to_lowercase(),
        _ => String::new(),
    }
}

/// Build the per-person context: contact doc ({workspaceId,email}) + recent
/// events ({workspaceId, email|from === personEmail}); derive flags/counts.
/// Defensive — any Mongo error yields an empty context (predicate → false).
async fn build_condition_context(
    state: &Arc<AppState>,
    workspace_id: &str,
    person_email: &str,
) -> ConditionContext {
    let email = person_email.trim().to_lowercase();
    let mut ctx = ConditionContext {
        email: email.clone(),
        ..Default::default()
    };
    if workspace_id.is_empty() || email.is_empty() {
        return ctx;
    }

    let contacts = state.mongo.collection::<Document>(db::COL_CONTACTS);
    if let Ok(Some(contact)) = contacts
        .find_one(doc! { "workspaceId": workspace_id, "email": &email })
        .await
    {
        ctx.name = contact.get_str("name").ok().map(|s| s.to_string());
        if let Ok(tags) = contact.get_array("tags") {
            ctx.tags = tags
                .iter()
                .map(bson_cmp_string)
                .filter(|s| !s.is_empty())
                .collect();
        }
        // Flatten remaining scalar fields as custom fields (string-coerced).
        for (k, v) in contact.iter() {
            match k.as_str() {
                "_id" | "workspaceId" | "email" | "name" | "tags" => continue,
                _ => {
                    ctx.custom.insert(k.clone(), bson_cmp_string(v));
                }
            }
        }
    }

    // Outbound deliverability events key off `email`; inbound replies off `from`.
    let events_col = state.mongo.collection::<Document>(db::COL_EVENTS);
    let filter = doc! {
        "workspaceId": workspace_id,
        "$or": [ { "email": &email }, { "from": &email } ],
    };
    if let Ok(mut cursor) = events_col.find(filter).sort(doc! { "ts": -1 }).limit(200).await {
        use futures_util_compat::Streamish;
        if let Ok(events) = Streamish::collect(&mut cursor).await {
            ctx.event_count = events.len() as i64;
            for ev in &events {
                let name = ev.get_str("event").unwrap_or_default().to_lowercase();
                match name.as_str() {
                    "open" => ctx.opened = true,
                    "click" => ctx.clicked = true,
                    "bounce" => ctx.bounced = true,
                    "inbound" => {
                        let from = ev.get_str("from").unwrap_or_default().trim().to_lowercase();
                        if from == email {
                            ctx.replied = true;
                            ctx.inbound_count += 1;
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    ctx
}

/// Resolve a predicate field against the context. Returns
/// (kind, string_value, bool_value, number_value, is_tag, tags_present).
/// kind: 0=string, 1=boolean, 2=number, 3=tag.
struct Resolved {
    kind: u8,
    s: String,
    b: bool,
    n: f64,
    present: bool,
}

fn resolve_field(field: &str, ctx: &ConditionContext) -> Resolved {
    let str_resolved = |val: String| Resolved {
        kind: 0,
        present: !val.trim().is_empty(),
        s: val,
        b: false,
        n: f64::NAN,
    };
    let bool_resolved = |val: bool| Resolved {
        kind: 1,
        present: val,
        s: String::new(),
        b: val,
        n: f64::NAN,
    };
    let num_resolved = |val: i64| Resolved {
        kind: 2,
        present: true,
        s: String::new(),
        b: false,
        n: val as f64,
    };

    match field {
        "tag" => Resolved {
            kind: 3,
            present: !ctx.tags.is_empty(),
            s: String::new(),
            b: false,
            n: f64::NAN,
        },
        "email" => str_resolved(ctx.email.clone()),
        "name" => str_resolved(ctx.name.clone().unwrap_or_default().to_lowercase()),
        // "domain" is an alias healing graphs saved with the legacy key.
        "emailDomain" | "domain" => {
            let domain = ctx
                .email
                .rsplit_once('@')
                .map(|(_, d)| d.to_string())
                .unwrap_or_default();
            str_resolved(domain)
        }
        "opened" => bool_resolved(ctx.opened),
        "clicked" => bool_resolved(ctx.clicked),
        "replied" => bool_resolved(ctx.replied),
        "bounced" => bool_resolved(ctx.bounced),
        "inboundCount" => num_resolved(ctx.inbound_count),
        "eventCount" => num_resolved(ctx.event_count),
        // Any other string → a custom field on the contact doc.
        other => str_resolved(ctx.custom.get(other).cloned().unwrap_or_default()),
    }
}

/// Evaluate a predicate against the context. Defensive — unknown op / field
/// returns false. Mirrors `evaluateSabmailCondition` in the TS engine.
fn evaluate_condition(pred: &ConditionPredicate, ctx: &ConditionContext) -> bool {
    if pred.field.is_empty() || !CONDITION_OPS.contains(&pred.op.as_str()) {
        return false;
    }
    let r = resolve_field(&pred.field, ctx);
    let wanted = pred.value.clone().unwrap_or_default();
    let wanted_lc = wanted.trim().to_lowercase();

    match pred.op.as_str() {
        "exists" => r.present,
        "notExists" => !r.present,
        "equals" => match r.kind {
            3 => ctx.tags.iter().any(|t| t.trim().to_lowercase() == wanted_lc),
            1 => {
                let want = if pred.value.is_none() { true } else { wanted_lc == "true" };
                r.b == want
            }
            2 => r.n.to_string() == wanted_lc,
            _ => r.s == wanted_lc,
        },
        "notEquals" => match r.kind {
            3 => !ctx.tags.iter().any(|t| t.trim().to_lowercase() == wanted_lc),
            1 => {
                let want = if pred.value.is_none() { true } else { wanted_lc == "true" };
                r.b != want
            }
            2 => r.n.to_string() != wanted_lc,
            _ => r.s != wanted_lc,
        },
        "contains" => match r.kind {
            3 => ctx
                .tags
                .iter()
                .any(|t| t.to_lowercase().contains(&wanted_lc)),
            _ => r.s.contains(&wanted_lc),
        },
        "gt" => {
            let a = if r.kind == 2 { r.n } else { r.s.parse::<f64>().unwrap_or(f64::NAN) };
            let b = wanted.trim().parse::<f64>().unwrap_or(f64::NAN);
            a.is_finite() && b.is_finite() && a > b
        }
        "lt" => {
            let a = if r.kind == 2 { r.n } else { r.s.parse::<f64>().unwrap_or(f64::NAN) };
            let b = wanted.trim().parse::<f64>().unwrap_or(f64::NAN);
            a.is_finite() && b.is_finite() && a < b
        }
        _ => false,
    }
}

/// An edge's handle/label, lowercased — used for yes/no branch matching.
fn edge_handle(edge: &Document) -> String {
    edge.get_str("sourceHandle")
        .ok()
        .or_else(|| edge.get_str("label").ok())
        .or_else(|| {
            edge.get_document("data")
                .ok()
                .and_then(|d| d.get_str("label").ok())
        })
        .unwrap_or_default()
        .to_lowercase()
}

fn handle_is_yes(h: &str) -> bool {
    h.contains("yes") || h.contains("true") || h.contains("match") || h.contains("default") || h.contains("positive")
}

fn handle_is_no(h: &str) -> bool {
    h.contains("no") || h.contains("false") || h.contains("else") || h.contains("negative")
}

/// Outgoing edges of a node, in stable order.
fn outgoing<'a>(edges: &'a [Bson], from_id: &str) -> Vec<&'a Document> {
    edges
        .iter()
        .filter_map(|e| e.as_document())
        .filter(|e| e.get_str("source").map(|v| v == from_id).unwrap_or(false))
        .collect()
}

fn edge_target(edge: &Document) -> Option<String> {
    edge.get_str("target").ok().map(|s| s.to_string())
}

/// Pick the successor of a condition node given an evaluated result, mirroring
/// `pickConditionNextByResult` in the TS engine. Falls back to `first_next` so a
/// mis-wired branch still advances.
fn pick_condition_next(edges: &[Bson], from_id: &str, result: bool) -> Option<String> {
    let out = outgoing(edges, from_id);
    if out.is_empty() {
        return None;
    }
    if result {
        let yes = out.iter().find(|e| handle_is_yes(&edge_handle(e)));
        let chosen = yes.copied().unwrap_or(out[0]);
        return edge_target(chosen).or_else(|| first_next(edges, from_id));
    }
    // result == false
    if let Some(no) = out.iter().find(|e| handle_is_no(&edge_handle(e))) {
        return edge_target(no).or_else(|| first_next(edges, from_id));
    }
    // No explicit "no" edge — take the first edge that ISN'T the yes/match edge.
    let yes_target = out
        .iter()
        .find(|e| handle_is_yes(&edge_handle(e)))
        .and_then(|e| edge_target(e));
    if let Some(other) = out
        .iter()
        .find(|e| edge_target(e) != yes_target)
    {
        return edge_target(other).or_else(|| first_next(edges, from_id));
    }
    first_next(edges, from_id)
}

fn node_data_str(node: &Document, key: &str) -> Option<String> {
    node.get_document("data")
        .ok()
        .and_then(|d| d.get_str(key).ok())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

fn node_data_i64(node: &Document, key: &str) -> Option<i64> {
    node.get_document("data").ok().and_then(|d| {
        d.get_i64(key)
            .ok()
            .or_else(|| d.get_i32(key).ok().map(|v| v as i64))
    })
}

/// Read a numeric `data.<key>` tolerating bson Double / Int64 / Int32 (the
/// React-Flow editor writes a JS number → bson Double, which `node_data_i64`
/// would miss).
fn node_data_num(node: &Document, key: &str) -> Option<f64> {
    let d = node.get_document("data").ok()?;
    d.get_f64(key)
        .ok()
        .or_else(|| d.get_i64(key).ok().map(|v| v as f64))
        .or_else(|| d.get_i32(key).ok().map(|v| v as f64))
}

/// Read a `data.<key>` string normalized (trimmed + lowercased) — for unit names.
fn node_data_unit(node: &Document, key: &str) -> Option<String> {
    node.get_document("data")
        .ok()
        .and_then(|d| d.get_str(key).ok())
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
}

/// Seconds per time unit — mirrors the TS engine's MS_PER_UNIT table
/// (src/lib/sabmail/journey-engine.ts). Unknown units return None so the caller
/// can apply the same `?? days` default the TS side uses.
fn unit_to_secs(unit: &str) -> Option<f64> {
    match unit {
        "ms" | "millisecond" | "milliseconds" => Some(0.001),
        "s" | "sec" | "secs" | "second" | "seconds" => Some(1.0),
        "m" | "min" | "mins" | "minute" | "minutes" => Some(60.0),
        "h" | "hr" | "hrs" | "hour" | "hours" => Some(3_600.0),
        "d" | "day" | "days" => Some(86_400.0),
        "w" | "week" | "weeks" => Some(604_800.0),
        _ => None,
    }
}

/// Resolve a wait node's delay in SECONDS, mirroring the TS `readDelayMs`
/// (src/lib/sabmail/journey-engine.ts). Precedence: explicit delayMs/durationMs;
/// then amount (delay/duration/amount/value/wait) × unit (default days); then
/// legacy delaySeconds; then a 24h fallback. Without this the editor's
/// `{ delay, unit }` shape never matched and every Rust-engine wait collapsed
/// to 24h.
fn read_delay_secs(node: &Document) -> i64 {
    // (a) explicit milliseconds
    if let Some(ms) = node_data_num(node, "delayMs").or_else(|| node_data_num(node, "durationMs")) {
        if ms.is_finite() && ms > 0.0 {
            return (ms / 1000.0).max(1.0) as i64;
        }
    }
    // (b) amount × unit
    let amount = node_data_num(node, "delay")
        .or_else(|| node_data_num(node, "duration"))
        .or_else(|| node_data_num(node, "amount"))
        .or_else(|| node_data_num(node, "value"))
        .or_else(|| node_data_num(node, "wait"));
    if let Some(amount) = amount {
        if amount.is_finite() && amount > 0.0 {
            let unit = node_data_unit(node, "unit")
                .or_else(|| node_data_unit(node, "delayUnit"))
                .or_else(|| node_data_unit(node, "durationUnit"))
                .unwrap_or_else(|| "days".to_string());
            let unit_secs = unit_to_secs(&unit).unwrap_or(86_400.0);
            return (amount * unit_secs).max(1.0) as i64;
        }
    }
    // (c) legacy delaySeconds
    if let Some(s) = node_data_i64(node, "delaySeconds") {
        if s > 0 {
            return s;
        }
    }
    // (d) default 24h
    86_400
}

/// One tick: advance up to `limit` active runs whose `nextRunAt` is due.
pub async fn tick(state: &Arc<AppState>) -> EngineResult<TickResult> {
    let mut out = TickResult::default();
    let now = chrono::Utc::now();
    let now_bson = BsonDateTime::from_millis(now.timestamp_millis());

    let runs_col = state.mongo.collection::<Document>(db::COL_JOURNEY_RUNS);
    let journeys_col = state.mongo.collection::<Document>(db::COL_JOURNEYS);

    let filter = doc! {
        "status": "active",
        "nextRunAt": { "$lte": now_bson },
    };
    let mut cursor = runs_col.find(filter).limit(100).await?;

    use futures_util_compat::Streamish;
    let runs = Streamish::collect(&mut cursor).await?;

    for run in runs {
        out.processed += 1;
        let run_id = match run.get_object_id("_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        let workspace_id = run.get_str("workspaceId").unwrap_or_default().to_string();
        let person = run.get_str("personEmail").unwrap_or_default().to_string();
        let current_id = run.get_str("currentNodeId").ok().map(|s| s.to_string());
        let run_account = run.get_str("accountId").ok().map(|s| s.to_string());

        let journey_oid = match run
            .get_str("journeyId")
            .ok()
            .and_then(|j| ObjectId::parse_str(j).ok())
        {
            Some(o) => o,
            None => {
                let _ = complete(&runs_col, &run_id, "failed").await;
                out.failed += 1;
                continue;
            }
        };
        let journey = journeys_col
            .find_one(doc! { "_id": journey_oid, "workspaceId": &workspace_id })
            .await?;
        let journey = match journey {
            Some(j) if j.get_bool("enabled").unwrap_or(false) => j,
            _ => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };

        let empty: Vec<Bson> = Vec::new();
        let nodes = journey.get_array("nodes").unwrap_or(&empty);
        let edges = journey.get_array("edges").unwrap_or(&empty);

        let cur_id = match current_id {
            Some(c) => c,
            None => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };
        let node = match find_node(nodes, &cur_id) {
            Some(n) => n,
            None => {
                let _ = complete(&runs_col, &run_id, "completed").await;
                out.completed += 1;
                continue;
            }
        };

        match node_type(node).as_str() {
            "send" => {
                let account_id = node_data_str(node, "accountId").or(run_account.clone());
                let subject = node_data_str(node, "subject").unwrap_or_else(|| "(no subject)".into());
                let html = node_data_str(node, "html");
                if let Some(account_id) = account_id {
                    let res = send::send_message(
                        state,
                        send::SendRequest {
                            workspace_id: workspace_id.clone(),
                            account_id,
                            to: vec![person.clone()],
                            cc: vec![],
                            bcc: vec![],
                            subject,
                            html,
                            text: node_data_str(node, "text"),
                        },
                    )
                    .await;
                    match res {
                        Ok(_) => out.sent += 1,
                        Err(_) => out.failed += 1,
                    }
                }
                advance(&runs_col, &run_id, first_next(edges, &cur_id), now_bson).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
            "wait" => {
                let delay = read_delay_secs(node).max(1);
                let next_at = BsonDateTime::from_millis(
                    (now + chrono::Duration::seconds(delay)).timestamp_millis(),
                );
                advance(&runs_col, &run_id, first_next(edges, &cur_id), next_at).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
            "exit" => {
                complete(&runs_col, &run_id, "completed").await?;
                out.completed += 1;
            }
            "condition" => {
                // Real per-person branching: read the predicate, build the
                // context, evaluate, and pick the yes/no edge. No predicate →
                // historic structural default (prefer yes-edge, else first).
                let next = match read_predicate(node) {
                    Some(pred) => {
                        let ctx =
                            build_condition_context(state, &workspace_id, &person).await;
                        let result = evaluate_condition(&pred, &ctx);
                        pick_condition_next(edges, &cur_id, result)
                    }
                    None => pick_condition_next(edges, &cur_id, true),
                };
                let terminal = next.is_none();
                advance(&runs_col, &run_id, next, now_bson).await?;
                if terminal {
                    out.completed += 1;
                }
            }
            _ => {
                // other / pass-through → take the first outgoing edge, run now.
                advance(&runs_col, &run_id, first_next(edges, &cur_id), now_bson).await?;
                if first_next(edges, &cur_id).is_none() {
                    out.completed += 1;
                }
            }
        }
    }

    Ok(out)
}

async fn advance(
    runs: &mongodb::Collection<Document>,
    run_id: &ObjectId,
    next: Option<String>,
    next_run_at: BsonDateTime,
) -> EngineResult<()> {
    let now = BsonDateTime::from_millis(chrono::Utc::now().timestamp_millis());
    match next {
        Some(next_id) => {
            runs.update_one(
                doc! { "_id": run_id },
                doc! { "$set": { "currentNodeId": next_id, "nextRunAt": next_run_at, "updatedAt": now } },
            )
            .await?;
        }
        None => {
            runs.update_one(
                doc! { "_id": run_id },
                doc! { "$set": { "status": "completed", "currentNodeId": Bson::Null, "nextRunAt": Bson::Null, "updatedAt": now } },
            )
            .await?;
        }
    }
    Ok(())
}

async fn complete(
    runs: &mongodb::Collection<Document>,
    run_id: &ObjectId,
    status: &str,
) -> EngineResult<()> {
    let now = BsonDateTime::from_millis(chrono::Utc::now().timestamp_millis());
    runs.update_one(
        doc! { "_id": run_id },
        doc! { "$set": { "status": status, "currentNodeId": Bson::Null, "nextRunAt": Bson::Null, "updatedAt": now } },
    )
    .await?;
    Ok(())
}

/// Minimal cursor collector to avoid pulling the futures crate directly.
mod futures_util_compat {
    use mongodb::bson::Document;
    use mongodb::Cursor;

    pub struct Streamish;
    impl Streamish {
        pub async fn collect(cursor: &mut Cursor<Document>) -> Result<Vec<Document>, mongodb::error::Error> {
            let mut out = Vec::new();
            while cursor.advance().await? {
                out.push(cursor.deserialize_current()?);
            }
            Ok(out)
        }
    }
}
