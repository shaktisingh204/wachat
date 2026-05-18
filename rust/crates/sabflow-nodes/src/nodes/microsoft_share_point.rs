//! Microsoft SharePoint node — sites, lists, list items via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `microsoftOAuth2Api` credential (Bearer accessToken).
//!
//! Resources / operations implemented:
//!   - site.get          GET  `/sites/{site-id}`
//!   - site.search       GET  `/sites?search={q}`
//!   - list.get          GET  `/sites/{site-id}/lists/{list-id}`
//!   - list.list         GET  `/sites/{site-id}/lists`
//!   - listItem.get      GET  `/sites/{site-id}/lists/{list-id}/items/{id}`
//!   - listItem.list     GET  `/sites/{site-id}/lists/{list-id}/items?expand=fields`
//!   - listItem.create   POST `/sites/{site-id}/lists/{list-id}/items`
//!   - listItem.delete   DELETE `/sites/{site-id}/lists/{list-id}/items/{id}`

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
    nodes::microsoft_outlook::{emit, emit_or_ack, ms_bearer_token, urlencode_path},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

pub struct MicrosoftSharePointNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftSharePointNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftSharePoint",
            "Microsoft SharePoint",
            "Read and write SharePoint lists and list items",
            NodeCategory::Productivity,
        )
        .icon("layout-list")
        .color("#038387")
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
                    opt("Site", "site"),
                    opt("List", "list"),
                    opt("List Item", "listItem"),
                ])
                .default(json!("listItem"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Search", "search"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("siteId", "Site ID", NodePropertyType::String).show_when(
                "resource",
                &["site", "list", "listItem"],
            ),
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .show_when("resource", &["list", "listItem"]),
            NodeProperty::new("itemId", "Item ID", NodePropertyType::String)
                .show_when("resource", &["listItem"]),
            NodeProperty::new("searchQuery", "Search Query", NodePropertyType::String)
                .show_when("operation", &["search"]),
            NodeProperty::new("fields", "Fields (JSON object)", NodePropertyType::Json)
                .show_when("operation", &["create"])
                .description("e.g. {\"Title\":\"Hello\"}"),
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

        match (resource.as_str(), operation.as_str()) {
            ("site", "get") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let url = format!("{GRAPH_BASE}/sites/{}", urlencode_path(&site_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("site", "search") => {
                let q = ctx.param_str(params, "searchQuery")?;
                let url = format!("{GRAPH_BASE}/sites?search={}", urlencode_path(&q));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("list", "list") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let url = format!("{GRAPH_BASE}/sites/{}/lists", urlencode_path(&site_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("list", "get") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!(
                    "{GRAPH_BASE}/sites/{}/lists/{}",
                    urlencode_path(&site_id),
                    urlencode_path(&list_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("listItem", "list") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!(
                    "{GRAPH_BASE}/sites/{}/lists/{}/items?expand=fields",
                    urlencode_path(&site_id),
                    urlencode_path(&list_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("listItem", "get") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let list_id = ctx.param_str(params, "listId")?;
                let item_id = ctx.param_str(params, "itemId")?;
                let url = format!(
                    "{GRAPH_BASE}/sites/{}/lists/{}/items/{}?expand=fields",
                    urlencode_path(&site_id),
                    urlencode_path(&list_id),
                    urlencode_path(&item_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("listItem", "create") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let list_id = ctx.param_str(params, "listId")?;
                let fields = parse_json_param(params, "fields")?;
                let url = format!(
                    "{GRAPH_BASE}/sites/{}/lists/{}/items",
                    urlencode_path(&site_id),
                    urlencode_path(&list_id),
                );
                let payload = json!({ "fields": fields });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("listItem", "delete") => {
                let site_id = ctx.param_str(params, "siteId")?;
                let list_id = ctx.param_str(params, "listId")?;
                let item_id = ctx.param_str(params, "itemId")?;
                let url = format!(
                    "{GRAPH_BASE}/sites/{}/lists/{}/items/{}",
                    urlencode_path(&site_id),
                    urlencode_path(&list_id),
                    urlencode_path(&item_id),
                );
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                emit_or_ack(res, json!({ "deleted": true, "id": item_id })).await
            }
            (r, o) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported resource/operation combination: {r}/{o}"),
            }),
        }
    }
}

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
