//! PagerDuty node — trigger, acknowledge, and resolve incidents via the
//! PagerDuty Events API v2 (`https://events.pagerduty.com/v2/enqueue`) and
//! query incidents through the REST API (`https://api.pagerduty.com/...`).
//!
//! Credentials: `pagerDutyApi` with two optional fields:
//!   - `integrationKey` — routing key for an Events API v2 integration. Used
//!     by `triggerIncident`, `acknowledgeIncident`, and `resolveIncident`.
//!   - `apiToken`       — REST API token (used by `getIncident`,
//!     `listIncidents`). Sent as `Authorization: Token token=<value>`.
//!
//! Each operation enforces only the credential field it actually needs.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

const PAGERDUTY_EVENTS_URL: &str = "https://events.pagerduty.com/v2/enqueue";
const PAGERDUTY_REST_BASE: &str = "https://api.pagerduty.com";

pub struct PagerDutyNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PagerDutyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pagerDuty",
            "PagerDuty",
            "Trigger, acknowledge, resolve, and query PagerDuty incidents",
            NodeCategory::Communication,
        )
        .icon("siren")
        .color("#06AC38")
        .credentials(vec![CredentialBinding {
            name: "pagerDutyApi".into(),
            display_name: "PagerDuty API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Trigger Incident", "triggerIncident"),
                    opt("Acknowledge Incident", "acknowledgeIncident"),
                    opt("Resolve Incident", "resolveIncident"),
                    opt("Get Incident", "getIncident"),
                    opt("List Incidents", "listIncidents"),
                ])
                .default(json!("triggerIncident"))
                .required(),
            // triggerIncident
            NodeProperty::new("summary", "Summary", NodePropertyType::String)
                .placeholder("Disk almost full on web-prod-01")
                .description("Human-readable problem statement (max 1024 chars).")
                .show_when("operation", &["triggerIncident"])
                .required(),
            NodeProperty::new("source", "Source", NodePropertyType::String)
                .placeholder("web-prod-01.example.com")
                .description("Unique source of the event (host, service, etc.).")
                .show_when("operation", &["triggerIncident"])
                .required(),
            NodeProperty::new("severity", "Severity", NodePropertyType::Options)
                .options(vec![
                    opt("Critical", "critical"),
                    opt("Error", "error"),
                    opt("Warning", "warning"),
                    opt("Info", "info"),
                ])
                .default(json!("error"))
                .show_when("operation", &["triggerIncident"])
                .required(),
            NodeProperty::new("dedupKey", "Dedup Key", NodePropertyType::String)
                .placeholder("disk-full-web-prod-01")
                .description("Optional. Coalesces repeated events into one incident.")
                .show_when(
                    "operation",
                    &["triggerIncident", "acknowledgeIncident", "resolveIncident"],
                ),
            NodeProperty::new("component", "Component", NodePropertyType::String)
                .show_when("operation", &["triggerIncident"]),
            NodeProperty::new("group", "Group", NodePropertyType::String)
                .show_when("operation", &["triggerIncident"]),
            NodeProperty::new("class", "Class", NodePropertyType::String)
                .show_when("operation", &["triggerIncident"]),
            // getIncident / listIncidents
            NodeProperty::new("incidentId", "Incident ID", NodePropertyType::String)
                .placeholder("PT4KHLK")
                .show_when("operation", &["getIncident"])
                .required(),
            NodeProperty::new("statuses", "Statuses", NodePropertyType::String)
                .placeholder("triggered,acknowledged")
                .description(
                    "Comma-separated incident statuses to filter on. Defaults to all.",
                )
                .show_when("operation", &["listIncidents"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(25)
                .description("Maximum incidents to return (1-100).")
                .show_when("operation", &["listIncidents"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let integration_key = cred
            .data
            .get("integrationKey")
            .cloned()
            .unwrap_or_default();
        let api_token = cred.data.get("apiToken").cloned().unwrap_or_default();

        let operation = ctx.param_str(params, "operation")?;
        match operation.as_str() {
            "triggerIncident" => {
                require_field(&integration_key, "integrationKey")?;

                let summary = ctx.param_str(params, "summary")?;
                if summary.trim().is_empty() {
                    return Err(NodeError::MissingParameter("summary".into()));
                }
                let source = ctx.param_str(params, "source")?;
                if source.trim().is_empty() {
                    return Err(NodeError::MissingParameter("source".into()));
                }
                let severity = ctx
                    .param_str_opt(params, "severity")
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "error".to_string());

                let mut payload = json!({
                    "summary": summary,
                    "source": source,
                    "severity": severity,
                });
                for (param_key, json_key) in
                    [("component", "component"), ("group", "group"), ("class", "class")]
                {
                    if let Some(v) = ctx
                        .param_str_opt(params, param_key)
                        .filter(|s| !s.is_empty())
                    {
                        payload
                            .as_object_mut()
                            .expect("payload is an object")
                            .insert(json_key.into(), json!(v));
                    }
                }

                let mut body = json!({
                    "routing_key": integration_key,
                    "event_action": "trigger",
                    "payload": payload,
                });
                if let Some(dedup) = ctx
                    .param_str_opt(params, "dedupKey")
                    .filter(|s| !s.is_empty())
                {
                    body.as_object_mut()
                        .expect("body is an object")
                        .insert("dedup_key".into(), json!(dedup));
                }

                let res = ctx.http.post(PAGERDUTY_EVENTS_URL).json(&body).send().await?;
                finalize(res).await
            }
            "acknowledgeIncident" | "resolveIncident" => {
                require_field(&integration_key, "integrationKey")?;
                let dedup = ctx.param_str(params, "dedupKey")?;
                if dedup.trim().is_empty() {
                    return Err(NodeError::MissingParameter("dedupKey".into()));
                }
                let event_action = if operation == "acknowledgeIncident" {
                    "acknowledge"
                } else {
                    "resolve"
                };
                let body = json!({
                    "routing_key": integration_key,
                    "event_action": event_action,
                    "dedup_key": dedup,
                });
                let res = ctx.http.post(PAGERDUTY_EVENTS_URL).json(&body).send().await?;
                finalize(res).await
            }
            "getIncident" => {
                require_field(&api_token, "apiToken")?;
                let id_raw = ctx.param_str(params, "incidentId")?;
                let id = id_raw.trim().to_string();
                if id.is_empty() {
                    return Err(NodeError::MissingParameter("incidentId".into()));
                }
                let encoded = urlencoding::encode(&id);
                let url = format!("{PAGERDUTY_REST_BASE}/incidents/{encoded}");
                let res = ctx
                    .http
                    .get(&url)
                    .header("Authorization", format!("Token token={api_token}"))
                    .header("Accept", "application/vnd.pagerduty+json;version=2")
                    .send()
                    .await?;
                finalize(res).await
            }
            "listIncidents" => {
                require_field(&api_token, "apiToken")?;
                let limit = ctx.param_f64(params, "limit").unwrap_or(25.0).clamp(1.0, 100.0) as u32;
                let mut query: Vec<(String, String)> = vec![("limit".into(), limit.to_string())];
                if let Some(statuses) = ctx
                    .param_str_opt(params, "statuses")
                    .filter(|s| !s.is_empty())
                {
                    for status in statuses.split(',') {
                        let s = status.trim();
                        if !s.is_empty() {
                            query.push(("statuses[]".into(), s.to_string()));
                        }
                    }
                }
                let res = ctx
                    .http
                    .get(format!("{PAGERDUTY_REST_BASE}/incidents"))
                    .header("Authorization", format!("Token token={api_token}"))
                    .header("Accept", "application/vnd.pagerduty+json;version=2")
                    .query(&query)
                    .send()
                    .await?;
                finalize(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn require_field(value: &str, field: &str) -> NodeResult<()> {
    if value.trim().is_empty() {
        return Err(NodeError::MissingParameter(field.into()));
    }
    Ok(())
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body_value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        let body_str = match &body_value {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_str,
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}
