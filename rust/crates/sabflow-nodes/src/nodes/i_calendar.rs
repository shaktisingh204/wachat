//! iCalendar node — generate or parse RFC 5545 iCal text.
//!
//! Hand-rolled (iCal is a plain text format) so we don't pull in a new
//! top-level dep. Covers the common subset n8n's `iCal` node exposes:
//!
//!   - `create` : build a VCALENDAR/VEVENT block from summary/start/end and
//!     optional description, location, and organizer fields.
//!   - `parse`  : tokenize an existing ICS document and return one item per
//!     VEVENT with its core fields.
//!
//! Local-only; no HTTP.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ICalendarNode;

#[async_trait]
impl Node for ICalendarNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "iCalendar",
            "iCalendar",
            "Generate or parse iCalendar (ICS) events",
            NodeCategory::Productivity,
        )
        .icon("calendar")
        .color("#0ea5e9")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Create Event".into(),
                        value: json!("create"),
                        description: Some("Build an ICS document from fields".into()),
                    },
                    NodePropertyOption {
                        name: "Parse ICS".into(),
                        value: json!("parse"),
                        description: Some("Extract events from an ICS document".into()),
                    },
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("summary", "Summary", NodePropertyType::String)
                .description("Event title")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("startDate", "Start (RFC 3339)", NodePropertyType::String)
                .placeholder("2025-01-15T10:00:00Z")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("endDate", "End (RFC 3339)", NodePropertyType::String)
                .placeholder("2025-01-15T11:00:00Z")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("location", "Location", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("organizer", "Organizer", NodePropertyType::String)
                .placeholder("mailto:alice@example.com")
                .show_when("operation", &["create"]),
            NodeProperty::new("uid", "UID", NodePropertyType::String)
                .description("Stable event identifier (auto-generated if blank)")
                .show_when("operation", &["create"]),
            NodeProperty::new("icsData", "ICS", NodePropertyType::String)
                .description("ICS document to parse")
                .placeholder("BEGIN:VCALENDAR ...")
                .show_when("operation", &["parse"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        match operation.as_str() {
            "create" => {
                let summary = ctx.param_str(params, "summary")?;
                let start = ctx.param_str(params, "startDate")?;
                let end = ctx.param_str(params, "endDate")?;
                let description = ctx.param_str_opt(params, "description");
                let location = ctx.param_str_opt(params, "location");
                let organizer = ctx.param_str_opt(params, "organizer");
                let uid_opt = ctx.param_str_opt(params, "uid").filter(|s| !s.is_empty());

                let start_dt = parse_rfc3339(&start, "startDate")?;
                let end_dt = parse_rfc3339(&end, "endDate")?;

                let uid = uid_opt.unwrap_or_else(|| {
                    format!("{}@sabflow", uuid::Uuid::new_v4().simple())
                });
                let dtstamp = format_ics(&Utc::now());

                let mut buf = String::new();
                buf.push_str("BEGIN:VCALENDAR\r\n");
                buf.push_str("VERSION:2.0\r\n");
                buf.push_str("PRODID:-//SabFlow//EN\r\n");
                buf.push_str("BEGIN:VEVENT\r\n");
                push_line(&mut buf, "UID", &uid);
                push_line(&mut buf, "DTSTAMP", &dtstamp);
                push_line(&mut buf, "DTSTART", &format_ics(&start_dt));
                push_line(&mut buf, "DTEND", &format_ics(&end_dt));
                push_line(&mut buf, "SUMMARY", &escape_ics(&summary));
                if let Some(d) = description.as_ref().filter(|s| !s.is_empty()) {
                    push_line(&mut buf, "DESCRIPTION", &escape_ics(d));
                }
                if let Some(l) = location.as_ref().filter(|s| !s.is_empty()) {
                    push_line(&mut buf, "LOCATION", &escape_ics(l));
                }
                if let Some(o) = organizer.as_ref().filter(|s| !s.is_empty()) {
                    push_line(&mut buf, "ORGANIZER", o);
                }
                buf.push_str("END:VEVENT\r\n");
                buf.push_str("END:VCALENDAR\r\n");

                let mut out = Map::new();
                out.insert("ics".into(), Value::String(buf));
                out.insert("uid".into(), Value::String(uid));
                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }
            "parse" => {
                let ics = ctx.param_str(params, "icsData")?;
                let events = parse_ics_events(&ics);
                Ok(NodeOutput::single(events))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Format a UTC instant as the basic-form `YYYYMMDDTHHMMSSZ` iCal datetime.
fn format_ics(dt: &DateTime<Utc>) -> String {
    dt.format("%Y%m%dT%H%M%SZ").to_string()
}

/// Parse an iCal `DTSTART:20250115T100000Z`-style basic datetime.
/// Falls back to RFC 3339 / extended ISO 8601 if the basic form fails.
fn parse_ics_datetime(raw: &str) -> Option<DateTime<Utc>> {
    let trimmed = raw.trim();
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y%m%dT%H%M%SZ") {
        return Some(dt.and_utc());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y%m%dT%H%M%S") {
        return Some(dt.and_utc());
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(dt.with_timezone(&Utc));
    }
    None
}

fn parse_rfc3339(raw: &str, field: &str) -> NodeResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| NodeError::InvalidParameter {
            name: field.into(),
            reason: format!("expected RFC 3339 datetime, got `{raw}`: {e}"),
        })
}

fn push_line(buf: &mut String, key: &str, value: &str) {
    buf.push_str(key);
    buf.push(':');
    buf.push_str(value);
    buf.push_str("\r\n");
}

/// RFC 5545 §3.3.11 — escape backslash, semicolon, comma, and newline in
/// text properties.
fn escape_ics(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            ';' => out.push_str("\\;"),
            ',' => out.push_str("\\,"),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            other => out.push(other),
        }
    }
    out
}

fn unescape_ics(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') | Some('N') => out.push('\n'),
                Some(';') => out.push(';'),
                Some(',') => out.push(','),
                Some('\\') => out.push('\\'),
                Some(other) => out.push(other),
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Split an ICS document into folded-line tokens. RFC 5545 §3.1 folds long
/// lines by breaking and continuing the next line with a leading space/tab.
fn unfold_lines(ics: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in ics.split('\n') {
        let line = raw.trim_end_matches('\r');
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(last) = out.last_mut() {
                last.push_str(&line[1..]);
                continue;
            }
        }
        out.push(line.to_string());
    }
    out
}

/// Split a content line into `(property, value)`. We drop parameters
/// (`KEY;PARAM=foo:VALUE` → key=`KEY`) since we only need the core fields.
fn split_prop(line: &str) -> Option<(String, String)> {
    let (head, value) = line.split_once(':')?;
    let key = head.split(';').next().unwrap_or(head).trim().to_uppercase();
    Some((key, value.to_string()))
}

fn parse_ics_events(ics: &str) -> Vec<Value> {
    let mut events: Vec<Value> = Vec::new();
    let lines = unfold_lines(ics);

    let mut in_event = false;
    let mut cur: Map<String, Value> = Map::new();

    for line in lines.iter() {
        let upper = line.to_uppercase();
        if upper == "BEGIN:VEVENT" {
            in_event = true;
            cur = Map::new();
            continue;
        }
        if upper == "END:VEVENT" {
            in_event = false;
            events.push(Value::Object(std::mem::take(&mut cur)));
            continue;
        }
        if !in_event {
            continue;
        }
        let Some((key, value)) = split_prop(line) else {
            continue;
        };
        match key.as_str() {
            "UID" => {
                cur.insert("uid".into(), Value::String(value));
            }
            "SUMMARY" => {
                cur.insert("summary".into(), Value::String(unescape_ics(&value)));
            }
            "DESCRIPTION" => {
                cur.insert("description".into(), Value::String(unescape_ics(&value)));
            }
            "LOCATION" => {
                cur.insert("location".into(), Value::String(unescape_ics(&value)));
            }
            "ORGANIZER" => {
                cur.insert("organizer".into(), Value::String(value));
            }
            "DTSTART" => {
                cur.insert("startRaw".into(), Value::String(value.clone()));
                if let Some(dt) = parse_ics_datetime(&value) {
                    cur.insert("start".into(), Value::String(dt.to_rfc3339()));
                }
            }
            "DTEND" => {
                cur.insert("endRaw".into(), Value::String(value.clone()));
                if let Some(dt) = parse_ics_datetime(&value) {
                    cur.insert("end".into(), Value::String(dt.to_rfc3339()));
                }
            }
            "DTSTAMP" => {
                cur.insert("dtstamp".into(), Value::String(value));
            }
            _ => {}
        }
    }

    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_special_chars() {
        assert_eq!(escape_ics("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
    }

    #[test]
    fn unescapes_round_trip() {
        let s = "a;b,c\\d\ne";
        assert_eq!(unescape_ics(&escape_ics(s)), s);
    }

    #[test]
    fn unfolds_continuation_lines() {
        let ics = "FOO:hello\r\n world\r\nBAR:baz\r\n";
        let lines = unfold_lines(ics);
        assert_eq!(lines, vec!["FOO:hello world", "BAR:baz", ""]);
    }

    #[test]
    fn parses_event_summary_and_start() {
        let ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Hi there\r\nDTSTART:20250115T100000Z\r\nDTEND:20250115T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        let events = parse_ics_events(ics);
        assert_eq!(events.len(), 1);
        let obj = events[0].as_object().unwrap();
        assert_eq!(obj.get("uid").and_then(|v| v.as_str()), Some("abc"));
        assert_eq!(obj.get("summary").and_then(|v| v.as_str()), Some("Hi there"));
        assert!(obj.contains_key("start"));
    }
}
