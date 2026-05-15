//! Recurring → one-off materialisation for SabWa scheduled messages.
//!
//! Per SABWA_PLAN.md §6 page 13: recurring scheduled messages get a parent
//! row in `sabwa_scheduled` (kind = `recurring`, cron + timezone set) plus a
//! sliding window of pre-materialised child instances 30 days out.
//!
//! This module owns that expansion. We deliberately ship a **tiny inline
//! cron parser** rather than pull in `cron`/`croner`/`cron-parser` crates —
//! it supports the standard 5-field cron syntax (`min hour dom month dow`)
//! with `*`, single values, comma lists (`1,2,3`), ranges (`1-5`), and
//! `*/N` steps. That is enough for every "Daily / Weekly / Monthly" preset
//! the scheduler modal exposes today.
//!
//! ## Timezone caveat
//!
//! The plan calls for `chrono_tz::Tz` so users can author cron expressions
//! in their local zone. That crate isn't in `Cargo.toml` yet, so the API
//! takes a `chrono::FixedOffset` for now. Wall-clock fields are interpreted
//! in the supplied offset, then converted to UTC for storage. Once
//! `chrono-tz` is added to `Cargo.toml`, change the parameter type and the
//! callers — the internal expansion logic stays the same.
//!
//! TODO(deps): add `chrono-tz = "0.10"` to `Cargo.toml`, switch the
//! `tz: FixedOffset` parameter on [`next_instances`] to `chrono_tz::Tz`.

use anyhow::{anyhow, Context, Result};
use bson::oid::ObjectId;
use chrono::{DateTime, Datelike, Duration, FixedOffset, Timelike, Utc};
use futures::TryStreamExt;
use mongodb::bson;

use crate::state::AppState;

use super::queue::{self, ScheduledJob, ScheduledJobKind};

/// Default window we materialise ahead of "now".
pub const MATERIALISE_WINDOW_DAYS: i64 = 30;

// ---------------------------------------------------------------------------
// Cron parser
// ---------------------------------------------------------------------------

/// One parsed cron field. Either an inclusive set of allowed integers, or
/// `Any` (i.e. `*`) which short-circuits the membership check.
#[derive(Debug, Clone)]
enum Field {
    Any,
    Set(Vec<u32>),
}

impl Field {
    fn matches(&self, v: u32) -> bool {
        match self {
            Field::Any => true,
            Field::Set(s) => s.binary_search(&v).is_ok(),
        }
    }
}

/// Parsed 5-field cron expression: `minute hour day-of-month month day-of-week`.
#[derive(Debug, Clone)]
struct CronExpr {
    minute: Field,    // 0–59
    hour: Field,      // 0–23
    dom: Field,       // 1–31
    month: Field,     // 1–12
    dow: Field,       // 0–6 (Sun=0)
}

fn parse_field(spec: &str, lo: u32, hi: u32) -> Result<Field> {
    if spec == "*" {
        return Ok(Field::Any);
    }
    let mut acc: Vec<u32> = Vec::new();
    for chunk in spec.split(',') {
        // Optional `/step` suffix.
        let (range_part, step) = match chunk.split_once('/') {
            Some((r, s)) => (
                r,
                s.parse::<u32>().context("cron step must be a number")?,
            ),
            None => (chunk, 1u32),
        };
        if step == 0 {
            return Err(anyhow!("cron step cannot be zero"));
        }
        let (a, b) = if range_part == "*" {
            (lo, hi)
        } else if let Some((s, e)) = range_part.split_once('-') {
            (
                s.parse::<u32>().context("cron range start")?,
                e.parse::<u32>().context("cron range end")?,
            )
        } else {
            let v: u32 = range_part.parse().context("cron value")?;
            (v, v)
        };
        if a < lo || b > hi || a > b {
            return Err(anyhow!("cron field out of bounds: {a}-{b} not in {lo}-{hi}"));
        }
        let mut v = a;
        while v <= b {
            acc.push(v);
            v += step;
        }
    }
    acc.sort_unstable();
    acc.dedup();
    Ok(Field::Set(acc))
}

impl CronExpr {
    fn parse(s: &str) -> Result<Self> {
        let parts: Vec<&str> = s.split_whitespace().collect();
        if parts.len() != 5 {
            return Err(anyhow!(
                "cron must have exactly 5 fields (min hour dom month dow), got {}",
                parts.len()
            ));
        }
        Ok(CronExpr {
            minute: parse_field(parts[0], 0, 59)?,
            hour: parse_field(parts[1], 0, 23)?,
            dom: parse_field(parts[2], 1, 31)?,
            month: parse_field(parts[3], 1, 12)?,
            dow: parse_field(parts[4], 0, 6)?,
        })
    }

    /// True if the wall-clock components match every field. Cron's quirky
    /// "OR" between `dom` and `dow` is honoured: when both are restricted
    /// (neither is `*`), a match on either is enough.
    fn matches(&self, year: i32, month: u32, day: u32, hour: u32, minute: u32, dow: u32) -> bool {
        if !self.minute.matches(minute)
            || !self.hour.matches(hour)
            || !self.month.matches(month)
        {
            return false;
        }
        let dom_ok = self.dom.matches(day);
        let dow_ok = self.dow.matches(dow);
        let _ = year; // year is unconstrained in 5-field cron
        match (&self.dom, &self.dow) {
            (Field::Any, Field::Any) => true,
            (Field::Any, _) => dow_ok,
            (_, Field::Any) => dom_ok,
            _ => dom_ok || dow_ok,
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Compute the next `count` wall-clock fires of `cron`, anchored to `from`.
///
/// `tz` interprets the cron fields as local wall-clock (e.g. "every day at
/// 09:00 IST"). Results are returned in UTC for storage in
/// `sabwa_scheduled.scheduledFor`.
///
/// Naive minute-by-minute walk — fine for our use cases since we cap the
/// search at ~30 days × 1440 minutes = 43 200 iterations.
pub fn next_instances(
    cron: &str,
    tz: FixedOffset,
    from: DateTime<Utc>,
    count: usize,
) -> Vec<DateTime<Utc>> {
    let Ok(expr) = CronExpr::parse(cron) else {
        return Vec::new();
    };

    // Start at the next minute boundary in the user's local zone.
    let mut cursor = from
        .with_timezone(&tz)
        .with_second(0)
        .and_then(|t| t.with_nanosecond(0))
        .map(|t| t + Duration::minutes(1))
        .unwrap_or_else(|| from.with_timezone(&tz));

    // Hard cap so a pathologically-restrictive cron never spins forever.
    let cap = (MATERIALISE_WINDOW_DAYS as i64) * 24 * 60 + count as i64 * 60;
    let mut out = Vec::with_capacity(count);
    let mut i = 0i64;
    while out.len() < count && i < cap {
        let dow = cursor.weekday().num_days_from_sunday();
        if expr.matches(
            cursor.year(),
            cursor.month(),
            cursor.day(),
            cursor.hour(),
            cursor.minute(),
            dow,
        ) {
            out.push(cursor.with_timezone(&Utc));
        }
        cursor += Duration::minutes(1);
        i += 1;
    }
    out
}

/// Materialise the next 30 days of fires for a recurring `sabwa_scheduled`
/// parent into one-off children on the Redis delayed-job queue.
///
/// Steps:
/// 1. Load the parent doc from `sabwa_scheduled` (`_id = parent_id`).
/// 2. Read its cron + timezone offset + payload.
/// 3. Compute fire times via [`next_instances`] for the next 30 days.
/// 4. For each fire time, enqueue a `ScheduledJob` on the Redis queue.
///
/// Returns how many child jobs were enqueued.
pub async fn materialise(state: &AppState, parent_id: &str) -> Result<usize> {
    let col = state
        .db
        .collection::<bson::Document>(crate::db::scheduled::COLLECTION);

    let filter = match ObjectId::parse_str(parent_id) {
        Ok(oid) => bson::doc! { "_id": oid },
        Err(_) => bson::doc! { "_id": parent_id },
    };
    let parent = col
        .find_one(filter)
        .await?
        .ok_or_else(|| anyhow!("recurring parent not found: {parent_id}"))?;

    let cron = parent
        .get_str("cron")
        .map_err(|_| anyhow!("parent {parent_id} missing `cron`"))?
        .to_string();

    // `timezone` is stored as either an IANA name ("Asia/Kolkata") or an
    // offset string ("+05:30"). Until chrono-tz lands we only handle the
    // latter shape; IANA names fall back to UTC.
    let tz_raw = parent.get_str("timezone").unwrap_or("+00:00").to_string();
    let tz = parse_offset(&tz_raw).unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());

    // Read session + project ids — needed on every child job.
    let session_id = oid_or_string(&parent, "sessionId")
        .ok_or_else(|| anyhow!("parent {parent_id} missing sessionId"))?;
    let project_id = oid_or_string(&parent, "projectId")
        .ok_or_else(|| anyhow!("parent {parent_id} missing projectId"))?;

    // Payload is stored as a BSON doc — convert to JSON for the queue.
    let payload_json = match parent.get("payload") {
        Some(bson::Bson::Document(d)) => bson::Bson::Document(d.clone()).into_relaxed_extjson(),
        Some(other) => other.clone().into_relaxed_extjson(),
        None => serde_json::Value::Null,
    };

    let now = Utc::now();
    // Generously over-estimate count — minute-resolution worst case for 30 d.
    let raw_count = MATERIALISE_WINDOW_DAYS as usize * 24 * 60;
    let fire_times = next_instances(&cron, tz, now, raw_count);

    // Filter to actual 30-day window (next_instances caps by count, not by date).
    let window_end = now + Duration::days(MATERIALISE_WINDOW_DAYS);

    let mut enqueued = 0usize;
    for at in fire_times.into_iter().filter(|t| *t <= window_end) {
        let job = ScheduledJob::new(
            session_id.clone(),
            project_id.clone(),
            at.timestamp(),
            ScheduledJobKind::SendMessage, // recurring parents always materialise SendMessage children
            payload_json.clone(),
        );
        queue::enqueue(&state.redis, job).await?;
        enqueued += 1;
    }
    tracing::info!(parent_id, enqueued, "scheduler.recurring.materialise");
    Ok(enqueued)
}

/// Sweep every recurring parent in `sabwa_scheduled` and materialise child
/// instances out to 30 days. Intended to be called periodically (≈1 h) from
/// the scheduler tick loop.
///
/// Selection rule: any doc with `kind = "recurring"` whose `cron` is set and
/// whose latest materialised child is < `now + 30d`. We approximate "latest
/// materialised child" by stamping `lastMaterialisedThrough` on the parent
/// after each pass — if absent we treat the window as starting at `now`.
///
/// Returns the total number of child jobs enqueued across all parents.
pub async fn materialise_due(state: &AppState) -> Result<usize> {
    let col = state
        .db
        .collection::<bson::Document>(crate::db::scheduled::COLLECTION);

    let now = Utc::now();
    let horizon = now + Duration::days(MATERIALISE_WINDOW_DAYS);

    // Find recurring parents whose materialised window doesn't yet reach `horizon`.
    // We tolerate missing `lastMaterialisedThrough` by also matching `$exists:false`.
    let filter = bson::doc! {
        "kind": "recurring",
        "cron": { "$exists": true, "$ne": bson::Bson::Null },
        "$or": [
            { "lastMaterialisedThrough": { "$exists": false } },
            { "lastMaterialisedThrough": { "$lt": bson::Bson::DateTime(horizon.into()) } },
        ],
    };

    let cursor = col
        .find(filter)
        .await
        .context("materialise_due: find recurring parents")?;
    let parents: Vec<bson::Document> = cursor
        .try_collect()
        .await
        .context("materialise_due: collect parents")?;

    let mut total = 0usize;
    for parent in parents {
        let parent_id = match parent.get("_id") {
            Some(bson::Bson::ObjectId(o)) => o.to_hex(),
            Some(bson::Bson::String(s)) => s.clone(),
            _ => continue,
        };
        match materialise_parent_doc(state, &parent).await {
            Ok(n) => {
                total += n;
                // Stamp the parent so we don't re-do this work next pass.
                let filter = match ObjectId::parse_str(&parent_id) {
                    Ok(oid) => bson::doc! { "_id": oid },
                    Err(_) => bson::doc! { "_id": &parent_id },
                };
                let _ = col
                    .update_one(
                        filter,
                        bson::doc! { "$set": {
                            "lastMaterialisedThrough": bson::Bson::DateTime(horizon.into()),
                            "updatedAt": bson::DateTime::now(),
                        }},
                    )
                    .await;
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    parent_id = %parent_id,
                    "scheduler.recurring.materialise_due: parent failed"
                );
            }
        }
    }

    Ok(total)
}

/// Materialise children for a parent doc already loaded from Mongo.
/// Factored out of [`materialise`] so [`materialise_due`] can avoid a second
/// round-trip per parent.
async fn materialise_parent_doc(state: &AppState, parent: &bson::Document) -> Result<usize> {
    let cron = parent
        .get_str("cron")
        .map_err(|_| anyhow!("parent missing `cron`"))?
        .to_string();

    let tz_raw = parent.get_str("timezone").unwrap_or("+00:00").to_string();
    let tz = parse_offset(&tz_raw).unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());

    let session_id =
        oid_or_string(parent, "sessionId").ok_or_else(|| anyhow!("parent missing sessionId"))?;
    let project_id =
        oid_or_string(parent, "projectId").ok_or_else(|| anyhow!("parent missing projectId"))?;

    let payload_json = match parent.get("payload") {
        Some(bson::Bson::Document(d)) => bson::Bson::Document(d.clone()).into_relaxed_extjson(),
        Some(other) => other.clone().into_relaxed_extjson(),
        None => serde_json::Value::Null,
    };

    let now = Utc::now();
    let raw_count = MATERIALISE_WINDOW_DAYS as usize * 24 * 60;
    let fire_times = next_instances(&cron, tz, now, raw_count);
    let window_end = now + Duration::days(MATERIALISE_WINDOW_DAYS);

    let mut enqueued = 0usize;
    for at in fire_times.into_iter().filter(|t| *t <= window_end) {
        let job = ScheduledJob::new(
            session_id.clone(),
            project_id.clone(),
            at.timestamp(),
            ScheduledJobKind::SendMessage,
            payload_json.clone(),
        );
        queue::enqueue(&state.redis, job).await?;
        enqueued += 1;
    }
    Ok(enqueued)
}

/// Parse `+HH:MM` / `-HH:MM` / `Z` offset strings into a `FixedOffset`.
/// Returns `None` for IANA zone names — caller should fall back to UTC.
fn parse_offset(s: &str) -> Option<FixedOffset> {
    if s == "Z" || s.eq_ignore_ascii_case("UTC") {
        return FixedOffset::east_opt(0);
    }
    let sign = match s.chars().next()? {
        '+' => 1,
        '-' => -1,
        _ => return None,
    };
    let rest = &s[1..];
    let (h, m) = rest.split_once(':')?;
    let h: i32 = h.parse().ok()?;
    let m: i32 = m.parse().ok()?;
    FixedOffset::east_opt(sign * (h * 3600 + m * 60))
}

/// Coerce an `_id`-style BSON field that may be either ObjectId or String
/// into a stringified form suitable for the Redis queue.
fn oid_or_string(doc: &bson::Document, key: &str) -> Option<String> {
    match doc.get(key)? {
        bson::Bson::ObjectId(o) => Some(o.to_hex()),
        bson::Bson::String(s) => Some(s.clone()),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
    }

    #[test]
    fn parse_every_minute() {
        let expr = CronExpr::parse("* * * * *").unwrap();
        assert!(expr.matches(2026, 1, 1, 0, 0, 4));
    }

    #[test]
    fn parse_daily_9am() {
        let expr = CronExpr::parse("0 9 * * *").unwrap();
        assert!(expr.matches(2026, 5, 15, 9, 0, 5));
        assert!(!expr.matches(2026, 5, 15, 9, 1, 5));
        assert!(!expr.matches(2026, 5, 15, 10, 0, 5));
    }

    #[test]
    fn parse_step_and_range() {
        let expr = CronExpr::parse("*/15 9-17 * * 1-5").unwrap();
        assert!(expr.matches(2026, 5, 11, 9, 0, 1)); // Mon 09:00
        assert!(expr.matches(2026, 5, 11, 9, 15, 1));
        assert!(!expr.matches(2026, 5, 11, 9, 7, 1));
        assert!(!expr.matches(2026, 5, 10, 9, 0, 0)); // Sun
    }

    #[test]
    fn next_instances_daily() {
        let from = utc(2026, 5, 15, 8, 30);
        let times = next_instances("0 9 * * *", FixedOffset::east_opt(0).unwrap(), from, 3);
        assert_eq!(times.len(), 3);
        assert_eq!(times[0], utc(2026, 5, 15, 9, 0));
        assert_eq!(times[1], utc(2026, 5, 16, 9, 0));
        assert_eq!(times[2], utc(2026, 5, 17, 9, 0));
    }

    #[test]
    fn next_instances_respects_offset() {
        // "Every day 09:00 in +05:30" should fire at 03:30 UTC.
        let from = utc(2026, 5, 15, 0, 0);
        let tz = FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap();
        let times = next_instances("0 9 * * *", tz, from, 1);
        assert_eq!(times[0], utc(2026, 5, 15, 3, 30));
    }
}
