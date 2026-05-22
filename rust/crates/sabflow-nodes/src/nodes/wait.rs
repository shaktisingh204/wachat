//! Wait node (`wait`).
//!
//! Pauses flow execution.  Mirrors n8n's `n8n-nodes-base.wait` parity surface:
//!
//!   - `interval` / `timeInterval` — sleep for a fixed duration (`amount`
//!     + `unit`).  Short waits (≤ [`MAX_SLEEP_SECS`]) run inline via
//!     `tokio::time::sleep`; longer waits are escalated to the engine's
//!     [`WaitResumer`] as a scheduled-resume so workers don't block.
//!
//!   - `webhook` — register a resume URL with the engine; the node emits an
//!     item carrying the resume URL + token and parks the execution.  When
//!     the URL is hit the engine resumes the flow.
//!
//!   - `dateTime` — block until a user-supplied ISO-8601 instant.  If the
//!     instant is in the past, returns immediately; if it's far in the
//!     future, the engine parks the execution via [`WaitResumer`].
//!
//! When no [`WaitResumer`] is wired into the [`ExecutionContext`] (e.g.
//! tests, embedded smoke runs), long waits still complete — they fall back
//! to a capped inline sleep so the harness can finish, and webhook mode
//! returns a deterministic placeholder URL.

use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput, WaitMode},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

/// Hard ceiling on how long a worker is allowed to block in an inline sleep.
/// Longer waits are escalated to the engine's [`WaitResumer`] so the worker
/// can be returned to the pool while the run sits paused.
pub const MAX_SLEEP_SECS: u64 = 60;

pub struct WaitNode;

#[async_trait]
impl Node for WaitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("wait", "Wait", "Pause flow execution", NodeCategory::Logic)
            .icon("clock")
            .color("#94a3b8")
            .properties(vec![
                NodeProperty::new("resume", "Resume", NodePropertyType::Options)
                    .options(vec![
                        NodePropertyOption {
                            name: "After Interval".into(),
                            value: json!("interval"),
                            description: Some("Sleep for a fixed duration".into()),
                        },
                        NodePropertyOption {
                            name: "Time Interval".into(),
                            value: json!("timeInterval"),
                            description: Some("Sleep for a fixed amount of time".into()),
                        },
                        NodePropertyOption {
                            name: "At Specified Time".into(),
                            value: json!("dateTime"),
                            description: Some("Pause until a specific ISO-8601 datetime".into()),
                        },
                        NodePropertyOption {
                            name: "On Webhook Call".into(),
                            value: json!("webhook"),
                            description: Some(
                                "Park the execution; engine resumes on webhook hit".into(),
                            ),
                        },
                    ])
                    .default(json!("interval"))
                    .required(),
                NodeProperty::new("amount", "Amount", NodePropertyType::Number)
                    .default(json!(1))
                    .show_when("resume", &["interval", "timeInterval"]),
                NodeProperty::new("unit", "Unit", NodePropertyType::Options)
                    .options(vec![
                        NodePropertyOption {
                            name: "Seconds".into(),
                            value: json!("seconds"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Minutes".into(),
                            value: json!("minutes"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Hours".into(),
                            value: json!("hours"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Days".into(),
                            value: json!("days"),
                            description: None,
                        },
                    ])
                    .default(json!("seconds"))
                    .show_when("resume", &["interval", "timeInterval"]),
                NodeProperty::new("dateTime", "Resume At", NodePropertyType::DateTime)
                    .placeholder("2026-01-01T09:00:00Z")
                    .show_when("resume", &["dateTime"])
                    .description("ISO-8601 instant at which the flow resumes."),
                NodeProperty::new(
                    "httpMethod",
                    "Webhook HTTP Method",
                    NodePropertyType::Options,
                )
                .options(vec![
                    NodePropertyOption {
                        name: "GET".into(),
                        value: json!("GET"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "POST".into(),
                        value: json!("POST"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "ANY".into(),
                        value: json!("ANY"),
                        description: None,
                    },
                ])
                .default(json!("GET"))
                .show_when("resume", &["webhook"]),
                NodeProperty::new("path", "Webhook Path Hint", NodePropertyType::String)
                    .placeholder("approve-order")
                    .show_when("resume", &["webhook"])
                    .description("Optional path suffix — the engine prefixes a unique token."),
            ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let resume = ctx
            .param_str_opt(params, "resume")
            .unwrap_or_else(|| "interval".to_string());

        match resume.as_str() {
            "interval" | "timeInterval" => {
                let amount = ctx.param_f64(params, "amount").unwrap_or(1.0);
                if amount.is_nan() || amount < 0.0 {
                    return Err(NodeError::InvalidParameter {
                        name: "amount".into(),
                        reason: "must be a non-negative number".into(),
                    });
                }
                let unit = ctx
                    .param_str_opt(params, "unit")
                    .unwrap_or_else(|| "seconds".to_string());

                let seconds_per_unit: f64 = match unit.as_str() {
                    "seconds" => 1.0,
                    "minutes" => 60.0,
                    "hours" => 3_600.0,
                    "days" => 86_400.0,
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "unit".into(),
                            reason: format!("unknown unit: {other}"),
                        });
                    }
                };

                let requested_secs = amount * seconds_per_unit;

                // Long waits escalate to the engine.  No resumer? Cap and sleep.
                if requested_secs > MAX_SLEEP_SECS as f64 {
                    if let Some(resumer) = ctx.wait_resumer.clone() {
                        let resume_at = Utc::now()
                            + chrono::Duration::milliseconds((requested_secs * 1000.0) as i64);
                        let reg = resumer
                            .register_wait(
                                &ctx.execution_id,
                                WaitMode::DateTime {
                                    resume_at_iso: resume_at.to_rfc3339(),
                                },
                            )
                            .await?;
                        let mut items = input.items;
                        items.push(wait_marker(
                            "scheduled",
                            Some(reg.resume_at_iso.unwrap_or_else(|| resume_at.to_rfc3339())),
                            None,
                            Some(reg.resume_token),
                        ));
                        return Ok(NodeOutput::single(items));
                    }
                    // Test / embedded fallback — cap so the run still finishes.
                }

                let capped_secs = requested_secs.min(MAX_SLEEP_SECS as f64).max(0.0);
                tokio::time::sleep(Duration::from_secs_f64(capped_secs)).await;
                Ok(NodeOutput::single(input.items))
            }

            "dateTime" => {
                let raw = ctx
                    .param_str_opt(params, "dateTime")
                    .ok_or_else(|| NodeError::MissingParameter("dateTime".into()))?;
                let target = parse_iso(&raw)?;
                let now = Utc::now();
                let delta_ms = (target - now).num_milliseconds();

                if delta_ms <= 0 {
                    // Already past — pass through immediately.
                    return Ok(NodeOutput::single(input.items));
                }
                let delta_secs = delta_ms as f64 / 1000.0;

                if delta_secs > MAX_SLEEP_SECS as f64 {
                    if let Some(resumer) = ctx.wait_resumer.clone() {
                        let reg = resumer
                            .register_wait(
                                &ctx.execution_id,
                                WaitMode::DateTime {
                                    resume_at_iso: target.to_rfc3339(),
                                },
                            )
                            .await?;
                        let mut items = input.items;
                        items.push(wait_marker(
                            "scheduled",
                            Some(reg.resume_at_iso.unwrap_or_else(|| target.to_rfc3339())),
                            None,
                            Some(reg.resume_token),
                        ));
                        return Ok(NodeOutput::single(items));
                    }
                    // No resumer — cap and sleep.
                }

                let capped = delta_secs.min(MAX_SLEEP_SECS as f64);
                tokio::time::sleep(Duration::from_secs_f64(capped)).await;
                Ok(NodeOutput::single(input.items))
            }

            "webhook" => {
                let http_method = ctx
                    .param_str_opt(params, "httpMethod")
                    .unwrap_or_else(|| "GET".to_string());
                let path_hint = ctx
                    .param_str_opt(params, "path")
                    .filter(|s| !s.trim().is_empty());

                let (resume_url, resume_token) = if let Some(resumer) = ctx.wait_resumer.clone() {
                    let reg = resumer
                        .register_wait(
                            &ctx.execution_id,
                            WaitMode::Webhook {
                                http_method: http_method.clone(),
                                path_hint: path_hint.clone(),
                            },
                        )
                        .await?;
                    (
                        reg.resume_url.unwrap_or_else(|| {
                            format!("/v1/sabflow/wait/resume/{}", reg.resume_token)
                        }),
                        reg.resume_token,
                    )
                } else {
                    // Test fallback — synthesise a deterministic URL.
                    let token = format!("test_token_{}", ctx.execution_id);
                    (format!("/v1/sabflow/wait/resume/{token}"), token)
                };

                let mut items = input.items;
                items.push(wait_marker(
                    "webhook",
                    None,
                    Some(resume_url.clone()),
                    Some(resume_token),
                ));
                Ok(NodeOutput::single(items))
            }

            other => Err(NodeError::InvalidParameter {
                name: "resume".into(),
                reason: format!("unknown resume mode: {other}"),
            }),
        }
    }
}

fn wait_marker(
    mode: &str,
    resume_at_iso: Option<String>,
    resume_url: Option<String>,
    resume_token: Option<String>,
) -> Value {
    let mut obj = serde_json::Map::new();
    obj.insert("__wait__".into(), json!(true));
    obj.insert("mode".into(), json!(mode));
    if let Some(iso) = resume_at_iso {
        obj.insert("resumeAt".into(), json!(iso));
    }
    if let Some(url) = resume_url {
        obj.insert("resumeUrl".into(), json!(url));
    }
    if let Some(tok) = resume_token {
        obj.insert("resumeToken".into(), json!(tok));
    }
    Value::Object(obj)
}

fn parse_iso(raw: &str) -> NodeResult<DateTime<Utc>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(NodeError::MissingParameter("dateTime".into()));
    }
    // RFC3339 is the common ISO-8601 subset; chrono accepts it.
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Ok(dt.with_timezone(&Utc));
    }
    // Naive datetime → assume UTC.
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S") {
        return Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }
    Err(NodeError::InvalidParameter {
        name: "dateTime".into(),
        reason: format!("could not parse `{trimmed}` as ISO-8601"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new("exec_test".into(), Arc::new(reqwest::Client::new()))
    }

    #[tokio::test]
    async fn interval_short_sleeps_inline() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "interval", "amount": 0, "unit": "seconds" });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        assert_eq!(out.branches.len(), 1);
    }

    #[tokio::test]
    async fn rejects_negative_amount() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "interval", "amount": -1, "unit": "seconds" });
        let err = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "amount"),
            other => panic!("expected InvalidParameter, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn datetime_past_returns_immediately() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "dateTime", "dateTime": "2000-01-01T00:00:00Z" });
        let out = node
            .execute(&mut c, NodeInput::one(json!({"x": 1})), &params)
            .await
            .unwrap();
        assert_eq!(out.branches[0].items.len(), 1);
        assert_eq!(out.branches[0].items[0]["x"], 1);
    }

    #[tokio::test]
    async fn datetime_invalid_string_errors() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "dateTime", "dateTime": "not-a-date" });
        let err = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "dateTime"),
            other => panic!("expected InvalidParameter, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn webhook_without_resumer_emits_placeholder_url() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "webhook", "httpMethod": "POST" });
        let out = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap();
        let item = &out.branches[0].items[0];
        assert_eq!(item["__wait__"], true);
        assert_eq!(item["mode"], "webhook");
        let url = item["resumeUrl"].as_str().unwrap();
        assert!(url.starts_with("/v1/sabflow/wait/resume/"));
    }

    #[tokio::test]
    async fn unknown_unit_errors() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "interval", "amount": 1, "unit": "fortnights" });
        let err = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "unit"),
            other => panic!("expected InvalidParameter, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn unknown_resume_mode_errors() {
        let node = WaitNode;
        let mut c = ctx();
        let params = json!({ "resume": "telepathy" });
        let err = node
            .execute(&mut c, NodeInput::empty(), &params)
            .await
            .unwrap_err();
        match err {
            NodeError::InvalidParameter { name, .. } => assert_eq!(name, "resume"),
            other => panic!("expected InvalidParameter, got: {other:?}"),
        }
    }
}
