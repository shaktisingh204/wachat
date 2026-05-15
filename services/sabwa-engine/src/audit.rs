//! Audit-log helper used by every mutating route.
//!
//! Goal: every state-mutating server-action equivalent in the Rust API writes
//! one row to the `sabwa_audit_log` collection. Call sites use
//! [`record`] inside `tokio::spawn` or simply `.await.ok()` so audit-write
//! failures never break the originating request — failures are surfaced via
//! `tracing::warn!` only.
//!
//! See SABWA_PLAN.md §3 (Collections) — `sabwa_audit_log` row shape.

use axum::http::HeaderMap;
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{bson::doc, Collection};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::db::serde_dates::chrono_dt;
use crate::state::AppState;

/// Logical row written to `sabwa_audit_log`.
///
/// Field types intentionally use `String` for ids — we store admin-facing
/// hex/uuid identifiers verbatim, mirroring the Next.js server-action shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// e.g., `"session.pair"`, `"message.send"`, `"group.add_participants"`.
    pub action: String,
    /// `"session" | "chat" | "group" | "scheduled" | ...`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,
    #[serde(default)]
    pub metadata: JsonValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(with = "chrono_dt")]
    pub ts: DateTime<Utc>,
}

impl AuditEntry {
    /// Build a fresh entry with `ts = now()` and empty metadata.
    pub fn new(project_id: impl Into<String>, action: impl Into<String>) -> Self {
        Self {
            project_id: project_id.into(),
            user_id: None,
            session_id: None,
            action: action.into(),
            target_kind: None,
            target_id: None,
            metadata: JsonValue::Null,
            actor_ip: None,
            user_agent: None,
            ts: Utc::now(),
        }
    }
}

/// Filter passed to [`list`] — every field is optional.
#[derive(Debug, Default, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditFilter {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub from: Option<DateTime<Utc>>,
    #[serde(default)]
    pub to: Option<DateTime<Utc>>,
    /// Match every entry whose `action` starts with this prefix.
    #[serde(default)]
    pub action_prefix: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

const COLLECTION: &str = "sabwa_audit_log";

fn collection(state: &AppState) -> Collection<AuditEntry> {
    state.db.collection::<AuditEntry>(COLLECTION)
}

/// Persist a single audit entry. Returns `Ok(())` on success and logs a
/// `tracing::warn!` (still returns `Err`) when the underlying write fails so
/// route handlers can `.await.ok()` without losing observability.
pub async fn record(state: &AppState, entry: AuditEntry) -> anyhow::Result<()> {
    let col = collection(state);
    match col.insert_one(&entry).await {
        Ok(_) => Ok(()),
        Err(e) => {
            tracing::warn!(
                target: "sabwa_engine::audit",
                action = %entry.action,
                project_id = %entry.project_id,
                error = %e,
                "audit log write failed"
            );
            Err(e.into())
        }
    }
}

/// List entries newest-first with the supplied filter applied.
pub async fn list(state: &AppState, filter: AuditFilter) -> anyhow::Result<Vec<AuditEntry>> {
    let col = collection(state);

    let mut query = bson::Document::new();
    if let Some(sid) = filter.session_id.as_deref() {
        query.insert("sessionId", sid);
    }
    if filter.from.is_some() || filter.to.is_some() {
        let mut range = bson::Document::new();
        if let Some(from) = filter.from {
            range.insert("$gte", bson::DateTime::from_chrono(from));
        }
        if let Some(to) = filter.to {
            range.insert("$lte", bson::DateTime::from_chrono(to));
        }
        query.insert("ts", range);
    }
    if let Some(prefix) = filter.action_prefix.as_deref() {
        let escaped = regex_escape(prefix);
        query.insert(
            "action",
            doc! { "$regex": format!("^{}", escaped), "$options": "" },
        );
    }

    let limit = filter.limit.unwrap_or(100).clamp(1, 1000) as i64;

    let cursor = col
        .find(query)
        .sort(doc! { "ts": -1 })
        .limit(limit)
        .await?;
    let rows: Vec<AuditEntry> = cursor.try_collect().await?;
    Ok(rows)
}

/// Extract `(actor_ip, user_agent)` from request headers. Used at the top of
/// each mutating handler to fill in [`AuditEntry`].
///
/// `actor_ip` is read from `x-forwarded-for` (first hop) first, falling back
/// to `x-real-ip`. Both are common reverse-proxy headers.
pub fn extract_context(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let actor_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        });
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    (actor_ip, user_agent)
}

/// Minimal regex escape for `action_prefix`. We only build a `^prefix` match
/// so we just need to neutralise regex metacharacters.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}
