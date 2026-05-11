//! Mattermost node — post messages and manage channels via the Mattermost
//! v4 REST API.
//!
//! Credentials: `mattermostApi` with fields `baseUrl` and `accessToken`.
//! Bearer auth; all requests are scoped under `{baseUrl}/api/v4/...`.

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

pub struct MattermostNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MattermostNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mattermost",
            "Mattermost",
            "Post messages and manage channels on a Mattermost server",
            NodeCategory::Communication,
        )
        .icon("hash")
        .color("#0058CC")
        .credentials(vec![CredentialBinding {
            name: "mattermostApi".into(),
            display_name: "Mattermost API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Post Message", "postMessage"),
                    opt("Get Channel", "getChannel"),
                    opt("List Channels", "listChannels"),
                    opt("Create Channel", "createChannel"),
                ])
                .default(json!("postMessage"))
                .required(),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .show_when("operation", &["postMessage", "getChannel"])
                .required(),
            NodeProperty::new("text", "Message", NodePropertyType::String)
                .show_when("operation", &["postMessage"])
                .required(),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String)
                .show_when("operation", &["listChannels", "createChannel"])
                .required(),
            NodeProperty::new("name", "Channel Name", NodePropertyType::String)
                .placeholder("my-channel")
                .description("URL-safe channel name (lowercase, dashes)")
                .show_when("operation", &["createChannel"])
                .required(),
            NodeProperty::new("displayName", "Display Name", NodePropertyType::String)
                .show_when("operation", &["createChannel"])
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
        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let access_token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let base = format!("{base_url}/api/v4");
        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "postMessage" => {
                let raw_channel = ctx.param_str(params, "channelId")?;
                let channel_id = ctx.substitute(&raw_channel);
                if channel_id.is_empty() {
                    return Err(NodeError::MissingParameter("channelId".into()));
                }
                let raw_text = ctx.param_str(params, "text")?;
                let message = ctx.substitute(&raw_text);

                let url = format!("{base}/posts");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&access_token)
                    .json(&json!({
                        "channel_id": channel_id,
                        "message": message,
                    }))
                    .send()
                    .await?;
                finalize(res).await
            }
            "getChannel" => {
                let raw_channel = ctx.param_str(params, "channelId")?;
                let channel_id = ctx.substitute(&raw_channel);
                if channel_id.is_empty() {
                    return Err(NodeError::MissingParameter("channelId".into()));
                }
                let encoded = urlencoding::encode(&channel_id);
                let url = format!("{base}/channels/{encoded}");
                let res = ctx.http.get(&url).bearer_auth(&access_token).send().await?;
                finalize(res).await
            }
            "listChannels" => {
                let raw_team = ctx.param_str(params, "teamId")?;
                let team_id = ctx.substitute(&raw_team);
                if team_id.is_empty() {
                    return Err(NodeError::MissingParameter("teamId".into()));
                }
                let encoded = urlencoding::encode(&team_id);
                let url = format!("{base}/users/me/teams/{encoded}/channels");
                let res = ctx.http.get(&url).bearer_auth(&access_token).send().await?;
                finalize(res).await
            }
            "createChannel" => {
                let raw_team = ctx.param_str(params, "teamId")?;
                let team_id = ctx.substitute(&raw_team);
                if team_id.is_empty() {
                    return Err(NodeError::MissingParameter("teamId".into()));
                }
                let raw_name = ctx.param_str(params, "name")?;
                let name = ctx.substitute(&raw_name);
                if name.is_empty() {
                    return Err(NodeError::MissingParameter("name".into()));
                }
                let raw_display = ctx.param_str(params, "displayName")?;
                let display_name = ctx.substitute(&raw_display);
                if display_name.is_empty() {
                    return Err(NodeError::MissingParameter("displayName".into()));
                }

                let url = format!("{base}/channels");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&access_token)
                    .json(&json!({
                        "team_id": team_id,
                        "name": name,
                        "display_name": display_name,
                        "type": "O",
                    }))
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
