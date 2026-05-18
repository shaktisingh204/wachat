//! Google Cloud Pub/Sub node.
//!
//! Implements the Pub/Sub REST API (v1) for the everyday producer/consumer
//! shape used by SabFlow flows:
//!   - topic list / create / delete
//!   - publish messages to a topic
//!   - subscription create / list / delete
//!   - pull (synchronous) and acknowledge messages
//!
//! Authentication: pre-refreshed OAuth2 bearer token at
//! `cred.data["accessToken"]` with the
//! `https://www.googleapis.com/auth/pubsub` scope.

use async_trait::async_trait;
use base64::Engine as _;
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

pub struct GoogleCloudPubSubNode;

const BASE_URL: &str = "https://pubsub.googleapis.com/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleCloudPubSubNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleCloudPubSub",
            "Google Cloud Pub/Sub",
            "Publish and consume messages on Google Cloud Pub/Sub",
            NodeCategory::Communication,
        )
        .icon("radio")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleCloudPubSubOAuth2".into(),
            display_name: "Google Cloud Pub/Sub OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("my-gcp-project")
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Topic", "topic"),
                    opt("Subscription", "subscription"),
                ])
                .default(json!("topic"))
                .required(),
            // ── Topic operations ───────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                    opt("Publish", "publish"),
                ])
                .default(json!("publish"))
                .show_when("resource", &["topic"])
                .required(),
            NodeProperty::new("topicId", "Topic ID", NodePropertyType::String)
                .placeholder("my-topic")
                .show_when("operation", &["create", "delete", "publish"]),
            NodeProperty::new("messageData", "Message Data", NodePropertyType::String)
                .placeholder("hello world")
                .description("Raw message body — sent as base64 per the Pub/Sub spec.")
                .show_when("operation", &["publish"])
                .required(),
            NodeProperty::new("attributes", "Attributes", NodePropertyType::Json)
                .description("Optional `{ key: value }` map sent as message attributes.")
                .show_when("operation", &["publish"]),
            // ── Subscription operations ────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                    opt("Pull", "pull"),
                    opt("Acknowledge", "ack"),
                ])
                .default(json!("pull"))
                .show_when("resource", &["subscription"])
                .required(),
            NodeProperty::new("subscriptionId", "Subscription ID", NodePropertyType::String)
                .show_when("operation", &["create", "delete", "pull", "ack"]),
            NodeProperty::new("topicForSub", "Topic ID (for create)", NodePropertyType::String)
                .show_when("operation", &["create"])
                .description("Topic this new subscription should attach to."),
            NodeProperty::new("maxMessages", "Max Messages", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["pull"]),
            NodeProperty::new("ackIds", "Ack IDs", NodePropertyType::Json)
                .description("Array of ackIds returned by a previous pull.")
                .show_when("operation", &["ack"]),
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

        let project_id = ctx.param_str(params, "projectId")?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ── Topics ─────────────────────────────────────────────────────
            ("topic", "list") => {
                let url = format!(
                    "{BASE_URL}/projects/{}/topics",
                    urlencoding::encode(&project_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("topic", "create") => {
                let topic = ctx.param_str(params, "topicId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/topics/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&topic)
                );
                put_json(ctx, &token, &url, json!({})).await
            }
            ("topic", "delete") => {
                let topic = ctx.param_str(params, "topicId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/topics/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&topic)
                );
                delete_request(ctx, &token, &url).await
            }
            ("topic", "publish") => {
                let topic = ctx.param_str(params, "topicId")?;
                let data = ctx.param_str(params, "messageData")?;
                let attrs = parse_json_param(ctx, params, "attributes")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let encoded = base64::engine::general_purpose::STANDARD.encode(data.as_bytes());
                let mut msg = Map::new();
                msg.insert("data".into(), Value::String(encoded));
                if let Value::Object(map) = &attrs {
                    if !map.is_empty() {
                        msg.insert("attributes".into(), Value::Object(map.clone()));
                    }
                }
                let payload = json!({ "messages": [ Value::Object(msg) ] });
                let url = format!(
                    "{BASE_URL}/projects/{}/topics/{}:publish",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&topic)
                );
                post_json(ctx, &token, &url, payload).await
            }
            // ── Subscriptions ──────────────────────────────────────────────
            ("subscription", "list") => {
                let url = format!(
                    "{BASE_URL}/projects/{}/subscriptions",
                    urlencoding::encode(&project_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("subscription", "create") => {
                let sub = ctx.param_str(params, "subscriptionId")?;
                let topic = ctx.param_str(params, "topicForSub")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/subscriptions/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&sub)
                );
                let payload = json!({
                    "topic": format!("projects/{project_id}/topics/{topic}"),
                });
                put_json(ctx, &token, &url, payload).await
            }
            ("subscription", "delete") => {
                let sub = ctx.param_str(params, "subscriptionId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/subscriptions/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&sub)
                );
                delete_request(ctx, &token, &url).await
            }
            ("subscription", "pull") => {
                let sub = ctx.param_str(params, "subscriptionId")?;
                let max = ctx
                    .param_f64(params, "maxMessages")
                    .map(|n| n as u64)
                    .unwrap_or(10);
                let url = format!(
                    "{BASE_URL}/projects/{}/subscriptions/{}:pull",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&sub)
                );
                let payload = json!({ "maxMessages": max, "returnImmediately": true });
                post_json(ctx, &token, &url, payload).await
            }
            ("subscription", "ack") => {
                let sub = ctx.param_str(params, "subscriptionId")?;
                let ack_ids = parse_json_param(ctx, params, "ackIds")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let url = format!(
                    "{BASE_URL}/projects/{}/subscriptions/{}:acknowledge",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&sub)
                );
                let payload = json!({ "ackIds": ack_ids });
                post_json(ctx, &token, &url, payload).await
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported Pub/Sub operation: {res}/{op}"),
            }),
        }
    }
}

async fn get_json(ctx: &ExecutionContext, token: &str, url: &str) -> NodeResult<NodeOutput> {
    emit(ctx.http.get(url).bearer_auth(token).send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<NodeOutput> {
    emit(
        ctx.http
            .post(url)
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await?,
    )
    .await
}

async fn put_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<NodeOutput> {
    emit(
        ctx.http
            .put(url)
            .bearer_auth(token)
            .json(&payload)
            .send()
            .await?,
    )
    .await
}

async fn delete_request(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx.http.delete(url).bearer_auth(token).send().await?;
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(NodeOutput::single(vec![json!({ "deleted": true })]))
}

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
