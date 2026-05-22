//! Notion node — pages, databases, blocks, users via the Notion REST API.
//!
//! API base: https://api.notion.com/v1
//! Auth: `Authorization: Bearer <integration_token>` (`secret_…`)
//! Required header: `Notion-Version: 2022-06-28`

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

const NOTION_BASE: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";

pub struct NotionNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for NotionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "notion",
            "Notion",
            "Notion pages and databases",
            NodeCategory::Productivity,
        )
        .icon("book")
        .color("#000000")
        .credentials(vec![CredentialBinding {
            name: "notionApi".into(),
            display_name: "Notion API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Page", "page"),
                    opt("Database", "database"),
                    opt("Block", "block"),
                    opt("User", "user"),
                ])
                .default(json!("page"))
                .required(),
            // ── page operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Archive", "archive"),
                    opt("Search", "search"),
                ])
                .default(json!("create"))
                .show_when("resource", &["page"])
                .required(),
            // ── database operations ────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Query", "query"),
                    opt("Create", "create"),
                ])
                .default(json!("query"))
                .show_when("resource", &["database"])
                .required(),
            // ── block operations ───────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Append Children", "append"),
                    opt("Get Children", "getChildren"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("append"))
                .show_when("resource", &["block"])
                .required(),
            // ── user operations ────────────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get"), opt("Get All", "getAll")])
                .default(json!("getAll"))
                .show_when("resource", &["user"])
                .required(),
            // ── parameters (visibility scoped by operation) ────────────────────
            NodeProperty::new("pageId", "Page ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "archive"]),
            NodeProperty::new("parentId", "Parent ID", NodePropertyType::String)
                .description("Parent database id (page:create) or block id (block:append)")
                .show_when("operation", &["create", "append"]),
            NodeProperty::new("databaseId", "Database ID", NodePropertyType::String)
                .show_when("operation", &["query", "get"]),
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("properties", "Properties", NodePropertyType::Json)
                .default(json!({}))
                .description("Full Notion properties object")
                .show_when("operation", &["create", "update"]),
            NodeProperty::new("children", "Children Blocks", NodePropertyType::Json)
                .default(json!([]))
                .description("Array of Notion block objects")
                .show_when("operation", &["create", "append"]),
            NodeProperty::new("blockId", "Block ID", NodePropertyType::String)
                .show_when("operation", &["getChildren", "update", "delete"]),
            NodeProperty::new("filter", "Filter", NodePropertyType::Json)
                .default(json!({}))
                .description("Notion filter object")
                .show_when("operation", &["query"]),
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .show_when("operation", &["get"]),
            NodeProperty::new("query", "Search Query", NodePropertyType::String)
                .show_when("operation", &["search"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "page".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body = match (resource.as_str(), operation.as_str()) {
            // ─── Pages ───────────────────────────────────────────────────────
            ("page", "create") => {
                let parent_id = ctx.param_str(params, "parentId")?;
                let properties =
                    resolve_json(ctx, params.get("properties")).unwrap_or_else(|| json!({}));
                let children = resolve_json(ctx, params.get("children"));
                let title_opt = ctx.param_str_opt(params, "title");

                // If parentId looks like a UUID with dashes, default to database_id.
                // Caller can pass either a database or page parent — we prefer
                // database_id, which is the typical create flow.
                let mut payload = Map::new();
                payload.insert("parent".into(), json!({ "database_id": parent_id }));

                // Merge title into properties if user provided a top-level title and
                // no `title` key was set in properties.
                let mut props_obj = match properties {
                    Value::Object(map) => map,
                    _ => Map::new(),
                };
                if let Some(title) = title_opt {
                    if !title.is_empty()
                        && !props_obj.contains_key("title")
                        && !props_obj.contains_key("Name")
                    {
                        props_obj.insert(
                            "title".into(),
                            json!({
                                "title": [
                                    { "text": { "content": title } }
                                ]
                            }),
                        );
                    }
                }
                payload.insert("properties".into(), Value::Object(props_obj));

                if let Some(c) = children {
                    payload.insert("children".into(), c);
                }

                let url = format!("{NOTION_BASE}/pages");
                send_json(
                    notion_req(ctx, &token, reqwest::Method::POST, &url),
                    &Value::Object(payload),
                )
                .await?
            }
            ("page", "get") => {
                let page_id = ctx.param_str(params, "pageId")?;
                let url = format!("{NOTION_BASE}/pages/{page_id}");
                send_no_body(notion_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("page", "update") => {
                let page_id = ctx.param_str(params, "pageId")?;
                let properties =
                    resolve_json(ctx, params.get("properties")).unwrap_or_else(|| json!({}));
                let url = format!("{NOTION_BASE}/pages/{page_id}");
                send_json(
                    notion_req(ctx, &token, reqwest::Method::PATCH, &url),
                    &json!({ "properties": properties }),
                )
                .await?
            }
            ("page", "archive") => {
                let page_id = ctx.param_str(params, "pageId")?;
                let url = format!("{NOTION_BASE}/pages/{page_id}");
                send_json(
                    notion_req(ctx, &token, reqwest::Method::PATCH, &url),
                    &json!({ "archived": true }),
                )
                .await?
            }
            ("page", "search") => {
                let query = ctx.param_str_opt(params, "query").unwrap_or_default();
                let url = format!("{NOTION_BASE}/search");
                send_json(
                    notion_req(ctx, &token, reqwest::Method::POST, &url),
                    &json!({
                        "query": query,
                        "filter": { "value": "page", "property": "object" }
                    }),
                )
                .await?
            }

            // ─── Databases ───────────────────────────────────────────────────
            ("database", "get") => {
                let database_id = ctx.param_str(params, "databaseId")?;
                let url = format!("{NOTION_BASE}/databases/{database_id}");
                send_no_body(notion_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("database", "query") => {
                let database_id = ctx.param_str(params, "databaseId")?;
                let filter = resolve_json(ctx, params.get("filter"));
                let url = format!("{NOTION_BASE}/databases/{database_id}/query");
                let mut payload = Map::new();
                if let Some(f) = filter {
                    if !is_empty_value(&f) {
                        payload.insert("filter".into(), f);
                    }
                }
                send_json(
                    notion_req(ctx, &token, reqwest::Method::POST, &url),
                    &Value::Object(payload),
                )
                .await?
            }
            ("database", "create") => {
                let parent_id = ctx.param_str(params, "parentId")?;
                let properties =
                    resolve_json(ctx, params.get("properties")).unwrap_or_else(|| json!({}));
                let title = ctx.param_str_opt(params, "title").unwrap_or_default();
                let url = format!("{NOTION_BASE}/databases");
                let mut payload = Map::new();
                payload.insert("parent".into(), json!({ "page_id": parent_id }));
                if !title.is_empty() {
                    payload.insert(
                        "title".into(),
                        json!([{ "type": "text", "text": { "content": title } }]),
                    );
                }
                payload.insert("properties".into(), properties);
                send_json(
                    notion_req(ctx, &token, reqwest::Method::POST, &url),
                    &Value::Object(payload),
                )
                .await?
            }

            // ─── Blocks ──────────────────────────────────────────────────────
            ("block", "append") => {
                let parent_block_id = ctx.param_str(params, "parentId")?;
                let children =
                    resolve_json(ctx, params.get("children")).unwrap_or_else(|| json!([]));
                let url = format!("{NOTION_BASE}/blocks/{parent_block_id}/children");
                send_json(
                    notion_req(ctx, &token, reqwest::Method::PATCH, &url),
                    &json!({ "children": children }),
                )
                .await?
            }
            ("block", "getChildren") => {
                let block_id = ctx.param_str(params, "blockId")?;
                let url = format!("{NOTION_BASE}/blocks/{block_id}/children");
                send_no_body(notion_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("block", "update") => {
                let block_id = ctx.param_str(params, "blockId")?;
                let body = resolve_json(ctx, params.get("properties")).unwrap_or_else(|| json!({}));
                let url = format!("{NOTION_BASE}/blocks/{block_id}");
                send_json(notion_req(ctx, &token, reqwest::Method::PATCH, &url), &body).await?
            }
            ("block", "delete") => {
                let block_id = ctx.param_str(params, "blockId")?;
                let url = format!("{NOTION_BASE}/blocks/{block_id}");
                send_no_body(notion_req(ctx, &token, reqwest::Method::DELETE, &url)).await?
            }

            // ─── Users ───────────────────────────────────────────────────────
            ("user", "get") => {
                let user_id = ctx.param_str(params, "userId")?;
                let url = format!("{NOTION_BASE}/users/{user_id}");
                send_no_body(notion_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }
            ("user", "getAll") => {
                let url = format!("{NOTION_BASE}/users");
                send_no_body(notion_req(ctx, &token, reqwest::Method::GET, &url)).await?
            }

            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported {res}:{op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

fn notion_req(
    ctx: &ExecutionContext,
    token: &str,
    method: reqwest::Method,
    url: &str,
) -> RequestBuilder {
    ctx.http
        .request(method, url)
        .bearer_auth(token)
        .header("Notion-Version", NOTION_VERSION)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
}

async fn send_json(req: RequestBuilder, payload: &Value) -> NodeResult<Value> {
    let res = req.json(payload).send().await?;
    decode(res).await
}

async fn send_no_body(req: RequestBuilder) -> NodeResult<Value> {
    let res = req.send().await?;
    decode(res).await
}

async fn decode(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body: Value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
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

/// Recursively substitute string leaves of a JSON value.
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

/// Accept a JSON-shaped param that may arrive either as a real JSON value or a
/// JSON-encoded string. Returns None for empty/blank.
fn resolve_json(ctx: &ExecutionContext, raw: Option<&Value>) -> Option<Value> {
    let v = raw?.clone();
    let resolved = match v {
        Value::String(s) => {
            let s = ctx.substitute(&s);
            if s.trim().is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(&s).unwrap_or(Value::String(s))
        }
        other => substitute_value(ctx, other),
    };
    if is_empty_value(&resolved) {
        return None;
    }
    Some(resolved)
}

fn is_empty_value(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::Object(m) => m.is_empty(),
        Value::Array(a) => a.is_empty(),
        Value::String(s) => s.trim().is_empty(),
        _ => false,
    }
}
