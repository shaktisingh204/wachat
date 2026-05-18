//! Zendesk node.
//!
//! Implements ticket, user and organization operations against the Zendesk
//! Support API v2 (https://{subdomain}.zendesk.com/api/v2). Authenticates via
//! HTTP Basic auth using `{email}/token` as the username and the API token as
//! the password — both supplied by the `zendeskApi` credential
//! (`subdomain`, `email`, `apiToken`).

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

pub struct ZendeskNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ZendeskNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zendesk",
            "Zendesk",
            "Zendesk Support — manage tickets, users and organizations",
            NodeCategory::Communication,
        )
        .icon("life-buoy")
        .color("#03363D")
        .credentials(vec![CredentialBinding {
            name: "zendeskApi".into(),
            display_name: "Zendesk API Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Ticket", "ticket"),
                    opt("User", "user"),
                    opt("Organization", "organization"),
                ])
                .default(json!("ticket"))
                .required(),
            // ---- ticket operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("Add Comment", "addComment"),
                ])
                .default(json!("list"))
                .show_when("resource", &["ticket"])
                .required(),
            // ---- user operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Search", "search"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["user"])
                .required(),
            // ---- organization operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["organization"])
                .required(),
            // ---- shared id
            NodeProperty::new("id", "ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("operation", &["get", "update", "delete", "addComment"])
                .required(),
            // ---- search query
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("email:user@example.com")
                .show_when("operation", &["search"])
                .required(),
            // ---- comment body
            NodeProperty::new("comment", "Comment", NodePropertyType::String)
                .show_when("operation", &["addComment"])
                .required(),
            NodeProperty::new("publicComment", "Public Comment", NodePropertyType::Boolean)
                .default(json!(true))
                .show_when("operation", &["addComment"]),
            // ---- create / update payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"subject\": \"Hello\", \"comment\": { \"body\": \"World\" } }")
                .show_when("operation", &["create", "update"])
                .description("Request body without the outer resource key (auto-added)."),
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
        let subdomain = cred
            .data
            .get("subdomain")
            .ok_or_else(|| NodeError::MissingParameter("subdomain".into()))?
            .clone();
        let email = cred
            .data
            .get("email")
            .ok_or_else(|| NodeError::MissingParameter("email".into()))?
            .clone();
        let api_token = cred
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let base = format!("https://{subdomain}.zendesk.com/api/v2");
        let auth_user = format!("{email}/token");

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "ticket".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // -------- tickets
            ("ticket", "list") => {
                get_json(ctx, &base, &auth_user, &api_token, "/tickets.json", &[]).await?
            }
            ("ticket", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/tickets/{id}.json");
                get_json(ctx, &base, &auth_user, &api_token, &path, &[]).await?
            }
            ("ticket", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "ticket": payload });
                post_json(ctx, &base, &auth_user, &api_token, "/tickets.json", wrapped).await?
            }
            ("ticket", "update") => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "ticket": payload });
                let path = format!("/tickets/{id}.json");
                put_json(ctx, &base, &auth_user, &api_token, &path, wrapped).await?
            }
            ("ticket", "delete") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/tickets/{id}.json");
                delete_json(ctx, &base, &auth_user, &api_token, &path).await?
            }
            ("ticket", "addComment") => {
                let id = ctx.param_str(params, "id")?;
                let comment_body = ctx.param_str(params, "comment")?;
                let public = ctx.param_bool(params, "publicComment", true);
                let wrapped = json!({
                    "ticket": {
                        "comment": { "body": comment_body, "public": public }
                    }
                });
                let path = format!("/tickets/{id}.json");
                put_json(ctx, &base, &auth_user, &api_token, &path, wrapped).await?
            }
            // -------- users
            ("user", "list") => {
                get_json(ctx, &base, &auth_user, &api_token, "/users.json", &[]).await?
            }
            ("user", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/users/{id}.json");
                get_json(ctx, &base, &auth_user, &api_token, &path, &[]).await?
            }
            ("user", "search") => {
                let q = ctx.param_str(params, "query")?;
                get_json(
                    ctx,
                    &base,
                    &auth_user,
                    &api_token,
                    "/users/search.json",
                    &[("query".into(), q)],
                )
                .await?
            }
            ("user", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "user": payload });
                post_json(ctx, &base, &auth_user, &api_token, "/users.json", wrapped).await?
            }
            ("user", "update") => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "user": payload });
                let path = format!("/users/{id}.json");
                put_json(ctx, &base, &auth_user, &api_token, &path, wrapped).await?
            }
            ("user", "delete") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/users/{id}.json");
                delete_json(ctx, &base, &auth_user, &api_token, &path).await?
            }
            // -------- organizations
            ("organization", "list") => {
                get_json(
                    ctx,
                    &base,
                    &auth_user,
                    &api_token,
                    "/organizations.json",
                    &[],
                )
                .await?
            }
            ("organization", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/organizations/{id}.json");
                get_json(ctx, &base, &auth_user, &api_token, &path, &[]).await?
            }
            ("organization", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "organization": payload });
                post_json(
                    ctx,
                    &base,
                    &auth_user,
                    &api_token,
                    "/organizations.json",
                    wrapped,
                )
                .await?
            }
            ("organization", "update") => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let wrapped = json!({ "organization": payload });
                let path = format!("/organizations/{id}.json");
                put_json(ctx, &base, &auth_user, &api_token, &path, wrapped).await?
            }
            ("organization", "delete") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/organizations/{id}.json");
                delete_json(ctx, &base, &auth_user, &api_token, &path).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported {res}/{op} combination"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn get_json(
    ctx: &ExecutionContext,
    base: &str,
    user: &str,
    token: &str,
    path: &str,
    query: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let mut req = ctx.http.get(&url).basic_auth(user, Some(token));
    if !query.is_empty() {
        req = req.query(query);
    }
    finalize_response(req.send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    base: &str,
    user: &str,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx
        .http
        .post(&url)
        .basic_auth(user, Some(token))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put_json(
    ctx: &ExecutionContext,
    base: &str,
    user: &str,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx
        .http
        .put(&url)
        .basic_auth(user, Some(token))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn delete_json(
    ctx: &ExecutionContext,
    base: &str,
    user: &str,
    token: &str,
    path: &str,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx.http.delete(&url).basic_auth(user, Some(token)).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    if body.is_null() {
        Ok(json!({ "deleted": true }))
    } else {
        Ok(body)
    }
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
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
