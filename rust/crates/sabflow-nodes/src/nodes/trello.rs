//! Trello node.
//!
//! Implements card, board, and list operations against the Trello REST API
//! (`https://api.trello.com/1`).
//!
//! Auth: API key + token query params. Both values are read from the linked
//! credential under `data["apiKey"]` and `data["apiToken"]`.

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

const TRELLO_BASE: &str = "https://api.trello.com/1";

pub struct TrelloNode;

#[async_trait]
impl Node for TrelloNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "trello",
            "Trello",
            "Trello kanban boards",
            NodeCategory::Productivity,
        )
        .icon("trello")
        .color("#0079BF")
        .credentials(vec![CredentialBinding {
            name: "trelloApi".into(),
            display_name: "Trello API Key + Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Card".into(),
                        value: json!("card"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Board".into(),
                        value: json!("board"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "List".into(),
                        value: json!("list"),
                        description: None,
                    },
                ])
                .default(json!("card"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Create".into(),
                        value: json!("create"),
                        description: Some("Create a new resource".into()),
                    },
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Fetch a resource by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Update a resource".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a card".into()),
                    },
                    NodePropertyOption {
                        name: "Move".into(),
                        value: json!("move"),
                        description: Some("Move a card to another list".into()),
                    },
                    NodePropertyOption {
                        name: "List".into(),
                        value: json!("list"),
                        description: Some("List boards belonging to the user".into()),
                    },
                    NodePropertyOption {
                        name: "Get Lists".into(),
                        value: json!("getLists"),
                        description: Some("Get the lists on a board".into()),
                    },
                    NodePropertyOption {
                        name: "Archive".into(),
                        value: json!("archive"),
                        description: Some("Archive (close) a list".into()),
                    },
                ])
                .default(json!("create"))
                .required(),
            // Card properties
            NodeProperty::new("cardId", "Card ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete", "move"])
                .description("ID of the Trello card"),
            NodeProperty::new("idList", "List ID", NodePropertyType::String)
                .show_when("operation", &["create", "move"])
                .description("ID of the destination list"),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Name of the card / board / list"),
            NodeProperty::new("desc", "Description", NodePropertyType::String)
                .show_when("operation", &["create", "update"])
                .description("Description / body text"),
            // Board / list properties
            NodeProperty::new("boardId", "Board ID", NodePropertyType::String)
                .show_when("operation", &["get", "getLists", "create"])
                .description("Board ID — used for board ops and required when creating a list"),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .show_when("operation", &["get", "archive"])
                .description("List ID for list-level operations"),
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
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        let auth = [("key", api_key.as_str()), ("token", api_token.as_str())];

        match (resource.as_str(), operation.as_str()) {
            // ----- CARD -----
            ("card", "create") => {
                let id_list = sub(ctx, params, "idList")?;
                let name = sub(ctx, params, "name")?;
                let desc = sub_opt(ctx, params, "desc").unwrap_or_default();
                let url = format!("{TRELLO_BASE}/cards");
                let mut query: Vec<(&str, String)> = vec![
                    ("key", api_key.clone()),
                    ("token", api_token.clone()),
                    ("idList", id_list),
                    ("name", name),
                ];
                if !desc.is_empty() {
                    query.push(("desc", desc));
                }
                let res = ctx.http.post(&url).query(&query).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("card", "get") => {
                let card_id = sub(ctx, params, "cardId")?;
                let url = format!("{TRELLO_BASE}/cards/{}", encode_path(&card_id));
                let res = ctx.http.get(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("card", "update") => {
                let card_id = sub(ctx, params, "cardId")?;
                let url = format!("{TRELLO_BASE}/cards/{}", encode_path(&card_id));
                let mut query: Vec<(&str, String)> = vec![
                    ("key", api_key.clone()),
                    ("token", api_token.clone()),
                ];
                if let Some(name) = sub_opt(ctx, params, "name") {
                    if !name.is_empty() {
                        query.push(("name", name));
                    }
                }
                if let Some(desc) = sub_opt(ctx, params, "desc") {
                    if !desc.is_empty() {
                        query.push(("desc", desc));
                    }
                }
                let res = ctx.http.put(&url).query(&query).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("card", "delete") => {
                let card_id = sub(ctx, params, "cardId")?;
                let url = format!("{TRELLO_BASE}/cards/{}", encode_path(&card_id));
                let res = ctx.http.delete(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("card", "move") => {
                let card_id = sub(ctx, params, "cardId")?;
                let id_list = sub(ctx, params, "idList")?;
                let url = format!("{TRELLO_BASE}/cards/{}", encode_path(&card_id));
                let query: Vec<(&str, String)> = vec![
                    ("key", api_key.clone()),
                    ("token", api_token.clone()),
                    ("idList", id_list),
                ];
                let res = ctx.http.put(&url).query(&query).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ----- BOARD -----
            ("board", "get") => {
                let board_id = sub(ctx, params, "boardId")?;
                let url = format!("{TRELLO_BASE}/boards/{}", encode_path(&board_id));
                let res = ctx.http.get(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("board", "list") => {
                let url = format!("{TRELLO_BASE}/members/me/boards");
                let res = ctx.http.get(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("board", "create") => {
                let name = sub(ctx, params, "name")?;
                let url = format!("{TRELLO_BASE}/boards");
                let query: Vec<(&str, String)> = vec![
                    ("key", api_key.clone()),
                    ("token", api_token.clone()),
                    ("name", name),
                ];
                let res = ctx.http.post(&url).query(&query).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("board", "getLists") => {
                let board_id = sub(ctx, params, "boardId")?;
                let url = format!("{TRELLO_BASE}/boards/{}/lists", encode_path(&board_id));
                let res = ctx.http.get(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            // ----- LIST -----
            ("list", "create") => {
                let board_id = sub(ctx, params, "boardId")?;
                let name = sub(ctx, params, "name")?;
                let url = format!("{TRELLO_BASE}/lists");
                let query: Vec<(&str, String)> = vec![
                    ("key", api_key.clone()),
                    ("token", api_token.clone()),
                    ("idBoard", board_id),
                    ("name", name),
                ];
                let res = ctx.http.post(&url).query(&query).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("list", "get") => {
                let list_id = sub(ctx, params, "listId")?;
                let url = format!("{TRELLO_BASE}/lists/{}", encode_path(&list_id));
                let res = ctx.http.get(&url).query(&auth).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            ("list", "archive") => {
                let list_id = sub(ctx, params, "listId")?;
                let url = format!("{TRELLO_BASE}/lists/{}/closed", encode_path(&list_id));
                let res = ctx
                    .http
                    .put(&url)
                    .query(&auth)
                    .json(&json!({ "value": true }))
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }

            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported combination: resource={r} operation={o}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

fn sub_opt(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<String> {
    ctx.param_str_opt(params, key).map(|raw| ctx.substitute(&raw))
}

fn encode_path(segment: &str) -> String {
    urlencoding::encode(segment).into_owned()
}

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
