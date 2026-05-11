//! Formstack node.
//!
//! Implements form, submission, and folder operations against the Formstack
//! REST API v2.
//!
//! Auth: OAuth2 — `Authorization: Bearer <token>` where the access token is
//! stored on the linked credential under `data["accessToken"]`.

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

const FORMSTACK_BASE: &str = "https://www.formstack.com/api/v2";

pub struct FormstackNode;

#[async_trait]
impl Node for FormstackNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "formstack",
            "Formstack",
            "Formstack online forms",
            NodeCategory::Productivity,
        )
        .icon("clipboard-list")
        .color("#21B573")
        .credentials(vec![CredentialBinding {
            name: "formstackOAuth2".into(),
            display_name: "Formstack OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Form".into(),
                        value: json!("form"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Submission".into(),
                        value: json!("submission"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Folder".into(),
                        value: json!("folder"),
                        description: None,
                    },
                ])
                .default(json!("form"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    // Form ops
                    NodePropertyOption {
                        name: "List Forms".into(),
                        value: json!("list"),
                        description: Some("List all forms accessible to the token".into()),
                    },
                    NodePropertyOption {
                        name: "Get Form".into(),
                        value: json!("get"),
                        description: Some("Get a form by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Copy Form".into(),
                        value: json!("copy"),
                        description: Some("Make a copy of a form".into()),
                    },
                    NodePropertyOption {
                        name: "Get Fields".into(),
                        value: json!("getFields"),
                        description: Some("List the fields on a form".into()),
                    },
                    NodePropertyOption {
                        name: "Get Submissions".into(),
                        value: json!("getSubmissions"),
                        description: Some("List submissions for a form".into()),
                    },
                    // Submission ops
                    NodePropertyOption {
                        name: "Get Submission".into(),
                        value: json!("getSubmission"),
                        description: Some("Get a submission by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Create Submission".into(),
                        value: json!("create"),
                        description: Some("Create a new submission on a form".into()),
                    },
                    NodePropertyOption {
                        name: "Update Submission".into(),
                        value: json!("update"),
                        description: Some("Update an existing submission".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Submission".into(),
                        value: json!("delete"),
                        description: Some("Delete a submission by ID".into()),
                    },
                    // Folder ops
                    NodePropertyOption {
                        name: "List Folders".into(),
                        value: json!("listFolders"),
                        description: Some("List all folders".into()),
                    },
                    NodePropertyOption {
                        name: "Get Folder".into(),
                        value: json!("getFolder"),
                        description: Some("Get a folder by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Create Folder".into(),
                        value: json!("createFolder"),
                        description: Some("Create a new folder".into()),
                    },
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("formId", "Form ID", NodePropertyType::String)
                .placeholder("1234567")
                .show_when(
                    "operation",
                    &["get", "copy", "getFields", "getSubmissions", "create"],
                )
                .required(),
            NodeProperty::new("submissionId", "Submission ID", NodePropertyType::String)
                .placeholder("12345678")
                .show_when("operation", &["getSubmission", "update", "delete"])
                .required(),
            NodeProperty::new("folderId", "Folder ID", NodePropertyType::String)
                .placeholder("12345")
                .show_when("operation", &["getFolder"])
                .required(),
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .description(
                    "JSON object mapping Formstack field ID to value (e.g. {\"123\": \"hello\"})",
                )
                .default(json!({}))
                .show_when("operation", &["create", "update"])
                .required(),
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

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            // ---------- Form ----------
            "list" => {
                let url = format!("{FORMSTACK_BASE}/form.json");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "get" => {
                let form_id = substituted(ctx, params, "formId")?;
                let url = format!("{FORMSTACK_BASE}/form/{}.json", encode_path(&form_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "copy" => {
                let form_id = substituted(ctx, params, "formId")?;
                let url = format!("{FORMSTACK_BASE}/form/{}/copy.json", encode_path(&form_id));
                let res = ctx.http.post(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "getFields" => {
                let form_id = substituted(ctx, params, "formId")?;
                let url = format!("{FORMSTACK_BASE}/form/{}/field.json", encode_path(&form_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "getSubmissions" => {
                let form_id = substituted(ctx, params, "formId")?;
                let url = format!(
                    "{FORMSTACK_BASE}/form/{}/submission.json",
                    encode_path(&form_id)
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ---------- Submission ----------
            "getSubmission" => {
                let submission_id = substituted(ctx, params, "submissionId")?;
                let url = format!(
                    "{FORMSTACK_BASE}/submission/{}.json",
                    encode_path(&submission_id)
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "create" => {
                let form_id = substituted(ctx, params, "formId")?;
                let fields = read_fields(ctx, params, "fields")?;
                let url = format!(
                    "{FORMSTACK_BASE}/form/{}/submission.json",
                    encode_path(&form_id)
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&Value::Object(fields))
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "update" => {
                let submission_id = substituted(ctx, params, "submissionId")?;
                let fields = read_fields(ctx, params, "fields")?;
                let url = format!(
                    "{FORMSTACK_BASE}/submission/{}.json",
                    encode_path(&submission_id)
                );
                let res = ctx
                    .http
                    .put(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&Value::Object(fields))
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "delete" => {
                let submission_id = substituted(ctx, params, "submissionId")?;
                let url = format!(
                    "{FORMSTACK_BASE}/submission/{}.json",
                    encode_path(&submission_id)
                );
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ---------- Folder ----------
            "listFolders" => {
                let url = format!("{FORMSTACK_BASE}/folder.json");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "getFolder" => {
                let folder_id = substituted(ctx, params, "folderId")?;
                let url = format!("{FORMSTACK_BASE}/folder/{}.json", encode_path(&folder_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "createFolder" => {
                let url = format!("{FORMSTACK_BASE}/folder.json");
                let res = ctx.http.post(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Read a string parameter and run `{{var}}` substitution on it.
fn substituted(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

/// Read the `fields` property — accepts either a JSON object directly or a
/// JSON string that parses to an object. Returns the object map.
fn read_fields(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
) -> NodeResult<Map<String, Value>> {
    let value = match params.get(key) {
        Some(v) => v,
        None => &Value::Null,
    };
    let resolved: Value = match value {
        Value::String(s) => {
            let sub = ctx.substitute(s);
            let trimmed = sub.trim();
            if trimmed.is_empty() {
                Value::Object(Map::new())
            } else {
                serde_json::from_str(trimmed).map_err(|e| NodeError::InvalidParameter {
                    name: key.into(),
                    reason: format!("not valid JSON: {e}"),
                })?
            }
        }
        Value::Null => Value::Object(Map::new()),
        other => other.clone(),
    };
    match resolved {
        Value::Object(map) => Ok(map),
        _ => Err(NodeError::InvalidParameter {
            name: key.into(),
            reason: "fields must be a JSON object".into(),
        }),
    }
}

/// Percent-encode a single path segment.
fn encode_path(segment: &str) -> String {
    urlencoding::encode(segment).into_owned()
}

/// Parse the response body as JSON and return an `UpstreamError` for non-2xx.
async fn json_or_err(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    if text.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text).map_err(NodeError::from)
}
