//! Matrix node — send messages and manage rooms on a Matrix homeserver via
//! the client-server API (v3).
//!
//! Credentials: `matrixApi` with fields `homeserverUrl` and `accessToken`.
//! Bearer auth is used; all requests are scoped under
//! `{homeserverUrl}/_matrix/client/v3/...`.

use async_trait::async_trait;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct MatrixNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MatrixNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "matrix",
            "Matrix",
            "Send messages and manage rooms on a Matrix homeserver",
            NodeCategory::Communication,
        )
        .icon("message-square")
        .color("#0DBD8B")
        .credentials(vec![CredentialBinding {
            name: "matrixApi".into(),
            display_name: "Matrix API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send Message", "sendMessage"),
                    opt("Send Notice", "sendNotice"),
                    opt("Get Joined Rooms", "getJoinedRooms"),
                    opt("Join Room", "joinRoom"),
                    opt("Leave Room", "leaveRoom"),
                ])
                .default(json!("sendMessage"))
                .required(),
            NodeProperty::new("roomId", "Room ID", NodePropertyType::String)
                .placeholder("!abcdef:matrix.org")
                .show_when(
                    "operation",
                    &["sendMessage", "sendNotice", "leaveRoom"],
                )
                .required(),
            NodeProperty::new("roomIdOrAlias", "Room ID or Alias", NodePropertyType::String)
                .placeholder("#room:matrix.org")
                .show_when("operation", &["joinRoom"])
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .show_when("operation", &["sendMessage", "sendNotice"])
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
        let homeserver_url = cred
            .data
            .get("homeserverUrl")
            .ok_or_else(|| NodeError::MissingParameter("homeserverUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let access_token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let base = format!("{homeserver_url}/_matrix/client/v3");
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "sendMessage" => send_message(ctx, params, &base, &access_token, "m.text").await,
            "sendNotice" => send_message(ctx, params, &base, &access_token, "m.notice").await,
            "getJoinedRooms" => {
                let url = format!("{base}/joined_rooms");
                let res = ctx.http.get(&url).bearer_auth(&access_token).send().await?;
                finalize(res).await
            }
            "joinRoom" => {
                let raw = ctx.param_str(params, "roomIdOrAlias")?;
                let room = ctx.substitute(&raw);
                if room.is_empty() {
                    return Err(NodeError::MissingParameter("roomIdOrAlias".into()));
                }
                let encoded = urlencoding::encode(&room);
                let url = format!("{base}/rooms/{encoded}/join");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&access_token)
                    .json(&json!({}))
                    .send()
                    .await?;
                finalize(res).await
            }
            "leaveRoom" => {
                let raw = ctx.param_str(params, "roomId")?;
                let room_id = ctx.substitute(&raw);
                if room_id.is_empty() {
                    return Err(NodeError::MissingParameter("roomId".into()));
                }
                let encoded = urlencoding::encode(&room_id);
                let url = format!("{base}/rooms/{encoded}/leave");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&access_token)
                    .json(&json!({}))
                    .send()
                    .await?;
                finalize(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

async fn send_message(
    ctx: &ExecutionContext,
    params: &Value,
    base: &str,
    access_token: &str,
    msgtype: &str,
) -> NodeResult<NodeOutput> {
    let raw_room = ctx.param_str(params, "roomId")?;
    let room_id = ctx.substitute(&raw_room);
    if room_id.is_empty() {
        return Err(NodeError::MissingParameter("roomId".into()));
    }

    let raw_text = ctx.param_str(params, "text")?;
    let text = ctx.substitute(&raw_text);

    let txn_id = Uuid::new_v4().to_string();
    let encoded_room = urlencoding::encode(&room_id);
    let url = format!("{base}/rooms/{encoded_room}/send/m.room.message/{txn_id}");

    let body = json!({
        "msgtype": msgtype,
        "body": text,
    });

    let res = ctx
        .http
        .put(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await?;
    finalize(res).await
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body_value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        let body_str = match &body_value {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_str,
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}
