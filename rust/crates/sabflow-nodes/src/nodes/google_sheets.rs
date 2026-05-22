//! Google Sheets node.
//!
//! Implements the Google Sheets v4 REST API for the common spreadsheet and
//! sheet-values operations (read / append / update / clear / create / get).
//!
//! Authentication: we expect the credential to be a pre-refreshed OAuth2
//! access token stored at `cred.data["accessToken"]`.
//!
//! TODO(sabflow): wire up full OAuth2 refresh-token handling — currently the
//! credential is assumed to already hold a valid, non-expired access token.
//! Future work: detect 401 from Google, swap refresh token for a new access
//! token via the OAuth2 token endpoint, persist the rotated token, and retry.

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

pub struct GoogleSheetsNode;

const BASE_URL: &str = "https://sheets.googleapis.com/v4";

#[async_trait]
impl Node for GoogleSheetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleSheets",
            "Google Sheets",
            "Read and write Google Sheets",
            NodeCategory::Productivity,
        )
        .icon("table-2")
        .color("#0F9D58")
        .credentials(vec![CredentialBinding {
            name: "googleSheetsOAuth2".into(),
            display_name: "Google Sheets OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Sheet".into(),
                        value: json!("sheet"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Spreadsheet".into(),
                        value: json!("spreadsheet"),
                        description: None,
                    },
                ])
                .default(json!("sheet"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Read".into(),
                        value: json!("read"),
                        description: Some("Read values from a range".into()),
                    },
                    NodePropertyOption {
                        name: "Append".into(),
                        value: json!("append"),
                        description: Some("Append rows to a range".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Update values in a range".into()),
                    },
                    NodePropertyOption {
                        name: "Clear".into(),
                        value: json!("clear"),
                        description: Some("Clear values in a range".into()),
                    },
                    NodePropertyOption {
                        name: "Create".into(),
                        value: json!("create"),
                        description: Some("Create a new spreadsheet".into()),
                    },
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Get spreadsheet metadata".into()),
                    },
                ])
                .default(json!("read"))
                .required(),
            NodeProperty::new("spreadsheetId", "Spreadsheet ID", NodePropertyType::String)
                .required(),
            NodeProperty::new("range", "Range", NodePropertyType::String)
                .placeholder("Sheet1!A1:Z1000")
                .show_when("operation", &["read", "append", "update", "clear"]),
            NodeProperty::new("values", "Values", NodePropertyType::Json)
                .description("Array of rows, each row is an array of cells")
                .show_when("operation", &["append", "update"]),
            NodeProperty::new(
                "valueInputOption",
                "Value Input Option",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Raw".into(),
                    value: json!("RAW"),
                    description: None,
                },
                NodePropertyOption {
                    name: "User Entered".into(),
                    value: json!("USER_ENTERED"),
                    description: None,
                },
            ])
            .default(json!("USER_ENTERED"))
            .show_when("operation", &["append", "update"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["create"]),
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

        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            ("sheet", "read") => {
                let spreadsheet_id = ctx.param_str(params, "spreadsheetId")?;
                let range = ctx.param_str(params, "range")?;
                let url = format!(
                    "{}/spreadsheets/{}/values/{}",
                    BASE_URL,
                    urlencode(&spreadsheet_id),
                    urlencode(&range),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("sheet", "append") => {
                let spreadsheet_id = ctx.param_str(params, "spreadsheetId")?;
                let range = ctx.param_str(params, "range")?;
                let value_input_option = ctx
                    .param_str_opt(params, "valueInputOption")
                    .unwrap_or_else(|| "USER_ENTERED".to_string());
                let values = extract_values(params)?;
                let url = format!(
                    "{}/spreadsheets/{}/values/{}:append?valueInputOption={}",
                    BASE_URL,
                    urlencode(&spreadsheet_id),
                    urlencode(&range),
                    urlencode(&value_input_option),
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "values": values }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("sheet", "update") => {
                let spreadsheet_id = ctx.param_str(params, "spreadsheetId")?;
                let range = ctx.param_str(params, "range")?;
                let value_input_option = ctx
                    .param_str_opt(params, "valueInputOption")
                    .unwrap_or_else(|| "USER_ENTERED".to_string());
                let values = extract_values(params)?;
                let url = format!(
                    "{}/spreadsheets/{}/values/{}?valueInputOption={}",
                    BASE_URL,
                    urlencode(&spreadsheet_id),
                    urlencode(&range),
                    urlencode(&value_input_option),
                );
                let res = ctx
                    .http
                    .put(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "values": values }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("sheet", "clear") => {
                let spreadsheet_id = ctx.param_str(params, "spreadsheetId")?;
                let range = ctx.param_str(params, "range")?;
                let url = format!(
                    "{}/spreadsheets/{}/values/{}:clear",
                    BASE_URL,
                    urlencode(&spreadsheet_id),
                    urlencode(&range),
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({}))
                    .send()
                    .await?;
                emit(res).await
            }
            ("spreadsheet", "create") => {
                let title = ctx.param_str(params, "title")?;
                let url = format!("{}/spreadsheets", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "properties": { "title": title } }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("spreadsheet", "get") => {
                let spreadsheet_id = ctx.param_str(params, "spreadsheetId")?;
                let url = format!("{}/spreadsheets/{}", BASE_URL, urlencode(&spreadsheet_id),);
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            (other_resource, other_op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!(
                    "unsupported resource/operation combination: {other_resource}/{other_op}"
                ),
            }),
        }
    }
}

/// Pull a JSON `values` field out of params. Accepts either a JSON array
/// directly or a stringified JSON array (since the frontend may submit it
/// as a string from a textarea).
fn extract_values(params: &Value) -> NodeResult<Value> {
    let raw = params
        .get("values")
        .ok_or_else(|| NodeError::MissingParameter("values".into()))?;
    match raw {
        Value::Array(_) => Ok(raw.clone()),
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Err(NodeError::MissingParameter("values".into()));
            }
            let parsed: Value = serde_json::from_str(trimmed)?;
            if !parsed.is_array() {
                return Err(NodeError::InvalidParameter {
                    name: "values".into(),
                    reason: "expected a JSON array of rows".into(),
                });
            }
            Ok(parsed)
        }
        _ => Err(NodeError::InvalidParameter {
            name: "values".into(),
            reason: "expected a JSON array of rows".into(),
        }),
    }
}

/// Consume an HTTP response, error on non-2xx, return body as a single-item
/// NodeOutput. If the body is not JSON, wrap it in `{ "body": "<text>" }`.
async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}

/// Minimal percent-encoder for URL path/query components. We only need to
/// handle the characters that commonly appear in Sheets ranges (e.g. `!`,
/// `:`, space) and spreadsheet ids (alphanumeric + `-` + `_`).
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        let c = *b;
        let safe = c.is_ascii_alphanumeric() || c == b'-' || c == b'_' || c == b'.' || c == b'~';
        if safe {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}
