//! BambooHR node — HRIS REST API
//! (`https://api.bamboohr.com/api/gateway.php/{companyDomain}/v1`).
//!
//! BambooHR uses HTTP Basic auth: the API key is the username and any string
//! (commonly `"x"`) is the password.  All responses are JSON when the
//! `Accept: application/json` header is set, which we always do.
//!
//! Supported operations:
//!   - `employee.list`, `employee.get`, `employee.create`, `employee.update`
//!   - `directory.list`     → company directory
//!   - `timeOff.requests`   → list time-off requests
//!   - `report.run`         → run a built-in or custom report by id

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct BambooHrNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for BambooHrNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bambooHr",
            "BambooHR",
            "BambooHR HRIS — employees, time-off, reports",
            NodeCategory::Hr,
        )
        .icon("users")
        .color("#73C41D")
        .credentials(vec![CredentialBinding {
            name: "bambooHrApi".into(),
            display_name: "BambooHR API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Employees", "employee.list"),
                    opt("Get Employee", "employee.get"),
                    opt("Create Employee", "employee.create"),
                    opt("Update Employee", "employee.update"),
                    opt("Company Directory", "directory.list"),
                    opt("Time Off Requests", "timeOff.requests"),
                    opt("Run Report", "report.run"),
                ])
                .default(json!("directory.list"))
                .required(),
            NodeProperty::new("employeeId", "Employee ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("operation", &["employee.get", "employee.update"]),
            NodeProperty::new("fields", "Fields", NodePropertyType::String)
                .default(json!("firstName,lastName,workEmail,jobTitle,department"))
                .show_when("operation", &["employee.get", "employee.list"])
                .description("Comma-separated BambooHR field names"),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .show_when("operation", &["employee.create", "employee.update"])
                .description("JSON object of field → value pairs"),
            NodeProperty::new("reportId", "Report ID", NodePropertyType::String)
                .placeholder("1")
                .show_when("operation", &["report.run"]),
            NodeProperty::new("format", "Format", NodePropertyType::Options)
                .options(vec![opt("JSON", "JSON"), opt("CSV", "CSV"), opt("XML", "XML")])
                .default(json!("JSON"))
                .show_when("operation", &["report.run"]),
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();
        let subdomain = cred
            .data
            .get("subdomain")
            .ok_or_else(|| NodeError::MissingParameter("subdomain".into()))?
            .clone();

        let base = format!(
            "https://api.bamboohr.com/api/gateway.php/{}/v1",
            urlencoding::encode(&subdomain)
        );
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "directory.list" => {
                let url = format!("{base}/employees/directory");
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .send()
                    .await?;
                wrap(res).await
            }
            "employee.list" => {
                // BambooHR does not offer a true list-all endpoint; the closest is the
                // directory.  We honour `fields` by piping it through a custom report.
                let fields = ctx
                    .param_str_opt(params, "fields")
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| {
                        "firstName,lastName,workEmail,jobTitle,department".into()
                    });
                let url = format!("{base}/reports/custom?format=JSON&onlyCurrent=true");
                let body = json!({
                    "title": "sabflow-employee-list",
                    "fields": fields
                        .split(',')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect::<Vec<_>>(),
                });
                let res = ctx
                    .http
                    .post(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                wrap(res).await
            }
            "employee.get" => {
                let id = sub(ctx, params, "employeeId")?;
                let fields = ctx
                    .param_str_opt(params, "fields")
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| {
                        "firstName,lastName,workEmail,jobTitle,department".into()
                    });
                let url = format!(
                    "{base}/employees/{}?fields={}",
                    urlencoding::encode(&id),
                    urlencoding::encode(&fields),
                );
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .send()
                    .await?;
                wrap(res).await
            }
            "employee.create" => {
                let body = json_param(ctx, params, "data")?;
                let url = format!("{base}/employees/");
                let res = ctx
                    .http
                    .post(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                // BambooHR returns 201 + a Location header for new employees.
                let status = res.status();
                let location = res
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let text = res.text().await.unwrap_or_default();
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                let mut out = Map::new();
                out.insert("status".into(), json!(status.as_u16()));
                if let Some(loc) = location {
                    out.insert("location".into(), json!(loc));
                }
                if !text.is_empty() {
                    out.insert(
                        "body".into(),
                        serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text)),
                    );
                }
                Ok(NodeOutput::single(vec![Value::Object(out)]))
            }
            "employee.update" => {
                let id = sub(ctx, params, "employeeId")?;
                let body = json_param(ctx, params, "data")?;
                let url = format!("{base}/employees/{}", urlencoding::encode(&id));
                let res = ctx
                    .http
                    .post(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                wrap(res).await
            }
            "timeOff.requests" => {
                let url = format!("{base}/time_off/requests/");
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .send()
                    .await?;
                wrap(res).await
            }
            "report.run" => {
                let report_id = sub(ctx, params, "reportId")?;
                let format = ctx
                    .param_str_opt(params, "format")
                    .unwrap_or_else(|| "JSON".into());
                let url = format!(
                    "{base}/reports/{}?format={}",
                    urlencoding::encode(&report_id),
                    urlencoding::encode(&format),
                );
                let res = ctx
                    .http
                    .get(&url)
                    .basic_auth(&api_key, Some("x"))
                    .header("Accept", "application/json")
                    .send()
                    .await?;
                wrap(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

fn json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<Value> {
    let raw = params
        .get(key)
        .cloned()
        .ok_or_else(|| NodeError::MissingParameter(key.to_string()))?;
    Ok(match raw {
        Value::String(s) => {
            let s = ctx.substitute(&s);
            serde_json::from_str::<Value>(&s).unwrap_or(Value::String(s))
        }
        other => other,
    })
}

async fn wrap(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let value: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text))
    };
    Ok(NodeOutput::single(vec![value]))
}
