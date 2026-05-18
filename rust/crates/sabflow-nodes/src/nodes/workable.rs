//! Workable node — Workable Recruiting API
//! (`https://{subdomain}.workable.com/spi/v3`).
//!
//! Auth: a personal access token issued in *Workable → Integrations → Access
//! tokens*, sent as `Authorization: Bearer <token>`.  The linked credential's
//! `data["accessToken"]` holds the secret and `data["subdomain"]` holds the
//! company's Workable subdomain (e.g. `acme` for `acme.workable.com`).
//!
//! Supported operations:
//!   - `job.list`, `job.get`                       → jobs
//!   - `candidate.list`, `candidate.get`,
//!     `candidate.create`, `candidate.move`        → candidates
//!   - `stage.list`                                → recruitment stages
//!   - `member.list`                               → team members

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

pub struct WorkableNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for WorkableNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "workable",
            "Workable",
            "Workable recruiting and ATS",
            NodeCategory::Hr,
        )
        .icon("briefcase")
        .color("#3FCDD9")
        .credentials(vec![CredentialBinding {
            name: "workableApi".into(),
            display_name: "Workable Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Jobs", "job.list"),
                    opt("Get Job", "job.get"),
                    opt("List Candidates", "candidate.list"),
                    opt("Get Candidate", "candidate.get"),
                    opt("Create Candidate", "candidate.create"),
                    opt("Move Candidate", "candidate.move"),
                    opt("List Stages", "stage.list"),
                    opt("List Team Members", "member.list"),
                ])
                .default(json!("job.list"))
                .required(),
            NodeProperty::new("shortcode", "Job Shortcode", NodePropertyType::String)
                .placeholder("ABCDE1234")
                .show_when(
                    "operation",
                    &[
                        "job.get",
                        "candidate.list",
                        "candidate.create",
                        "candidate.move",
                    ],
                )
                .description("Workable job shortcode (e.g. `ABCDE1234`)"),
            NodeProperty::new("candidateId", "Candidate ID", NodePropertyType::String)
                .show_when("operation", &["candidate.get", "candidate.move"]),
            NodeProperty::new("stageSlug", "Target Stage", NodePropertyType::String)
                .placeholder("sourced")
                .show_when("operation", &["candidate.move"]),
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("operation", &["candidate.create"]),
            NodeProperty::new("lastName", "Last Name", NodePropertyType::String)
                .show_when("operation", &["candidate.create"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .show_when("operation", &["candidate.create"]),
            NodeProperty::new("phone", "Phone", NodePropertyType::String)
                .show_when("operation", &["candidate.create"]),
            NodeProperty::new("headline", "Headline", NodePropertyType::String)
                .show_when("operation", &["candidate.create"])
                .description("Short candidate summary, e.g. their current title"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["job.list", "candidate.list"]),
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();
        let subdomain = cred
            .data
            .get("subdomain")
            .ok_or_else(|| NodeError::MissingParameter("subdomain".into()))?
            .clone();

        let base = format!(
            "https://{}.workable.com/spi/v3",
            urlencoding::encode(&subdomain)
        );
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "job.list" => {
                let limit = ctx.param_f64(params, "limit").unwrap_or(50.0) as i64;
                let url = format!("{base}/jobs");
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&[("limit", limit.to_string())])
                    .send()
                    .await?;
                wrap(res).await
            }
            "job.get" => {
                let code = sub(ctx, params, "shortcode")?;
                let url = format!("{base}/jobs/{}", urlencoding::encode(&code));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "candidate.list" => {
                let code = sub(ctx, params, "shortcode")?;
                let limit = ctx.param_f64(params, "limit").unwrap_or(50.0) as i64;
                let url = format!(
                    "{base}/jobs/{}/candidates",
                    urlencoding::encode(&code)
                );
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&[("limit", limit.to_string())])
                    .send()
                    .await?;
                wrap(res).await
            }
            "candidate.get" => {
                let id = sub(ctx, params, "candidateId")?;
                let url = format!("{base}/candidates/{}", urlencoding::encode(&id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "candidate.create" => {
                let code = sub(ctx, params, "shortcode")?;
                let mut candidate = Map::new();
                if let Some(v) = sub_opt(ctx, params, "firstName") {
                    if !v.is_empty() {
                        candidate.insert("firstname".into(), json!(v));
                    }
                }
                if let Some(v) = sub_opt(ctx, params, "lastName") {
                    if !v.is_empty() {
                        candidate.insert("lastname".into(), json!(v));
                    }
                }
                if let Some(v) = sub_opt(ctx, params, "email") {
                    if !v.is_empty() {
                        candidate.insert("email".into(), json!(v));
                    }
                }
                if let Some(v) = sub_opt(ctx, params, "phone") {
                    if !v.is_empty() {
                        candidate.insert("phone".into(), json!(v));
                    }
                }
                if let Some(v) = sub_opt(ctx, params, "headline") {
                    if !v.is_empty() {
                        candidate.insert("headline".into(), json!(v));
                    }
                }
                if candidate.is_empty() {
                    return Err(NodeError::MissingParameter(
                        "candidate (firstName/lastName/email)".into(),
                    ));
                }
                let body = json!({ "sourced": true, "candidate": Value::Object(candidate) });
                let url = format!(
                    "{base}/jobs/{}/candidates",
                    urlencoding::encode(&code)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&body)
                    .send()
                    .await?;
                wrap(res).await
            }
            "candidate.move" => {
                let code = sub(ctx, params, "shortcode")?;
                let candidate_id = sub(ctx, params, "candidateId")?;
                let stage = sub(ctx, params, "stageSlug")?;
                let url = format!(
                    "{base}/jobs/{}/candidates/{}/move",
                    urlencoding::encode(&code),
                    urlencoding::encode(&candidate_id),
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "target_stage": stage }))
                    .send()
                    .await?;
                wrap(res).await
            }
            "stage.list" => {
                let url = format!("{base}/stages");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "member.list" => {
                let url = format!("{base}/members");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
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

fn sub_opt(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<String> {
    ctx.param_str_opt(params, key).map(|s| ctx.substitute(&s))
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
