//! RSS Feed Read node.
//!
//! Fetches an RSS/Atom feed via HTTP and emits one item per entry. The feed
//! is parsed with the [`rss`] crate (RSS 2.0 channel). Each output item
//! exposes `{ title, link, description, pubDate, author, guid }`.

use async_trait::async_trait;
use rss::Channel;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct RssFeedReadNode;

#[async_trait]
impl Node for RssFeedReadNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rssFeedRead",
            "RSS Feed Read",
            "Read RSS feeds",
            NodeCategory::Communication,
        )
        .icon("rss")
        .color("#F26522")
        .properties(vec![
            NodeProperty::new("feedUrl", "Feed URL", NodePropertyType::String)
                .placeholder("https://example.com/feed.xml")
                .required(),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(20))
                .description("Maximum number of items to emit"),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let raw_url = ctx.param_str(params, "feedUrl")?;
        let url = ctx.substitute(&raw_url);
        if url.is_empty() {
            return Err(NodeError::MissingParameter("feedUrl".into()));
        }

        let limit = ctx
            .param_f64(params, "limit")
            .map(|n| n as usize)
            .unwrap_or(20);

        let res = ctx.http.get(&url).send().await?;
        let status = res.status();
        let bytes = res.bytes().await?;
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: String::from_utf8_lossy(&bytes).into_owned(),
            });
        }

        let channel = Channel::read_from(&bytes[..]).map_err(|e| NodeError::InvalidParameter {
            name: "feedUrl".into(),
            reason: format!("failed to parse RSS feed: {e}"),
        })?;

        let mut out: Vec<Value> = Vec::new();
        for item in channel.items().iter().take(limit) {
            out.push(json!({
                "title": item.title(),
                "link": item.link(),
                "description": item.description(),
                "pubDate": item.pub_date(),
                "author": item.author(),
                "guid": item.guid().map(|g| g.value()),
            }));
        }

        Ok(NodeOutput::single(out))
    }
}
