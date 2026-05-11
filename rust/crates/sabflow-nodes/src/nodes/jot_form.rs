//! JotForm node.
//!
//! Implements form and submission operations against the JotForm REST API
//! (https://api.jotform.com).  Authenticates by appending `?apiKey={apiKey}`
//! to every request, sourced from the `jotFormApi` credential.

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

pub struct JotFormNode;

const JOTFORM_API_BASE: &str = "https://api.jotform.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for JotFormNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jotForm",
            "JotForm",
            "JotForm online forms — manage forms, questions and submissions",
            NodeCategory::Productivity,
        )
        .icon("clipboard-list")
        .color("#FF6100")
        .credentials(vec![CredentialBinding {
            name: "jotFormApi".into(),
            display_name: "JotForm API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Forms", "listForms"),
                    opt("Get Form", "getForm"),
                    opt("Get Form Questions", "getFormQuestions"),
                    opt("Get Form Submissions", "getFormSubmissions"),
                    opt("Get Submission", "getSubmission"),
                    opt("Delete Submission", "deleteSubmission"),
                    opt("Create Submission", "createSubmission"),
                ])
                .default(json!("listForms"))
                .required(),
            // formId
            NodeProperty::new("formId", "Form ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &[
                        "getForm",
                        "getFormQuestions",
                        "getFormSubmissions",
                        "createSubmission",
                    ],
                )
                .required(),
            // submissionId
            NodeProperty::new("submissionId", "Submission ID", NodePropertyType::String)
                .show_when("operation", &["getSubmission", "deleteSubmission"])
                .required(),
            // createSubmission fields
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .show_when("operation", &["createSubmission"])
                .description(
                    "JSON object of submission fields, e.g. {\"submission[1_first]\":\"Jane\"} \
                     or {\"1_first\":\"Jane\"}",
                ),
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

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "listForms" => send_json(ctx, &api_key, Method::Get, "/user/forms", None).await?,
            "getForm" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/form/{form_id}");
                send_json(ctx, &api_key, Method::Get, &path, None).await?
            }
            "getFormQuestions" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/form/{form_id}/questions");
                send_json(ctx, &api_key, Method::Get, &path, None).await?
            }
            "getFormSubmissions" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/form/{form_id}/submissions");
                send_json(ctx, &api_key, Method::Get, &path, None).await?
            }
            "getSubmission" => {
                let submission_id = ctx.param_str(params, "submissionId")?;
                let path = format!("/submission/{submission_id}");
                send_json(ctx, &api_key, Method::Get, &path, None).await?
            }
            "deleteSubmission" => {
                let submission_id = ctx.param_str(params, "submissionId")?;
                let path = format!("/submission/{submission_id}");
                send_json(ctx, &api_key, Method::Delete, &path, None).await?
            }
            "createSubmission" => {
                let form_id = ctx.param_str(params, "formId")?;
                let path = format!("/form/{form_id}/submissions");
                let fields_obj = parse_json_object(ctx, params, "fields").unwrap_or_default();
                let form: Vec<(String, String)> = fields_obj
                    .into_iter()
                    .map(|(k, v)| (k, value_as_string(&v)))
                    .collect();
                post_form(ctx, &api_key, &path, &form).await?
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

#[derive(Clone, Copy)]
enum Method {
    Get,
    Delete,
}

async fn send_json(
    ctx: &ExecutionContext,
    api_key: &str,
    method: Method,
    path: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let url = format!("{JOTFORM_API_BASE}{path}");
    let mut req = match method {
        Method::Get => ctx.http.get(&url),
        Method::Delete => ctx.http.delete(&url),
    };
    req = req.query(&[("apiKey", api_key)]);
    if let Some(body) = payload {
        req = req.json(&body);
    }
    finalize_response(req.send().await?).await
}

async fn post_form(
    ctx: &ExecutionContext,
    api_key: &str,
    path: &str,
    form: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{JOTFORM_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .query(&[("apiKey", api_key)])
        .form(form)
        .send()
        .await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
}

fn parse_json_object(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
) -> Option<Map<String, Value>> {
    let raw = params.get(key)?;
    let v = match raw {
        Value::Null => return None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(trimmed).ok()?
        }
        other => substitute_value(ctx, other.clone()),
    };
    match v {
        Value::Object(map) => Some(map),
        _ => None,
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}

fn value_as_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}
