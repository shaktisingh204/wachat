//! Eventbrite node.
//!
//! Implements event, attendee and order operations against the Eventbrite v3
//! REST API (https://www.eventbriteapi.com/v3). Authenticates via a private
//! token (Bearer) supplied by the `eventbriteApi` credential (`privateToken`).

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

pub struct EventbriteNode;

const EVENTBRITE_API_BASE: &str = "https://www.eventbriteapi.com/v3";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for EventbriteNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "eventbrite",
            "Eventbrite",
            "Eventbrite event ticketing — manage events, attendees and orders",
            NodeCategory::Productivity,
        )
        .icon("ticket")
        .color("#F05537")
        .credentials(vec![CredentialBinding {
            name: "eventbriteApi".into(),
            display_name: "Eventbrite Private Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Event", "event"),
                    opt("Attendee", "attendee"),
                    opt("Order", "order"),
                    opt("Organization", "organization"),
                    opt("User", "user"),
                ])
                .default(json!("event"))
                .required(),
            // ---- event operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("List by Organization", "listByOrganization"),
                    opt("Create", "create"),
                    opt("Publish", "publish"),
                    opt("Unpublish", "unpublish"),
                ])
                .default(json!("get"))
                .show_when("resource", &["event"])
                .required(),
            // ---- attendee operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List by Event", "listByEvent"),
                    opt("Get", "get"),
                ])
                .default(json!("listByEvent"))
                .show_when("resource", &["attendee"])
                .required(),
            // ---- order operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List by Event", "listByEvent"),
                    opt("Get", "get"),
                ])
                .default(json!("listByEvent"))
                .show_when("resource", &["order"])
                .required(),
            // ---- organization operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List Owned", "listOwned")])
                .default(json!("listOwned"))
                .show_when("resource", &["organization"])
                .required(),
            // ---- user operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Me", "me")])
                .default(json!("me"))
                .show_when("resource", &["user"])
                .required(),
            // ---- ids
            NodeProperty::new("organizationId", "Organization ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["listByOrganization", "create"],
                )
                .required(),
            NodeProperty::new("eventId", "Event ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &["get", "publish", "unpublish", "listByEvent"],
                )
                .required(),
            NodeProperty::new("attendeeId", "Attendee ID", NodePropertyType::String)
                .show_when("resource", &["attendee"])
                .show_when("operation", &["get"]),
            NodeProperty::new("orderId", "Order ID", NodePropertyType::String)
                .show_when("resource", &["order"])
                .show_when("operation", &["get"]),
            // ---- create payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"event\": { \"name\": { \"html\": \"My Event\" } } }")
                .show_when("operation", &["create"])
                .description("Request body for event creation."),
            // ---- list filters
            NodeProperty::new("status", "Status", NodePropertyType::Options)
                .options(vec![
                    opt("All", "all"),
                    opt("Live", "live"),
                    opt("Draft", "draft"),
                    opt("Started", "started"),
                    opt("Ended", "ended"),
                    opt("Completed", "completed"),
                    opt("Canceled", "canceled"),
                ])
                .default(json!("all"))
                .show_when("operation", &["listByOrganization"]),
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
            .get("privateToken")
            .or_else(|| cred.data.get("accessToken"))
            .ok_or_else(|| NodeError::MissingParameter("privateToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "event".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            ("event", "get") => {
                let id = ctx.param_str(params, "eventId")?;
                let path = format!("/events/{id}/");
                get_json(ctx, &token, &path, &[]).await?
            }
            ("event", "listByOrganization") => {
                let org_id = ctx.param_str(params, "organizationId")?;
                let path = format!("/organizations/{org_id}/events/");
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(status) = ctx.param_str_opt(params, "status") {
                    if status != "all" && !status.is_empty() {
                        query.push(("status".into(), status));
                    }
                }
                get_json(ctx, &token, &path, &query).await?
            }
            ("event", "create") => {
                let org_id = ctx.param_str(params, "organizationId")?;
                let path = format!("/organizations/{org_id}/events/");
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &token, &path, payload).await?
            }
            ("event", "publish") => {
                let id = ctx.param_str(params, "eventId")?;
                let path = format!("/events/{id}/publish/");
                post_json(ctx, &token, &path, Value::Object(Map::new())).await?
            }
            ("event", "unpublish") => {
                let id = ctx.param_str(params, "eventId")?;
                let path = format!("/events/{id}/unpublish/");
                post_json(ctx, &token, &path, Value::Object(Map::new())).await?
            }
            ("attendee", "listByEvent") => {
                let event_id = ctx.param_str(params, "eventId")?;
                let path = format!("/events/{event_id}/attendees/");
                get_json(ctx, &token, &path, &[]).await?
            }
            ("attendee", "get") => {
                let event_id = ctx.param_str(params, "eventId")?;
                let attendee_id = ctx.param_str(params, "attendeeId")?;
                let path = format!("/events/{event_id}/attendees/{attendee_id}/");
                get_json(ctx, &token, &path, &[]).await?
            }
            ("order", "listByEvent") => {
                let event_id = ctx.param_str(params, "eventId")?;
                let path = format!("/events/{event_id}/orders/");
                get_json(ctx, &token, &path, &[]).await?
            }
            ("order", "get") => {
                let order_id = ctx.param_str(params, "orderId")?;
                let path = format!("/orders/{order_id}/");
                get_json(ctx, &token, &path, &[]).await?
            }
            ("organization", "listOwned") => {
                get_json(ctx, &token, "/users/me/organizations/", &[]).await?
            }
            ("user", "me") => get_json(ctx, &token, "/users/me/", &[]).await?,
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
    token: &str,
    path: &str,
    query: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{EVENTBRITE_API_BASE}{path}");
    let mut req = ctx.http.get(&url).bearer_auth(token);
    if !query.is_empty() {
        req = req.query(query);
    }
    finalize_response(req.send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{EVENTBRITE_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
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
