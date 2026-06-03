//! HTTP handlers for `/v1/telegram/settings`.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};

use crate::settings::{
    AUDIT_COLL, EffectiveSettings, GDPR_COLL, OVERRIDES_COLL, PROJECT_SETTINGS_COLL,
    ProjectSettings, deep_merge, default_project_settings, diff_settings, get_effective_settings,
    is_within_business_hours, load_project_settings, parse_iso_utc, record_audit, settings_to_bson,
};
use crate::state::TelegramSettingsState;

const PROJECTS: &str = "projects";

// ---------------------------------------------------------------------------
// Minimal IANA timezone allow-list (string match only — full timezone
// math is out of scope for this slice; the upstream client also
// surfaces this list as autocomplete options).
// ---------------------------------------------------------------------------

pub static IANA_TIMEZONES: &[&str] = &[
    "UTC",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    "America/Anchorage",
    "America/Argentina/Buenos_Aires",
    "America/Bogota",
    "America/Chicago",
    "America/Denver",
    "America/Halifax",
    "America/Lima",
    "America/Los_Angeles",
    "America/Mexico_City",
    "America/New_York",
    "America/Phoenix",
    "America/Sao_Paulo",
    "America/Santiago",
    "America/Toronto",
    "America/Vancouver",
    "Asia/Bangkok",
    "Asia/Dhaka",
    "Asia/Dubai",
    "Asia/Ho_Chi_Minh",
    "Asia/Hong_Kong",
    "Asia/Jakarta",
    "Asia/Jerusalem",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Kuala_Lumpur",
    "Asia/Manila",
    "Asia/Riyadh",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Taipei",
    "Asia/Tashkent",
    "Asia/Tehran",
    "Asia/Tokyo",
    "Asia/Yerevan",
    "Atlantic/Reykjavik",
    "Australia/Adelaide",
    "Australia/Brisbane",
    "Australia/Melbourne",
    "Australia/Perth",
    "Australia/Sydney",
    "Europe/Amsterdam",
    "Europe/Athens",
    "Europe/Berlin",
    "Europe/Bucharest",
    "Europe/Brussels",
    "Europe/Copenhagen",
    "Europe/Dublin",
    "Europe/Helsinki",
    "Europe/Istanbul",
    "Europe/Kyiv",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Moscow",
    "Europe/Oslo",
    "Europe/Paris",
    "Europe/Prague",
    "Europe/Rome",
    "Europe/Stockholm",
    "Europe/Vienna",
    "Europe/Warsaw",
    "Europe/Zurich",
    "Pacific/Auckland",
    "Pacific/Fiji",
    "Pacific/Honolulu",
];

fn is_valid_timezone(tz: &str) -> bool {
    if IANA_TIMEZONES.iter().any(|v| *v == tz) {
        return true;
    }
    // Fallback: accept `Region/City` style strings so we don't reject
    // valid zones missing from the static list. Reject obviously
    // malformed inputs.
    if tz.is_empty() || tz.len() > 64 {
        return false;
    }
    let re = match regex::Regex::new(r"^[A-Za-z_]+(/[A-Za-z_+\-0-9]+){1,2}$") {
        Ok(r) => r,
        Err(_) => return false,
    };
    re.is_match(tz)
}

fn is_valid_hhmm(s: &str) -> bool {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let Ok(h) = parts[0].parse::<u32>() else {
        return false;
    };
    let Ok(m) = parts[1].parse::<u32>() else {
        return false;
    };
    h < 24 && m < 60
}

// ---------------------------------------------------------------------------
// Shared response shape
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Default)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "requestId")]
    pub request_id: Option<String>,
}

fn err(msg: impl Into<String>) -> Json<AckResult> {
    Json(AckResult {
        success: false,
        error: Some(msg.into()),
        ..Default::default()
    })
}

fn parse_oid(s: &str) -> Option<ObjectId> {
    ObjectId::parse_str(s).ok()
}
fn parse_user_oid(u: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&u.user_id).ok()
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

// ---------------------------------------------------------------------------
// GET / PUT /  — project settings
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectQuery {
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings: Option<ProjectSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_project(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<ProjectResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(ProjectResp {
            settings: None,
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(ProjectResp {
                settings: None,
                error: Some(e),
            });
        }
    };
    match load_project_settings(&s.mongo, project_oid).await {
        Ok(settings) => Json(ProjectResp {
            settings: Some(settings),
            error: None,
        }),
        Err(e) => Json(ProjectResp {
            settings: None,
            error: Some(format!("mongo: {e}")),
        }),
    }
}

pub async fn put_project(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
    Json(body): Json<ProjectSettings>,
) -> Json<AckResult> {
    let Some(pid) = q.project_id.as_deref() else {
        return err("projectId is required");
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let user_oid = match parse_user_oid(&user) {
        Some(o) => o,
        None => return err("invalid auth subject"),
    };

    if !is_valid_timezone(&body.business_hours.timezone) {
        return err(format!(
            "invalid timezone '{}' — expected Region/City",
            body.business_hours.timezone
        ));
    }
    for entry in &body.business_hours.schedule {
        if entry.weekday > 6 {
            return err("schedule weekday must be 0..=6");
        }
        if !is_valid_hhmm(&entry.open_hhmm) || !is_valid_hhmm(&entry.close_hhmm) {
            return err("schedule open/close must be HH:MM");
        }
    }

    // Deep-merge so callers can `PUT` a partial body without losing
    // any defaults — matches the spec's "replace project settings
    // (deep merge with defaults)" semantics.
    let defaults = default_project_settings();
    let mut merged_json = match serde_json::to_value(&defaults) {
        Ok(v) => v,
        Err(e) => return err(format!("serialize defaults: {e}")),
    };
    let body_json = match serde_json::to_value(&body) {
        Ok(v) => v,
        Err(e) => return err(format!("serialize body: {e}")),
    };
    deep_merge(&mut merged_json, &body_json);
    let merged: ProjectSettings = match serde_json::from_value(merged_json.clone()) {
        Ok(v) => v,
        Err(e) => return err(format!("deserialize merged: {e}")),
    };

    let now = bson::DateTime::now();
    let coll = s.mongo.collection::<Document>(PROJECT_SETTINGS_COLL);

    // Capture previous settings so we can audit field-level diffs.
    let prev_json = match load_project_settings(&s.mongo, project_oid).await {
        Ok(prev) => serde_json::to_value(prev).unwrap_or(serde_json::Value::Null),
        Err(_) => serde_json::Value::Null,
    };

    let settings_bson = match settings_to_bson(&merged) {
        Ok(b) => b,
        Err(e) => return err(format!("encode: {e}")),
    };

    let update = doc! {
        "$set": {
            "projectId": project_oid,
            "settings": settings_bson,
            "updatedAt": now,
            "updatedBy": user.user_id.clone(),
        },
        "$setOnInsert": { "createdAt": now },
    };
    if let Err(e) = coll
        .update_one(doc! { "projectId": project_oid }, update)
        .upsert(true)
        .await
    {
        return err(format!("mongo: {e}"));
    }

    // Write the audit rows (best-effort).
    let mut audit_rows: Vec<Document> = vec![];
    for (field, old_v, new_v) in diff_settings(&prev_json, &merged_json) {
        record_audit(
            &mut audit_rows,
            user_oid,
            project_oid,
            &field,
            &old_v,
            &new_v,
        );
    }
    if !audit_rows.is_empty() {
        let _ = s
            .mongo
            .collection::<Document>(AUDIT_COLL)
            .insert_many(audit_rows)
            .await;
    }

    Json(AckResult {
        success: true,
        message: Some("Saved.".to_owned()),
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
// GET /effective?projectId=&botId=
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct EffectiveQuery {
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EffectiveResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effective: Option<EffectiveSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_effective(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<EffectiveQuery>,
) -> Json<EffectiveResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(EffectiveResp {
            effective: None,
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(EffectiveResp {
                effective: None,
                error: Some(e),
            });
        }
    };
    let bot_oid = q.bot_id.as_deref().and_then(parse_oid);
    match get_effective_settings(&s.mongo, project_oid, bot_oid).await {
        Ok(eff) => Json(EffectiveResp {
            effective: Some(eff),
            error: None,
        }),
        Err(e) => Json(EffectiveResp {
            effective: None,
            error: Some(format!("mongo: {e}")),
        }),
    }
}

// ---------------------------------------------------------------------------
// GET / PUT / DELETE /overrides
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct OverridesQuery {
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OverridesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overrides: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn get_overrides(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<OverridesQuery>,
) -> Json<OverridesResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(OverridesResp {
            overrides: None,
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(OverridesResp {
                overrides: None,
                error: Some(e),
            });
        }
    };
    let Some(bot_id) = q.bot_id.as_deref() else {
        return Json(OverridesResp {
            overrides: None,
            error: Some("botId is required".to_owned()),
        });
    };
    let Some(bot_oid) = parse_oid(bot_id) else {
        return Json(OverridesResp {
            overrides: None,
            error: Some("invalid botId".to_owned()),
        });
    };

    match s
        .mongo
        .collection::<Document>(OVERRIDES_COLL)
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await
    {
        Ok(Some(d)) => {
            let v = d
                .get("overrides")
                .cloned()
                .map(|b| serde_json::to_value(Bson::from(b)).unwrap_or(serde_json::Value::Null));
            Json(OverridesResp {
                overrides: v,
                error: None,
            })
        }
        Ok(None) => Json(OverridesResp {
            overrides: Some(serde_json::Value::Object(serde_json::Map::new())),
            error: None,
        }),
        Err(e) => Json(OverridesResp {
            overrides: None,
            error: Some(format!("mongo: {e}")),
        }),
    }
}

pub async fn put_overrides(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<OverridesQuery>,
    Json(body): Json<serde_json::Value>,
) -> Json<AckResult> {
    let Some(pid) = q.project_id.as_deref() else {
        return err("projectId is required");
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let Some(bot_id) = q.bot_id.as_deref() else {
        return err("botId is required");
    };
    let Some(bot_oid) = parse_oid(bot_id) else {
        return err("invalid botId");
    };

    let overrides_bson = match bson::to_bson(&body) {
        Ok(b) => b,
        Err(e) => return err(format!("encode: {e}")),
    };
    let now = bson::DateTime::now();
    let update = doc! {
        "$set": {
            "projectId": project_oid,
            "botId": bot_oid,
            "overrides": overrides_bson,
            "updatedAt": now,
            "updatedBy": user.user_id.clone(),
        },
        "$setOnInsert": { "createdAt": now },
    };
    if let Err(e) = s
        .mongo
        .collection::<Document>(OVERRIDES_COLL)
        .update_one(doc! { "projectId": project_oid, "botId": bot_oid }, update)
        .upsert(true)
        .await
    {
        return err(format!("mongo: {e}"));
    }
    Json(AckResult {
        success: true,
        message: Some("Saved.".to_owned()),
        ..Default::default()
    })
}

pub async fn delete_overrides(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<OverridesQuery>,
) -> Json<AckResult> {
    let Some(pid) = q.project_id.as_deref() else {
        return err("projectId is required");
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    let Some(bot_id) = q.bot_id.as_deref() else {
        return err("botId is required");
    };
    let Some(bot_oid) = parse_oid(bot_id) else {
        return err("invalid botId");
    };
    match s
        .mongo
        .collection::<Document>(OVERRIDES_COLL)
        .delete_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await
    {
        Ok(_) => Json(AckResult {
            success: true,
            message: Some("Reverted to project defaults.".to_owned()),
            ..Default::default()
        }),
        Err(e) => err(format!("mongo: {e}")),
    }
}

// ---------------------------------------------------------------------------
// POST /test-out-of-hours
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct TestHoursBody {
    pub timestamp: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TestHoursResp {
    pub within_business_hours: bool,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn test_out_of_hours(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
    Json(body): Json<TestHoursBody>,
) -> Json<TestHoursResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(TestHoursResp {
            within_business_hours: false,
            timestamp: String::new(),
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(TestHoursResp {
                within_business_hours: false,
                timestamp: String::new(),
                error: Some(e),
            });
        }
    };
    let bot_oid = body.bot_id.as_deref().and_then(parse_oid);
    let now: DateTime<Utc> = body
        .timestamp
        .as_deref()
        .and_then(parse_iso_utc)
        .unwrap_or_else(Utc::now);
    let eff = match get_effective_settings(&s.mongo, project_oid, bot_oid).await {
        Ok(v) => v,
        Err(e) => {
            return Json(TestHoursResp {
                within_business_hours: false,
                timestamp: now.to_rfc3339(),
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    Json(TestHoursResp {
        within_business_hours: is_within_business_hours(&eff, now),
        timestamp: now.to_rfc3339(),
        error: None,
    })
}

// ---------------------------------------------------------------------------
// POST /export-data /delete-data — GDPR
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct GdprBody {
    #[serde(default)]
    pub confirm: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

pub async fn export_data(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
    Json(body): Json<GdprBody>,
) -> Json<AckResult> {
    let Some(pid) = q.project_id.as_deref() else {
        return err("projectId is required");
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    enqueue_gdpr(
        &s.mongo,
        project_oid,
        &user.user_id,
        "export",
        body.reason.as_deref(),
    )
    .await
}

pub async fn delete_data(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
    Json(body): Json<GdprBody>,
) -> Json<AckResult> {
    let Some(pid) = q.project_id.as_deref() else {
        return err("projectId is required");
    };
    if body.confirm.as_deref() != Some("DELETE") {
        return err("type DELETE in the confirm field to proceed");
    }
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => return err(e),
    };
    enqueue_gdpr(
        &s.mongo,
        project_oid,
        &user.user_id,
        "delete",
        body.reason.as_deref(),
    )
    .await
}

async fn enqueue_gdpr(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    user_id: &str,
    kind: &str,
    reason: Option<&str>,
) -> Json<AckResult> {
    let now = bson::DateTime::now();
    let mut row = doc! {
        "projectId": project_oid,
        "requestedBy": user_id,
        "kind": kind,
        "status": "queued",
        "createdAt": now,
    };
    if let Some(r) = reason {
        row.insert("reason", r);
    }
    match mongo
        .collection::<Document>(GDPR_COLL)
        .insert_one(row)
        .await
    {
        Ok(res) => {
            let id = res
                .inserted_id
                .as_object_id()
                .map(|o| o.to_hex())
                .unwrap_or_default();
            Json(AckResult {
                success: true,
                message: Some("Request queued.".to_owned()),
                request_id: Some(id),
                ..Default::default()
            })
        }
        Err(e) => err(format!("mongo: {e}")),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct GdprRequestRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "requestedBy")]
    pub requested_by: String,
    pub kind: String,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GdprListResp {
    pub requests: Vec<GdprRequestRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn dt_to_iso(b: Option<bson::DateTime>) -> String {
    b.map(|d| {
        chrono::DateTime::<chrono::Utc>::from_timestamp_millis(d.timestamp_millis())
            .map(|t| t.to_rfc3339())
            .unwrap_or_default()
    })
    .unwrap_or_default()
}

pub async fn list_gdpr_requests(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<ProjectQuery>,
) -> Json<GdprListResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(GdprListResp {
            requests: vec![],
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(GdprListResp {
                requests: vec![],
                error: Some(e),
            });
        }
    };
    let cursor = match s
        .mongo
        .collection::<Document>(GDPR_COLL)
        .find(doc! { "projectId": project_oid })
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(GdprListResp {
                requests: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(GdprListResp {
                requests: vec![],
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let rows: Vec<GdprRequestRow> = docs
        .iter()
        .filter_map(|d| {
            Some(GdprRequestRow {
                _id: d.get_object_id("_id").ok()?.to_hex(),
                project_id: d.get_object_id("projectId").ok()?.to_hex(),
                requested_by: d.get_str("requestedBy").unwrap_or("").to_owned(),
                kind: d.get_str("kind").unwrap_or("export").to_owned(),
                status: d.get_str("status").unwrap_or("queued").to_owned(),
                created_at: dt_to_iso(d.get_datetime("createdAt").ok().copied()),
                reason: d.get_str("reason").ok().map(str::to_owned),
            })
        })
        .collect();
    Json(GdprListResp {
        requests: rows,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// GET /audit
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AuditQuery {
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditRow {
    pub _id: String,
    #[serde(rename = "actorId")]
    pub actor_id: String,
    pub field: String,
    #[serde(rename = "oldValue")]
    pub old_value: String,
    #[serde(rename = "newValue")]
    pub new_value: String,
    #[serde(rename = "changedAt")]
    pub changed_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AuditListResp {
    pub rows: Vec<AuditRow>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn list_audit(
    user: AuthUser,
    State(s): State<TelegramSettingsState>,
    Query(q): Query<AuditQuery>,
) -> Json<AuditListResp> {
    let Some(pid) = q.project_id.as_deref() else {
        return Json(AuditListResp {
            rows: vec![],
            next_cursor: None,
            error: Some("projectId is required".to_owned()),
        });
    };
    let project_oid = match require_project(&user, &s.mongo, pid).await {
        Ok(o) => o,
        Err(e) => {
            return Json(AuditListResp {
                rows: vec![],
                next_cursor: None,
                error: Some(e),
            });
        }
    };
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let mut filter = doc! { "projectId": project_oid };
    if let Some(cur) = q.cursor.as_deref() {
        if let Some(oid) = parse_oid(cur) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }
    let cursor = match s
        .mongo
        .collection::<Document>(AUDIT_COLL)
        .find(filter)
        .sort(doc! { "_id": -1 })
        .limit(limit + 1)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Json(AuditListResp {
                rows: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    use futures::TryStreamExt;
    let docs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            return Json(AuditListResp {
                rows: vec![],
                next_cursor: None,
                error: Some(format!("mongo: {e}")),
            });
        }
    };
    let has_more = docs.len() as i64 > limit;
    let take = docs.iter().take(limit as usize);
    let rows: Vec<AuditRow> = take
        .filter_map(|d| {
            let actor = d
                .get_object_id("actorId")
                .map(|o| o.to_hex())
                .ok()
                .or_else(|| d.get_str("actorId").ok().map(str::to_owned))
                .unwrap_or_default();
            Some(AuditRow {
                _id: d.get_object_id("_id").ok()?.to_hex(),
                actor_id: actor,
                field: d.get_str("field").unwrap_or("").to_owned(),
                old_value: d.get_str("oldValue").unwrap_or("").to_owned(),
                new_value: d.get_str("newValue").unwrap_or("").to_owned(),
                changed_at: dt_to_iso(d.get_datetime("changedAt").ok().copied()),
            })
        })
        .collect();
    let next_cursor = if has_more {
        rows.last().map(|r| r._id.clone())
    } else {
        None
    };
    Json(AuditListResp {
        rows,
        next_cursor,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Dummy
// ---------------------------------------------------------------------------

pub async fn noop() -> Json<AckResult> {
    Json(AckResult {
        success: true,
        ..Default::default()
    })
}
