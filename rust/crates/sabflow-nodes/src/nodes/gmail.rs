//! Gmail node.
//!
//! Implements the Gmail v1 REST API for messages, drafts, labels, and
//! threads scoped to the authenticated user (`users/me`).
//!
//! Authentication: we expect the credential to be a pre-refreshed OAuth2
//! access token stored at `cred.data["accessToken"]`.
//!
//! TODO(sabflow): wire up full OAuth2 refresh-token handling — currently the
//! credential is assumed to already hold a valid, non-expired access token.
//! Future work: detect 401 from Google, swap refresh token for a new access
//! token via the OAuth2 token endpoint, persist the rotated token, and retry.

use async_trait::async_trait;
use base64::Engine;
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

pub struct GmailNode;

const BASE_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me";

#[async_trait]
impl Node for GmailNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gmail",
            "Gmail",
            "Send and read Gmail",
            NodeCategory::Communication,
        )
        .icon("mail")
        .color("#EA4335")
        .credentials(vec![CredentialBinding {
            name: "gmailOAuth2".into(),
            display_name: "Gmail OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Message".into(),
                        value: json!("message"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Draft".into(),
                        value: json!("draft"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Label".into(),
                        value: json!("label"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Thread".into(),
                        value: json!("thread"),
                        description: None,
                    },
                ])
                .default(json!("message"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Send".into(),
                        value: json!("send"),
                        description: Some("Send a message".into()),
                    },
                    NodePropertyOption {
                        name: "Get".into(),
                        value: json!("get"),
                        description: Some("Get a resource by id".into()),
                    },
                    NodePropertyOption {
                        name: "List".into(),
                        value: json!("list"),
                        description: Some("List resources".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete a resource".into()),
                    },
                    NodePropertyOption {
                        name: "Reply".into(),
                        value: json!("reply"),
                        description: Some("Reply to a message".into()),
                    },
                    NodePropertyOption {
                        name: "Create".into(),
                        value: json!("create"),
                        description: Some("Create a draft or label".into()),
                    },
                ])
                .default(json!("send"))
                .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("recipient@example.com")
                .show_when("operation", &["send", "reply"]),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("operation", &["send", "reply", "create"]),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .show_when("operation", &["send", "reply", "create"]),
            NodeProperty::new("messageId", "Message ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete", "reply"]),
            NodeProperty::new("threadId", "Thread ID", NodePropertyType::String)
                .show_when("operation", &["get", "list"]),
            NodeProperty::new("draftId", "Draft ID", NodePropertyType::String)
                .show_when("operation", &["get", "delete", "send"]),
            NodeProperty::new("labelName", "Label Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("labelId", "Label ID", NodePropertyType::String)
                .show_when("operation", &["delete"]),
            NodeProperty::new("maxResults", "Max Results", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["list"]),
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

        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ---------- message ----------
            ("message", "send") => {
                let to = ctx.param_str(params, "to")?;
                let subject = ctx.param_str(params, "subject")?;
                let body = ctx.param_str(params, "body")?;
                let raw = encode_rfc822(&to, &subject, &body);
                let url = format!("{}/messages/send", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "raw": raw }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("message", "get") => {
                let message_id = ctx.param_str(params, "messageId")?;
                let url = format!("{}/messages/{}", BASE_URL, urlencode(&message_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("message", "list") => {
                let max_results = ctx.param_f64(params, "maxResults").unwrap_or(100.0) as u64;
                let url = format!("{}/messages?maxResults={}", BASE_URL, max_results);
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("message", "delete") => {
                let message_id = ctx.param_str(params, "messageId")?;
                let url = format!("{}/messages/{}", BASE_URL, urlencode(&message_id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![
                    json!({ "deleted": true, "id": message_id }),
                ]))
            }
            ("message", "reply") => {
                let to = ctx.param_str(params, "to")?;
                let subject = ctx.param_str(params, "subject")?;
                let body = ctx.param_str(params, "body")?;
                let message_id = ctx.param_str(params, "messageId")?;
                // For replies Gmail wants a threadId on the message envelope.
                // We don't fetch the original message here; we treat the
                // provided messageId as the thread id (it's the caller's job
                // to pass a thread id when they already have one). We also
                // attach an In-Reply-To header for the conversation thread.
                let raw = encode_rfc822_reply(&to, &subject, &body, &message_id);
                let url = format!("{}/messages/send", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({
                        "raw": raw,
                        "threadId": message_id,
                    }))
                    .send()
                    .await?;
                emit(res).await
            }

            // ---------- draft ----------
            ("draft", "create") => {
                let subject = ctx.param_str(params, "subject")?;
                let body = ctx.param_str(params, "body")?;
                let to = ctx.param_str_opt(params, "to").unwrap_or_default();
                let raw = encode_rfc822(&to, &subject, &body);
                let url = format!("{}/drafts", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "message": { "raw": raw } }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("draft", "get") => {
                let draft_id = ctx.param_str(params, "draftId")?;
                let url = format!("{}/drafts/{}", BASE_URL, urlencode(&draft_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("draft", "list") => {
                let url = format!("{}/drafts", BASE_URL);
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("draft", "delete") => {
                let draft_id = ctx.param_str(params, "draftId")?;
                let url = format!("{}/drafts/{}", BASE_URL, urlencode(&draft_id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![
                    json!({ "deleted": true, "id": draft_id }),
                ]))
            }
            ("draft", "send") => {
                let draft_id = ctx.param_str(params, "draftId")?;
                let url = format!("{}/drafts/send", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "id": draft_id }))
                    .send()
                    .await?;
                emit(res).await
            }

            // ---------- label ----------
            ("label", "create") => {
                let name = ctx.param_str(params, "labelName")?;
                let url = format!("{}/labels", BASE_URL);
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&json!({ "name": name }))
                    .send()
                    .await?;
                emit(res).await
            }
            ("label", "list") => {
                let url = format!("{}/labels", BASE_URL);
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("label", "delete") => {
                let label_id = ctx.param_str(params, "labelId")?;
                let url = format!("{}/labels/{}", BASE_URL, urlencode(&label_id));
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                let status = res.status();
                if !status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                Ok(NodeOutput::single(vec![
                    json!({ "deleted": true, "id": label_id }),
                ]))
            }

            // ---------- thread ----------
            ("thread", "get") => {
                let thread_id = ctx.param_str(params, "threadId")?;
                let url = format!("{}/threads/{}", BASE_URL, urlencode(&thread_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }
            ("thread", "list") => {
                let url = format!("{}/threads", BASE_URL);
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                emit(res).await
            }

            (other_resource, other_op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!(
                    "unsupported resource/operation combination: {other_resource}/{other_op}"
                ),
            }),
        }
    }
}

/// Build a base64url-encoded RFC822 message ready for the Gmail API `raw` field.
fn encode_rfc822(to: &str, subject: &str, body: &str) -> String {
    let rfc822 = format!(
        "To: {to}\r\nSubject: {subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{body}"
    );
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(rfc822.as_bytes())
}

/// Build a base64url-encoded RFC822 reply message with an `In-Reply-To` header.
fn encode_rfc822_reply(to: &str, subject: &str, body: &str, in_reply_to: &str) -> String {
    let rfc822 = format!(
        "To: {to}\r\n\
         Subject: {subject}\r\n\
         In-Reply-To: {in_reply_to}\r\n\
         References: {in_reply_to}\r\n\
         Content-Type: text/plain; charset=UTF-8\r\n\
         \r\n\
         {body}"
    );
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(rfc822.as_bytes())
}

/// Consume an HTTP response, error on non-2xx, return body as a single-item
/// NodeOutput. If the body is not JSON, wrap it in `{ "body": "<text>" }`.
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

/// Minimal percent-encoder for URL path components.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        let c = *b;
        let safe = c.is_ascii_alphanumeric() || c == b'-' || c == b'_' || c == b'.' || c == b'~';
        if safe {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}
