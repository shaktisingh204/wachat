//! Date and Time node.
//!
//! Local date manipulation using `chrono`. No HTTP.
//!
//! Operations:
//! - `now`         : current UTC timestamp.
//! - `format`      : reformat `value` with a chrono format string.
//! - `add`         : add `amount` `unit` to `value`.
//! - `subtract`    : subtract `amount` `unit` from `value`.
//! - `diff`        : difference between `value` and `compareValue`,
//!                   expressed in seconds, minutes, hours, and days.
//!
//! Input timestamps are parsed flexibly — RFC 3339, ISO 8601 datetime,
//! ISO 8601 date, then a couple of common space-separated formats.

use async_trait::async_trait;
use chrono::{DateTime, Days, Months, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct DateTimeNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

fn parse_datetime(raw: &str) -> NodeResult<DateTime<Utc>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(NodeError::InvalidParameter {
            name: "value".into(),
            reason: "empty date string".into(),
        });
    }

    // Try unix timestamp (seconds or millis) first.
    if let Ok(n) = trimmed.parse::<i64>() {
        if n.abs() > 10_000_000_000 {
            // milliseconds
            if let Some(dt) = DateTime::<Utc>::from_timestamp_millis(n) {
                return Ok(dt);
            }
        } else if let Some(dt) = DateTime::<Utc>::from_timestamp(n, 0) {
            return Ok(dt);
        }
    }

    // RFC 3339 / ISO 8601 with timezone.
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Ok(dt.with_timezone(&Utc));
    }

    // RFC 2822 (e.g. "Tue, 1 Jul 2003 10:52:37 +0200").
    if let Ok(dt) = DateTime::parse_from_rfc2822(trimmed) {
        return Ok(dt.with_timezone(&Utc));
    }

    // Naive datetimes — assume UTC.
    let naive_formats = [
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ];
    for fmt in naive_formats {
        if let Ok(ndt) = NaiveDateTime::parse_from_str(trimmed, fmt) {
            return Ok(Utc.from_utc_datetime(&ndt));
        }
    }

    // Date-only fallbacks (interpret as midnight UTC).
    let date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%Y"];
    for fmt in date_formats {
        if let Ok(d) = NaiveDate::parse_from_str(trimmed, fmt) {
            if let Some(ndt) = d.and_hms_opt(0, 0, 0) {
                return Ok(Utc.from_utc_datetime(&ndt));
            }
        }
    }

    Err(NodeError::InvalidParameter {
        name: "value".into(),
        reason: format!("unrecognized date format: {trimmed}"),
    })
}

fn format_output(dt: DateTime<Utc>, output_format: &str) -> String {
    match output_format {
        "rfc3339" => dt.to_rfc3339(),
        "unix" => dt.timestamp().to_string(),
        // default: iso8601 (chrono's RFC 3339 == ISO 8601 for our purposes)
        _ => dt.to_rfc3339(),
    }
}

fn shift_datetime(
    dt: DateTime<Utc>,
    unit: &str,
    amount: i64,
    subtract: bool,
) -> NodeResult<DateTime<Utc>> {
    let signed = if subtract { -amount } else { amount };

    // Years / months use chrono's calendar-aware helpers.
    if unit == "years" || unit == "months" {
        let months_total: i64 = if unit == "years" {
            signed.saturating_mul(12)
        } else {
            signed
        };
        return apply_months(dt, months_total);
    }

    if unit == "weeks" || unit == "days" {
        let days_total: i64 = if unit == "weeks" {
            signed.saturating_mul(7)
        } else {
            signed
        };
        return apply_days(dt, days_total);
    }

    // Hours / minutes / seconds — straight duration math.
    let duration = match unit {
        "seconds" => chrono::Duration::try_seconds(signed),
        "minutes" => chrono::Duration::try_minutes(signed),
        "hours" => chrono::Duration::try_hours(signed),
        other => {
            return Err(NodeError::InvalidParameter {
                name: "unit".into(),
                reason: format!("unsupported unit: {other}"),
            });
        }
    }
    .ok_or_else(|| NodeError::InvalidParameter {
        name: "amount".into(),
        reason: "amount too large".into(),
    })?;

    dt.checked_add_signed(duration)
        .ok_or_else(|| NodeError::InvalidParameter {
            name: "amount".into(),
            reason: "resulting datetime is out of range".into(),
        })
}

fn apply_months(dt: DateTime<Utc>, months: i64) -> NodeResult<DateTime<Utc>> {
    let abs: u32 = months.unsigned_abs().try_into().map_err(|_| {
        NodeError::InvalidParameter {
            name: "amount".into(),
            reason: "month offset too large".into(),
        }
    })?;
    let result = if months >= 0 {
        dt.checked_add_months(Months::new(abs))
    } else {
        dt.checked_sub_months(Months::new(abs))
    };
    result.ok_or_else(|| NodeError::InvalidParameter {
        name: "amount".into(),
        reason: "resulting datetime is out of range".into(),
    })
}

fn apply_days(dt: DateTime<Utc>, days: i64) -> NodeResult<DateTime<Utc>> {
    let abs: u64 = days.unsigned_abs();
    let result = if days >= 0 {
        dt.checked_add_days(Days::new(abs))
    } else {
        dt.checked_sub_days(Days::new(abs))
    };
    result.ok_or_else(|| NodeError::InvalidParameter {
        name: "amount".into(),
        reason: "resulting datetime is out of range".into(),
    })
}

#[async_trait]
impl Node for DateTimeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "dateTime",
            "Date and Time",
            "Format, shift, and diff dates",
            NodeCategory::Transform,
        )
        .icon("clock")
        .color("#3b82f6")
        .properties(vec![
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Now", "now"),
                    opt("Format", "format"),
                    opt("Add", "add"),
                    opt("Subtract", "subtract"),
                    opt("Diff", "diff"),
                ])
                .default(json!("now"))
                .required(),
            NodeProperty::new("value", "Value", NodePropertyType::String)
                .placeholder("2024-01-15T12:00:00Z")
                .description("Input timestamp (ISO 8601, RFC 3339, or Unix epoch)")
                .show_when("operation", &["format", "add", "subtract", "diff"])
                .required(),
            NodeProperty::new("format", "Format", NodePropertyType::String)
                .placeholder("%Y-%m-%d %H:%M:%S")
                .description("chrono format string")
                .show_when("operation", &["format"])
                .required(),
            NodeProperty::new("unit", "Unit", NodePropertyType::Options)
                .options(vec![
                    opt("Seconds", "seconds"),
                    opt("Minutes", "minutes"),
                    opt("Hours", "hours"),
                    opt("Days", "days"),
                    opt("Weeks", "weeks"),
                    opt("Months", "months"),
                    opt("Years", "years"),
                ])
                .default(json!("days"))
                .show_when("operation", &["add", "subtract"]),
            NodeProperty::new("amount", "Amount", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["add", "subtract"])
                .required(),
            NodeProperty::new("compareValue", "Compare Value", NodePropertyType::String)
                .placeholder("2024-01-20T12:00:00Z")
                .description("Second date to diff against")
                .show_when("operation", &["diff"])
                .required(),
            NodeProperty::new("outputFormat", "Output Format", NodePropertyType::Options)
                .options(vec![
                    opt("ISO 8601", "iso8601"),
                    opt("RFC 3339", "rfc3339"),
                    opt("Unix Timestamp", "unix"),
                ])
                .default(json!("iso8601")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let operation = ctx.param_str(params, "operation")?;
        let output_format = ctx
            .param_str_opt(params, "outputFormat")
            .unwrap_or_else(|| "iso8601".to_string());

        let body: Value = match operation.as_str() {
            "now" => {
                let now = Utc::now();
                json!({
                    "dateTime": format_output(now, &output_format),
                    "unix": now.timestamp(),
                })
            }
            "format" => {
                let value = ctx.param_str(params, "value")?;
                let fmt = ctx.param_str(params, "format")?;
                let dt = parse_datetime(&value)?;
                let formatted = dt.format(&fmt).to_string();
                json!({
                    "dateTime": formatted,
                    "iso": dt.to_rfc3339(),
                    "unix": dt.timestamp(),
                })
            }
            "add" | "subtract" => {
                let value = ctx.param_str(params, "value")?;
                let unit = ctx
                    .param_str_opt(params, "unit")
                    .unwrap_or_else(|| "days".to_string());
                let amount = ctx.param_f64(params, "amount").ok_or_else(|| {
                    NodeError::MissingParameter("amount".into())
                })? as i64;

                let dt = parse_datetime(&value)?;
                let shifted = shift_datetime(dt, &unit, amount, operation == "subtract")?;
                json!({
                    "dateTime": format_output(shifted, &output_format),
                    "iso": shifted.to_rfc3339(),
                    "unix": shifted.timestamp(),
                })
            }
            "diff" => {
                let value = ctx.param_str(params, "value")?;
                let compare = ctx.param_str(params, "compareValue")?;
                let a = parse_datetime(&value)?;
                let b = parse_datetime(&compare)?;
                let duration = b.signed_duration_since(a);
                let seconds = duration.num_seconds();
                json!({
                    "seconds": seconds,
                    "minutes": duration.num_minutes(),
                    "hours": duration.num_hours(),
                    "days": duration.num_days(),
                    "milliseconds": duration.num_milliseconds(),
                })
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(
            "test-exec".to_string(),
            Arc::new(reqwest::Client::new()),
        )
    }

    #[test]
    fn parse_iso8601_with_tz() {
        let dt = parse_datetime("2024-01-15T12:30:00Z").unwrap();
        assert_eq!(dt.timestamp(), 1_705_321_800);
    }

    #[test]
    fn parse_naive_assumes_utc() {
        let dt = parse_datetime("2024-01-15 12:30:00").unwrap();
        assert_eq!(dt.timestamp(), 1_705_321_800);
    }

    #[test]
    fn parse_date_only() {
        let dt = parse_datetime("2024-01-15").unwrap();
        assert_eq!(dt.timestamp(), 1_705_276_800);
    }

    #[test]
    fn parse_unix_seconds() {
        let dt = parse_datetime("1705321800").unwrap();
        assert_eq!(dt.timestamp(), 1_705_321_800);
    }

    #[test]
    fn parse_unix_millis() {
        let dt = parse_datetime("1705321800000").unwrap();
        assert_eq!(dt.timestamp(), 1_705_321_800);
    }

    #[test]
    fn shift_add_days() {
        let dt = parse_datetime("2024-01-15T00:00:00Z").unwrap();
        let shifted = shift_datetime(dt, "days", 10, false).unwrap();
        assert_eq!(shifted.to_rfc3339(), "2024-01-25T00:00:00+00:00");
    }

    #[test]
    fn shift_subtract_months() {
        let dt = parse_datetime("2024-03-15T00:00:00Z").unwrap();
        let shifted = shift_datetime(dt, "months", 2, true).unwrap();
        assert_eq!(shifted.to_rfc3339(), "2024-01-15T00:00:00+00:00");
    }

    #[tokio::test]
    async fn op_format_produces_chrono_output() {
        let node = DateTimeNode;
        let mut c = ctx();
        let params = json!({
            "operation": "format",
            "value": "2024-01-15T12:30:00Z",
            "format": "%Y/%m/%d",
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        assert_eq!(out.branches[0].items[0]["dateTime"], json!("2024/01/15"));
    }

    #[tokio::test]
    async fn op_diff_seconds() {
        let node = DateTimeNode;
        let mut c = ctx();
        let params = json!({
            "operation": "diff",
            "value": "2024-01-15T00:00:00Z",
            "compareValue": "2024-01-15T00:01:00Z",
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        assert_eq!(out.branches[0].items[0]["seconds"], json!(60));
    }

    #[tokio::test]
    async fn op_add_days_round_trip() {
        let node = DateTimeNode;
        let mut c = ctx();
        let params = json!({
            "operation": "add",
            "value": "2024-01-15T00:00:00Z",
            "unit": "days",
            "amount": 5,
        });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        assert_eq!(
            out.branches[0].items[0]["iso"],
            json!("2024-01-20T00:00:00+00:00")
        );
    }

    #[test]
    fn descriptor_is_not_a_stub() {
        let d = DateTimeNode.descriptor();
        assert_eq!(d.name, "dateTime");
        assert!(!d.stub, "DateTime must not be registered as a stub");
    }
}
