//! Data model + cross-crate helpers.
//!
//! Everything in this module is intentionally `pub` so other Telegram
//! crates (broadcasts, auto-reply, sender workers, …) can call:
//!
//! ```ignore
//! use telegram_settings::{get_effective_settings, is_within_business_hours};
//! let eff = get_effective_settings(&mongo, project_oid, Some(bot_oid)).await?;
//! if !is_within_business_hours(&eff, chrono::Utc::now()) {
//!     // fall through to out-of-hours reply
//! }
//! ```

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc, Weekday};
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const PROJECT_SETTINGS_COLL: &str = "telegram_project_settings";
pub const OVERRIDES_COLL: &str = "telegram_bot_settings_overrides";
pub const GDPR_COLL: &str = "telegram_gdpr_requests";
pub const AUDIT_COLL: &str = "telegram_settings_audit";

// ---------------------------------------------------------------------------
// Public data model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitDefaults {
    #[serde(default = "default_per_chat_per_second")]
    pub per_chat_per_second: i32,
    #[serde(default = "default_per_bot_per_second")]
    pub per_bot_per_second: i32,
    #[serde(default = "default_per_bot_per_minute")]
    pub per_bot_per_minute: i32,
}

fn default_per_chat_per_second() -> i32 {
    1
}
fn default_per_bot_per_second() -> i32 {
    30
}
fn default_per_bot_per_minute() -> i32 {
    20
}

impl Default for RateLimitDefaults {
    fn default() -> Self {
        Self {
            per_chat_per_second: default_per_chat_per_second(),
            per_bot_per_second: default_per_bot_per_second(),
            per_bot_per_minute: default_per_bot_per_minute(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionDays {
    #[serde(default = "default_retention")]
    pub messages: i32,
    #[serde(default = "default_retention")]
    pub deliveries: i32,
    #[serde(default = "default_retention")]
    pub webhook_log: i32,
    #[serde(default = "default_sessions_retention")]
    pub sessions: i32,
}

fn default_retention() -> i32 {
    90
}
fn default_sessions_retention() -> i32 {
    30
}

impl Default for RetentionDays {
    fn default() -> Self {
        Self {
            messages: default_retention(),
            deliveries: default_retention(),
            webhook_log: default_retention(),
            sessions: default_sessions_retention(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DefaultsSettings {
    #[serde(default = "default_language")]
    pub language_code: String,
    #[serde(default = "default_parse_mode")]
    pub parse_mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature_line: Option<String>,
    #[serde(default)]
    pub disable_web_page_preview: bool,
    #[serde(default)]
    pub disable_notification: bool,
    #[serde(default)]
    pub allowed_languages: Vec<String>,
    #[serde(default = "default_broadcast_concurrency")]
    pub max_broadcast_concurrency: i32,
    #[serde(default)]
    pub default_rate_limit: RateLimitDefaults,
    #[serde(default)]
    pub retention_days: RetentionDays,
}

fn default_language() -> String {
    "en".to_owned()
}
fn default_parse_mode() -> String {
    "HTML".to_owned()
}
fn default_broadcast_concurrency() -> i32 {
    20
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHoursEntry {
    /// 0 = Sunday … 6 = Saturday (JS-style).
    pub weekday: u8,
    /// `HH:MM` in 24-hour clock.
    #[serde(rename = "openHHMM")]
    pub open_hhmm: String,
    #[serde(rename = "closeHHMM")]
    pub close_hhmm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutOfHoursReply {
    /// `reply_text` | `reply_media` | `noop`.
    pub kind: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHoursSettings {
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub schedule: Vec<BusinessHoursEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub out_of_hours_reply: Option<OutOfHoursReply>,
}

fn default_timezone() -> String {
    "UTC".to_owned()
}

impl Default for BusinessHoursSettings {
    fn default() -> Self {
        Self {
            timezone: default_timezone(),
            schedule: vec![],
            out_of_hours_reply: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotificationsSettings {
    #[serde(default)]
    pub daily_digest: bool,
    #[serde(default = "default_true")]
    pub error_alerts: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slack_webhook: Option<String>,
    #[serde(default)]
    pub email_recipients: Vec<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotate_webhook_secret_every_days: Option<i32>,
    #[serde(default)]
    pub require_bot_admin: bool,
    #[serde(default)]
    pub ip_allowlist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GdprSettings {
    #[serde(default = "default_retention_days_gdpr")]
    pub data_retention_days: i32,
    #[serde(default = "default_idle_days")]
    pub auto_delete_idle_chats_days: i32,
}

fn default_retention_days_gdpr() -> i32 {
    365
}
fn default_idle_days() -> i32 {
    180
}

impl Default for GdprSettings {
    fn default() -> Self {
        Self {
            data_retention_days: default_retention_days_gdpr(),
            auto_delete_idle_chats_days: default_idle_days(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub defaults: DefaultsSettings,
    pub business_hours: BusinessHoursSettings,
    pub notifications: NotificationsSettings,
    pub security: SecuritySettings,
    pub gdpr: GdprSettings,
}

/// Effective settings = project defaults overlaid with per-bot
/// overrides (if a `botId` was supplied to `get_effective_settings`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveSettings {
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    #[serde(flatten)]
    pub settings: ProjectSettings,
}

pub fn default_project_settings() -> ProjectSettings {
    ProjectSettings::default()
}

// ---------------------------------------------------------------------------
// Helpers — load / merge
// ---------------------------------------------------------------------------

fn parse_doc<T: for<'de> Deserialize<'de>>(doc: &Document) -> Option<T> {
    bson::from_bson(Bson::Document(doc.clone())).ok()
}

/// Load the raw project settings doc and merge with defaults so every
/// field is populated. Missing doc → defaults.
pub async fn load_project_settings(
    mongo: &MongoHandle,
    project_oid: ObjectId,
) -> Result<ProjectSettings, anyhow::Error> {
    let coll = mongo.collection::<Document>(PROJECT_SETTINGS_COLL);
    let Some(d) = coll.find_one(doc! { "projectId": project_oid }).await? else {
        return Ok(ProjectSettings::default());
    };
    if let Some(inner) = d.get_document("settings").ok() {
        if let Some(s) = parse_doc::<ProjectSettings>(inner) {
            return Ok(s);
        }
    }
    Ok(ProjectSettings::default())
}

/// Load the per-bot overrides doc (a partial settings tree).
pub async fn load_bot_overrides(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: ObjectId,
) -> Result<Option<serde_json::Value>, anyhow::Error> {
    let coll = mongo.collection::<Document>(OVERRIDES_COLL);
    let Some(d) = coll
        .find_one(doc! { "projectId": project_oid, "botId": bot_oid })
        .await?
    else {
        return Ok(None);
    };
    let Some(overrides) = d.get("overrides").cloned() else {
        return Ok(None);
    };
    let json: serde_json::Value =
        serde_json::to_value(bson::Bson::from(overrides)).unwrap_or(serde_json::Value::Null);
    Ok(Some(json))
}

/// Recursive deep merge — values in `overrides` win, nested objects
/// merge field-by-field, arrays/scalars in `overrides` replace.
pub fn deep_merge(base: &mut serde_json::Value, overrides: &serde_json::Value) {
    match (base, overrides) {
        (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
            for (k, v) in b {
                match a.get_mut(k) {
                    Some(existing) => deep_merge(existing, v),
                    None => {
                        a.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        (slot, v) => {
            if !v.is_null() {
                *slot = v.clone();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Public helpers callable from other crates
// ---------------------------------------------------------------------------

/// Load project settings (and merge in per-bot overrides if `bot_oid`
/// is supplied). All fields are populated with defaults so callers may
/// safely access nested fields without `Option`.
pub async fn get_effective_settings(
    mongo: &MongoHandle,
    project_oid: ObjectId,
    bot_oid: Option<ObjectId>,
) -> Result<EffectiveSettings, anyhow::Error> {
    let project_settings = load_project_settings(mongo, project_oid).await?;
    let mut json = serde_json::to_value(&project_settings)?;
    if let Some(bot_oid) = bot_oid {
        if let Some(overrides) = load_bot_overrides(mongo, project_oid, bot_oid).await? {
            deep_merge(&mut json, &overrides);
        }
    }
    let merged: ProjectSettings =
        serde_json::from_value(json).unwrap_or_else(|_| ProjectSettings::default());
    Ok(EffectiveSettings {
        project_id: project_oid.to_hex(),
        bot_id: bot_oid.map(|o| o.to_hex()),
        settings: merged,
    })
}

fn parse_hhmm(s: &str) -> Option<NaiveTime> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    NaiveTime::from_hms_opt(h, m, 0)
}

fn weekday_to_u8(w: Weekday) -> u8 {
    // chrono: Sun=6 in num_days_from_monday; use number_from_sunday.
    match w {
        Weekday::Sun => 0,
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
    }
}

/// Is the supplied UTC instant within configured business hours?
///
/// Timezone handling is intentionally simple: we treat the configured
/// IANA name purely as a label and evaluate the schedule against the
/// UTC weekday/clock. A real `chrono-tz` integration is left for a
/// follow-up — see the `IANA_TIMEZONES` list in `handlers.rs` for the
/// allow-list we validate against.
pub fn is_within_business_hours(settings: &EffectiveSettings, now: DateTime<Utc>) -> bool {
    let schedule = &settings.settings.business_hours.schedule;
    if schedule.is_empty() {
        // No schedule configured → treat as always open.
        return true;
    }
    let weekday = weekday_to_u8(now.weekday());
    let now_t = NaiveTime::from_hms_opt(now.hour(), now.minute(), now.second())
        .unwrap_or_else(|| NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    for entry in schedule {
        if entry.weekday != weekday {
            continue;
        }
        let Some(open) = parse_hhmm(&entry.open_hhmm) else {
            continue;
        };
        let Some(close) = parse_hhmm(&entry.close_hhmm) else {
            continue;
        };
        if open <= close {
            if now_t >= open && now_t <= close {
                return true;
            }
        } else if now_t >= open || now_t <= close {
            // Schedule wraps over midnight.
            return true;
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Rate-limit skeleton
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum RateLimitError {
    #[error("rate limit exceeded for bot {bot}: {reason}")]
    Exceeded { bot: String, reason: String },
    #[error("mongo: {0}")]
    Mongo(String),
}

/// Skeleton: returns `Ok(())` for now. A future worker will read the
/// effective rate limits and a Redis counter to enforce them; this
/// function exists so other crates can already wire the call through
/// their send paths.
pub async fn allowed_to_send(
    _settings: &EffectiveSettings,
    _bot_id: &str,
    _chat_id: i64,
    _mongo: &MongoHandle,
) -> Result<(), RateLimitError> {
    Ok(())
}

// ---------------------------------------------------------------------------
// Tiny helpers shared with `handlers.rs`
// ---------------------------------------------------------------------------

pub fn settings_to_bson(s: &ProjectSettings) -> Result<Bson, anyhow::Error> {
    Ok(bson::to_bson(s)?)
}

pub fn record_audit(
    docs: &mut Vec<Document>,
    actor_id: ObjectId,
    project_oid: ObjectId,
    field: &str,
    old_value: &serde_json::Value,
    new_value: &serde_json::Value,
) {
    let now = bson::DateTime::now();
    docs.push(doc! {
        "projectId": project_oid,
        "actorId": actor_id,
        "field": field,
        "oldValue": serde_json::to_string(old_value).unwrap_or_default(),
        "newValue": serde_json::to_string(new_value).unwrap_or_default(),
        "changedAt": now,
    });
}

fn json_diff_paths(
    prefix: &str,
    old: &serde_json::Value,
    new: &serde_json::Value,
    out: &mut Vec<(String, serde_json::Value, serde_json::Value)>,
) {
    match (old, new) {
        (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
            let mut keys: std::collections::BTreeSet<&String> = a.keys().collect();
            keys.extend(b.keys());
            for k in keys {
                let nested_prefix = if prefix.is_empty() {
                    k.to_string()
                } else {
                    format!("{prefix}.{k}")
                };
                let av = a.get(k).cloned().unwrap_or(serde_json::Value::Null);
                let bv = b.get(k).cloned().unwrap_or(serde_json::Value::Null);
                json_diff_paths(&nested_prefix, &av, &bv, out);
            }
        }
        (av, bv) => {
            if av != bv {
                out.push((prefix.to_string(), av.clone(), bv.clone()));
            }
        }
    }
}

/// Collect a flat list of `(field, old, new)` diffs between two JSON
/// trees. Used by the audit log writer.
pub fn diff_settings(
    old: &serde_json::Value,
    new: &serde_json::Value,
) -> Vec<(String, serde_json::Value, serde_json::Value)> {
    let mut out = vec![];
    json_diff_paths("", old, new, &mut out);
    out
}

pub fn parse_iso_utc(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
                .ok()
                .map(|ndt| Utc.from_utc_datetime(&ndt))
        })
}
