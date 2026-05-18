//! Microsoft Excel 365 node — workbook operations via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `microsoftOAuth2Api` credential (Bearer accessToken).
//!
//! Resources / operations implemented:
//!   - workbook.listWorksheets GET  `/me/drive/items/{item-id}/workbook/worksheets`
//!   - worksheet.getRange      GET  `/me/drive/items/{item-id}/workbook/worksheets/{ws}/range(address='{addr}')`
//!   - worksheet.updateRange   PATCH `/me/drive/items/{item-id}/workbook/worksheets/{ws}/range(address='{addr}')`
//!   - table.listRows          GET  `/me/drive/items/{item-id}/workbook/tables/{tbl}/rows`
//!   - table.addRow            POST `/me/drive/items/{item-id}/workbook/tables/{tbl}/rows/add`

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
    nodes::microsoft_outlook::{emit, ms_bearer_token, urlencode_path},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

pub struct MicrosoftExcel365Node;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftExcel365Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftExcel365",
            "Microsoft Excel 365",
            "Read and write Excel workbook ranges and table rows",
            NodeCategory::Productivity,
        )
        .icon("table")
        .color("#107C41")
        .credentials(vec![CredentialBinding {
            name: "microsoftOAuth2Api".into(),
            display_name: "Microsoft OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Workbook", "workbook"),
                    opt("Worksheet", "worksheet"),
                    opt("Table", "table"),
                ])
                .default(json!("worksheet"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Worksheets", "listWorksheets"),
                    opt("Get Range", "getRange"),
                    opt("Update Range", "updateRange"),
                    opt("List Rows", "listRows"),
                    opt("Add Row", "addRow"),
                ])
                .default(json!("getRange"))
                .required(),
            NodeProperty::new("workbookItemId", "Workbook Item ID", NodePropertyType::String)
                .required(),
            NodeProperty::new("worksheet", "Worksheet (name or id)", NodePropertyType::String)
                .show_when("resource", &["worksheet"]),
            NodeProperty::new("rangeAddress", "Range Address", NodePropertyType::String)
                .placeholder("A1:C10")
                .show_when("operation", &["getRange", "updateRange"]),
            NodeProperty::new("rangeValues", "Values (2D JSON array)", NodePropertyType::Json)
                .show_when("operation", &["updateRange"])
                .description("e.g. [[\"a\",\"b\"],[\"c\",\"d\"]]"),
            NodeProperty::new("tableId", "Table (name or id)", NodePropertyType::String)
                .show_when("resource", &["table"]),
            NodeProperty::new("rowValues", "Row Values (JSON array)", NodePropertyType::Json)
                .show_when("operation", &["addRow"])
                .description("e.g. [[1,2,3]]"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let token = ms_bearer_token(ctx, params)?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;
        let item_id = ctx.param_str(params, "workbookItemId")?;
        let item = urlencode_path(&item_id);

        match (resource.as_str(), operation.as_str()) {
            ("workbook", "listWorksheets") => {
                let url = format!("{GRAPH_BASE}/me/drive/items/{item}/workbook/worksheets");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("worksheet", "getRange") => {
                let ws = ctx.param_str(params, "worksheet")?;
                let addr = ctx.param_str(params, "rangeAddress")?;
                let url = format!(
                    "{GRAPH_BASE}/me/drive/items/{item}/workbook/worksheets/{}/range(address='{}')",
                    urlencode_path(&ws),
                    urlencode_path(&addr),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("worksheet", "updateRange") => {
                let ws = ctx.param_str(params, "worksheet")?;
                let addr = ctx.param_str(params, "rangeAddress")?;
                let values = parse_json_param(params, "rangeValues")?;
                let url = format!(
                    "{GRAPH_BASE}/me/drive/items/{item}/workbook/worksheets/{}/range(address='{}')",
                    urlencode_path(&ws),
                    urlencode_path(&addr),
                );
                let payload = json!({ "values": values });
                let res = ctx
                    .http
                    .patch(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("table", "listRows") => {
                let table_id = ctx.param_str(params, "tableId")?;
                let url = format!(
                    "{GRAPH_BASE}/me/drive/items/{item}/workbook/tables/{}/rows",
                    urlencode_path(&table_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("table", "addRow") => {
                let table_id = ctx.param_str(params, "tableId")?;
                let values = parse_json_param(params, "rowValues")?;
                let url = format!(
                    "{GRAPH_BASE}/me/drive/items/{item}/workbook/tables/{}/rows/add",
                    urlencode_path(&table_id),
                );
                let payload = json!({ "values": values, "index": null });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported resource/operation combination: {r}/{o}"),
            }),
        }
    }
}

/// Accept a Json field that may also arrive as a stringified JSON blob.
fn parse_json_param(params: &Value, key: &str) -> NodeResult<Value> {
    match params.get(key) {
        None | Some(Value::Null) => Err(NodeError::MissingParameter(key.to_string())),
        Some(Value::String(s)) => serde_json::from_str(s).map_err(|e| NodeError::InvalidParameter {
            name: key.to_string(),
            reason: format!("invalid JSON: {e}"),
        }),
        Some(other) => Ok(other.clone()),
    }
}
