//! Microsoft Teams node — channels, messages, teams via Microsoft Graph v1.0.
//!
//! Endpoint base: <https://graph.microsoft.com/v1.0>
//! Auth: `microsoftOAuth2Api` credential (Bearer accessToken).
//!
//! Resources / operations implemented:
//!   - team.list           GET  `/me/joinedTeams`
//!   - team.get            GET  `/teams/{team-id}`
//!   - channel.list        GET  `/teams/{team-id}/channels`
//!   - channel.create      POST `/teams/{team-id}/channels`
//!   - channelMessage.send POST `/teams/{team-id}/channels/{channel-id}/messages`
//!   - channelMessage.list GET  `/teams/{team-id}/channels/{channel-id}/messages`
//!   - chatMessage.send    POST `/chats/{chat-id}/messages`

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

pub struct MicrosoftTeamsNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MicrosoftTeamsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "microsoftTeams",
            "Microsoft Teams",
            "Post messages and manage channels in Microsoft Teams",
            NodeCategory::Communication,
        )
        .icon("users")
        .color("#4B53BC")
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
                    opt("Team", "team"),
                    opt("Channel", "channel"),
                    opt("Channel Message", "channelMessage"),
                    opt("Chat Message", "chatMessage"),
                ])
                .default(json!("channelMessage"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send", "send"),
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                ])
                .default(json!("send"))
                .required(),
            NodeProperty::new("teamId", "Team ID", NodePropertyType::String).show_when(
                "resource",
                &["team", "channel", "channelMessage"],
            ),
            NodeProperty::new("channelId", "Channel ID", NodePropertyType::String)
                .show_when("resource", &["channelMessage"]),
            NodeProperty::new("chatId", "Chat ID", NodePropertyType::String)
                .show_when("resource", &["chatMessage"]),
            NodeProperty::new("channelName", "Channel Name", NodePropertyType::String)
                .show_when("resource", &["channel"]),
            NodeProperty::new(
                "channelDescription",
                "Channel Description",
                NodePropertyType::String,
            )
            .show_when("resource", &["channel"]),
            NodeProperty::new("messageContent", "Message", NodePropertyType::String)
                .show_when("resource", &["channelMessage", "chatMessage"]),
            NodeProperty::new("contentType", "Content Type", NodePropertyType::Options)
                .options(vec![opt("HTML", "html"), opt("Text", "text")])
                .default(json!("html"))
                .show_when("resource", &["channelMessage", "chatMessage"]),
            NodeProperty::new("top", "Max Results", NodePropertyType::Number)
                .default(json!(50))
                .show_when("operation", &["list"]),
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
            ("team", "list") => {
                let url = format!("{GRAPH_BASE}/me/joinedTeams");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("team", "get") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let url = format!("{GRAPH_BASE}/teams/{}", urlencode_path(&team_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("channel", "list") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let url = format!("{GRAPH_BASE}/teams/{}/channels", urlencode_path(&team_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("channel", "create") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let name = ctx.param_str(params, "channelName")?;
                let description = ctx
                    .param_str_opt(params, "channelDescription")
                    .unwrap_or_default();
                let url = format!("{GRAPH_BASE}/teams/{}/channels", urlencode_path(&team_id));
                let payload = json!({
                    "displayName": name,
                    "description": description,
                    "membershipType": "standard",
                });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("channelMessage", "send") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let channel_id = ctx.param_str(params, "channelId")?;
                let content = ctx.param_str(params, "messageContent")?;
                let content_type = ctx
                    .param_str_opt(params, "contentType")
                    .unwrap_or_else(|| "html".to_string());
                let url = format!(
                    "{GRAPH_BASE}/teams/{}/channels/{}/messages",
                    urlencode_path(&team_id),
                    urlencode_path(&channel_id),
                );
                let payload = json!({
                    "body": { "contentType": content_type, "content": content },
                });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&payload)
                    .send()
                    .await?;
                emit(res).await
            }
            ("channelMessage", "list") => {
                let team_id = ctx.param_str(params, "teamId")?;
                let channel_id = ctx.param_str(params, "channelId")?;
                let top = ctx.param_f64(params, "top").unwrap_or(50.0) as u64;
                let url = format!(
                    "{GRAPH_BASE}/teams/{}/channels/{}/messages?$top={top}",
                    urlencode_path(&team_id),
                    urlencode_path(&channel_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("chatMessage", "send") => {
                let chat_id = ctx.param_str(params, "chatId")?;
                let content = ctx.param_str(params, "messageContent")?;
                let content_type = ctx
                    .param_str_opt(params, "contentType")
                    .unwrap_or_else(|| "html".to_string());
                let url = format!("{GRAPH_BASE}/chats/{}/messages", urlencode_path(&chat_id));
                let payload = json!({
                    "body": { "contentType": content_type, "content": content },
                });
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
