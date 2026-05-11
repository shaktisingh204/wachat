//! monday.com node — boards, items, users via the monday.com GraphQL API.
//!
//! API endpoint: https://api.monday.com/v2 (GraphQL — single POST endpoint)
//! Auth: `Authorization: <apiToken>` (no Bearer prefix)

use async_trait::async_trait;
use reqwest::RequestBuilder;
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

const MONDAY_ENDPOINT: &str = "https://api.monday.com/v2";

pub struct MondayComNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MondayComNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mondayCom",
            "monday.com",
            "monday.com work OS",
            NodeCategory::Productivity,
        )
        .icon("layout-grid")
        .color("#FF3D57")
        .credentials(vec![CredentialBinding {
            name: "mondayComApi".into(),
            display_name: "monday.com API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List Boards", "listBoards"),
                    opt("Get Board", "getBoard"),
                    opt("Create Board", "createBoard"),
                    opt("Create Item", "createItem"),
                    opt("Get Item", "getItem"),
                    opt("Update Item", "updateItem"),
                    opt("Delete Item", "deleteItem"),
                    opt("List Users", "listUsers"),
                ])
                .default(json!("listBoards"))
                .required(),
            // ── identifiers ────────────────────────────────────────────────────
            NodeProperty::new("boardId", "Board ID", NodePropertyType::String)
                .show_when("operation", &["getBoard", "createItem"]),
            NodeProperty::new("itemId", "Item ID", NodePropertyType::String)
                .show_when("operation", &["getItem", "updateItem", "deleteItem"]),
            // ── board create ───────────────────────────────────────────────────
            NodeProperty::new("boardName", "Board Name", NodePropertyType::String)
                .show_when("operation", &["createBoard"]),
            NodeProperty::new("boardKind", "Board Kind", NodePropertyType::Options)
                .options(vec![
                    opt("Public", "public"),
                    opt("Private", "private"),
                    opt("Share", "share"),
                ])
                .default(json!("public"))
                .show_when("operation", &["createBoard"]),
            // ── item create / update ───────────────────────────────────────────
            NodeProperty::new("itemName", "Item Name", NodePropertyType::String)
                .show_when("operation", &["createItem"]),
            NodeProperty::new("columnValues", "Column Values (JSON)", NodePropertyType::Json)
                .default(json!({}))
                .description("JSON object mapping column id to value")
                .show_when("operation", &["createItem", "updateItem"]),
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
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let (query, variables) = match operation.as_str() {
            "listBoards" => {
                let q = "query { boards { id name items_count } }".to_string();
                (q, Value::Object(Map::new()))
            }
            "getBoard" => {
                let board_id = ctx.param_str(params, "boardId")?;
                let q = "query($ids: [ID!]) { boards(ids: $ids) { id name columns { id title } } }"
                    .to_string();
                let mut v = Map::new();
                v.insert("ids".into(), json!([board_id]));
                (q, Value::Object(v))
            }
            "createBoard" => {
                let board_name = ctx.param_str(params, "boardName")?;
                let board_kind = ctx
                    .param_str_opt(params, "boardKind")
                    .unwrap_or_else(|| "public".to_string());
                let q = "mutation($name: String!, $kind: BoardKind!) { create_board(board_name: $name, board_kind: $kind) { id } }"
                    .to_string();
                let mut v = Map::new();
                v.insert("name".into(), Value::String(board_name));
                v.insert("kind".into(), Value::String(board_kind));
                (q, Value::Object(v))
            }
            "createItem" => {
                let board_id = ctx.param_str(params, "boardId")?;
                let item_name = ctx.param_str(params, "itemName")?;
                let column_values = resolve_column_values(ctx, params.get("columnValues"));
                let q = "mutation($boardId: ID!, $name: String!, $cv: JSON) { create_item(board_id: $boardId, item_name: $name, column_values: $cv) { id } }"
                    .to_string();
                let mut v = Map::new();
                v.insert("boardId".into(), Value::String(board_id));
                v.insert("name".into(), Value::String(item_name));
                v.insert("cv".into(), Value::String(column_values));
                (q, Value::Object(v))
            }
            "getItem" => {
                let item_id = ctx.param_str(params, "itemId")?;
                let q = "query($ids: [ID!]) { items(ids: $ids) { id name column_values { id value } } }"
                    .to_string();
                let mut v = Map::new();
                v.insert("ids".into(), json!([item_id]));
                (q, Value::Object(v))
            }
            "updateItem" => {
                let item_id = ctx.param_str(params, "itemId")?;
                let column_values = resolve_column_values(ctx, params.get("columnValues"));
                // change_multiple_column_values needs the board too, but the
                // monday API exposes a helper that takes only item_id when the
                // board is inferable; we still require board for robustness.
                let board_id = ctx
                    .param_str_opt(params, "boardId")
                    .unwrap_or_default();
                let q = "mutation($boardId: ID!, $itemId: ID!, $cv: JSON!) { change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $cv) { id } }"
                    .to_string();
                let mut v = Map::new();
                v.insert("boardId".into(), Value::String(board_id));
                v.insert("itemId".into(), Value::String(item_id));
                v.insert("cv".into(), Value::String(column_values));
                (q, Value::Object(v))
            }
            "deleteItem" => {
                let item_id = ctx.param_str(params, "itemId")?;
                let q = "mutation($id: ID!) { delete_item(item_id: $id) { id } }".to_string();
                let mut v = Map::new();
                v.insert("id".into(), Value::String(item_id));
                (q, Value::Object(v))
            }
            "listUsers" => {
                let q = "query { users { id name email } }".to_string();
                (q, Value::Object(Map::new()))
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        // Apply {{var}} substitution to the query text. Variables already came
        // through ctx.param_str / param_str_opt which substitutes for us.
        let query = ctx.substitute(&query);

        let payload = json!({
            "query": query,
            "variables": variables,
        });

        let body = send_graphql(monday_req(ctx, &token), &payload).await?;

        // monday returns 200 OK even for query errors — surface them.
        if let Some(errors) = body.get("errors") {
            if let Some(arr) = errors.as_array() {
                if !arr.is_empty() {
                    return Err(NodeError::UpstreamError {
                        status: 200,
                        body: errors.to_string(),
                    });
                }
            }
        }

        Ok(NodeOutput::single(vec![body]))
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

fn monday_req(ctx: &ExecutionContext, token: &str) -> RequestBuilder {
    // monday.com expects the API token in Authorization (no Bearer prefix).
    ctx.http
        .post(MONDAY_ENDPOINT)
        .header("Authorization", token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .header("API-Version", "2024-01")
}

async fn send_graphql(req: RequestBuilder, payload: &Value) -> NodeResult<Value> {
    let res = req.json(payload).send().await?;
    let status = res.status();
    let bytes = res.bytes().await?;
    let body: Value = serde_json::from_slice(&bytes).unwrap_or_else(|_| {
        Value::String(String::from_utf8_lossy(&bytes).into_owned())
    });
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: match &body {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            },
        });
    }
    Ok(body)
}

/// monday's GraphQL JSON column_values is a JSON-encoded *string*, not a real
/// JSON object. Normalise any input shape into a stringified JSON object.
fn resolve_column_values(ctx: &ExecutionContext, raw: Option<&Value>) -> String {
    let Some(v) = raw.cloned() else {
        return "{}".to_string();
    };

    let normalised: Value = match v {
        Value::String(s) => {
            let s = ctx.substitute(&s);
            if s.trim().is_empty() {
                return "{}".to_string();
            }
            // If it's already valid JSON, use that; otherwise wrap as string.
            serde_json::from_str::<Value>(&s).unwrap_or(Value::String(s))
        }
        other => substitute_value(ctx, other),
    };

    match &normalised {
        Value::Null => "{}".to_string(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(
            arr.into_iter().map(|x| substitute_value(ctx, x)).collect(),
        ),
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
