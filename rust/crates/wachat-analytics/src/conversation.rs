//! Conversation analytics — Meta Graph `conversation_analytics` field passthrough.
//!
//! TS source: `getConversationAnalytics` in `src/app/actions/whatsapp-analytics.actions.ts`.
//! Builds a `conversation_analytics.start(...).end(...).granularity(...)...`
//! field-spec query string and `GET`s `/{wabaId}?fields=...`.

use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wachat_meta_client::MetaClient;
use wachat_types::Project;

/// Granularity for conversation analytics buckets — mirrors the TS union.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Granularity {
    HalfHour,
    Daily,
    Monthly,
}

impl Granularity {
    fn as_meta_str(self) -> &'static str {
        match self {
            Self::HalfHour => "HALF_HOUR",
            Self::Daily => "DAILY",
            Self::Monthly => "MONTHLY",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationAnalyticsBody {
    pub start_timestamp: i64,
    pub end_timestamp: i64,
    #[serde(default)]
    pub granularity: Option<Granularity>,
    #[serde(default)]
    pub phone_numbers: Option<Vec<String>>,
    #[serde(default)]
    pub countries: Option<Vec<String>>,
    #[serde(default)]
    pub conversation_categories: Option<Vec<String>>,
    #[serde(default)]
    pub conversation_types: Option<Vec<String>>,
    #[serde(default)]
    pub dimensions: Option<Vec<String>>,
}

/// Wrapper mirroring the TS `ConversationAnalyticsResult.data` shape — the
/// caller always sees a `dataPoints` array. Each point is left as a free-form
/// `Value` because Meta returns several flavors depending on `dimensions`.
#[derive(Debug, Clone, Serialize)]
pub struct ConversationAnalyticsResult {
    pub data_points: Vec<Value>,
}

fn build_query(body: &ConversationAnalyticsBody) -> String {
    let g = body.granularity.unwrap_or(Granularity::Daily).as_meta_str();
    let mut q = format!(
        "conversation_analytics.start({}).end({}).granularity({})",
        body.start_timestamp, body.end_timestamp, g
    );
    if let Some(v) = body.phone_numbers.as_ref().filter(|v| !v.is_empty()) {
        q.push_str(&format!(".phone_numbers([{}])", quote_join(v)));
    }
    if let Some(v) = body.countries.as_ref().filter(|v| !v.is_empty()) {
        q.push_str(&format!(".country_codes([{}])", quote_join(v)));
    }
    if let Some(v) = body
        .conversation_categories
        .as_ref()
        .filter(|v| !v.is_empty())
    {
        q.push_str(&format!(".conversation_categories([{}])", quote_join(v)));
    }
    if let Some(v) = body.conversation_types.as_ref().filter(|v| !v.is_empty()) {
        q.push_str(&format!(".conversation_types([{}])", quote_join(v)));
    }
    if let Some(v) = body.dimensions.as_ref().filter(|v| !v.is_empty()) {
        q.push_str(&format!(".dimensions([{}])", quote_join(v)));
    }
    q
}

fn quote_join(items: &[String]) -> String {
    items
        .iter()
        .map(|s| format!("\"{s}\""))
        .collect::<Vec<_>>()
        .join(",")
}

pub async fn fetch(
    meta: &MetaClient,
    project: &Project,
    body: ConversationAnalyticsBody,
) -> Result<ConversationAnalyticsResult> {
    let waba_id = project
        .waba_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing wabaId".to_owned()))?;
    let token = project
        .access_token
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;

    let query = build_query(&body);
    // Meta accepts the field spec as `?fields=conversation_analytics...`.
    // `MetaClient::get_json` builds `{base}/{version}/{path}` and adds the
    // bearer header, so we tack the query onto `path`.
    let path = format!("{waba_id}?fields={}", url_encode(&query));
    let resp: Value = meta.get_json(&path, token).await?;

    // Meta returns either `conversation_analytics` or (legacy) `analytics`.
    let node = resp
        .get("conversation_analytics")
        .or_else(|| resp.get("analytics"))
        .cloned()
        .unwrap_or(Value::Null);
    let data_points = node
        .get("data")
        .and_then(|d| d.get("data_points"))
        .or_else(|| node.get("data_points"))
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();
    Ok(ConversationAnalyticsResult { data_points })
}

/// Minimal percent-encoder for query values — covers the characters Meta's
/// field-spec uses (`[`, `]`, `(`, `)`, `,`, `"`, space). Keeping this local
/// avoids pulling another dependency just for one URL.
pub(crate) fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{b:02X}"));
            }
        }
    }
    out
}
