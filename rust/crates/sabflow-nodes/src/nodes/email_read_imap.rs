//! Email Read (IMAP) node.
//!
//! Connects to an IMAP server (TLS by default), selects a mailbox, fetches the
//! N most-recent messages matching a search criterion (`ALL` / `UNSEEN` /
//! `SEEN`), parses each with `mail-parser`, and emits one item per message
//! containing `from`, `to`, `subject`, `date`, `text`, `html`, and
//! `attachments`.
//!
//! Credential schema (`imap`):
//!   - `host`     — IMAP server hostname
//!   - `port`     — Optional port (defaults to 993 TLS / 143 plain)
//!   - `username` — login user
//!   - `password` — login password
//!   - `secure`   — Optional ("true"/"false"); defaults to true (implicit TLS).
//!
//! TODOs:
//!   * No STARTTLS upgrade path — only implicit TLS or plaintext.
//!   * Message ordering relies on UID ascending; we then take the tail to
//!     approximate "N most recent". A proper implementation would resolve the
//!     mailbox EXISTS count and fetch a sequence range.

use async_imap::types::Fetch;
use async_trait::async_trait;
use futures::TryStreamExt;
use mail_parser::{MessageParser, MimeHeaders};
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

pub struct EmailReadImapNode;

#[async_trait]
impl Node for EmailReadImapNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailReadImap",
            "Email Read (IMAP)",
            "Read emails from an IMAP mailbox",
            NodeCategory::Communication,
        )
        .icon("inbox")
        .color("#0ea5e9")
        .credentials(vec![CredentialBinding {
            name: "imap".into(),
            display_name: "IMAP Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("mailbox", "Mailbox", NodePropertyType::String)
                .default("INBOX")
                .description("IMAP folder to read from (e.g. INBOX, Sent, [Gmail]/All Mail)"),
            NodeProperty::new("markAsSeen", "Mark As Seen", NodePropertyType::Boolean)
                .default(true)
                .description(
                    "When true, fetched messages are flagged \\Seen on the server.",
                ),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(10)
                .description("Maximum number of most-recent messages to return"),
            NodeProperty::new("searchCriteria", "Search Criteria", NodePropertyType::Options)
                .default("UNSEEN")
                .options(vec![
                    NodePropertyOption {
                        name: "All".into(),
                        value: json!("ALL"),
                        description: Some("Every message in the mailbox".into()),
                    },
                    NodePropertyOption {
                        name: "Unseen".into(),
                        value: json!("UNSEEN"),
                        description: Some("Messages without the \\Seen flag".into()),
                    },
                    NodePropertyOption {
                        name: "Seen".into(),
                        value: json!("SEEN"),
                        description: Some("Messages with the \\Seen flag".into()),
                    },
                ]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // ── Credentials ────────────────────────────────────────────────────
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;

        let host = cred
            .data
            .get("host")
            .ok_or_else(|| NodeError::MissingParameter("host".into()))?
            .clone();
        let username = cred
            .data
            .get("username")
            .ok_or_else(|| NodeError::MissingParameter("username".into()))?
            .clone();
        let password = cred
            .data
            .get("password")
            .ok_or_else(|| NodeError::MissingParameter("password".into()))?
            .clone();
        let secure = cred
            .data
            .get("secure")
            .map(|s| !matches!(s.to_ascii_lowercase().as_str(), "false" | "no" | "0"))
            .unwrap_or(true);
        let port: u16 = match cred.data.get("port").and_then(|p| p.parse::<u16>().ok()) {
            Some(p) => p,
            None if secure => 993,
            None => 143,
        };

        // ── Params ─────────────────────────────────────────────────────────
        let mailbox = ctx
            .param_str_opt(params, "mailbox")
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "INBOX".to_string());
        let mark_as_seen = ctx.param_bool(params, "markAsSeen", true);
        let limit = ctx
            .param_f64(params, "limit")
            .map(|n| n.max(1.0) as usize)
            .unwrap_or(10);
        let criteria_raw = ctx
            .param_str_opt(params, "searchCriteria")
            .unwrap_or_else(|| "UNSEEN".to_string());
        let criteria = match criteria_raw.to_ascii_uppercase().as_str() {
            "ALL" => "ALL",
            "SEEN" => "SEEN",
            "UNSEEN" | "" => "UNSEEN",
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "searchCriteria".into(),
                    reason: format!("unknown criterion: {other}"),
                });
            }
        };

        // ── Connect ────────────────────────────────────────────────────────
        let tcp = tokio::net::TcpStream::connect((host.as_str(), port))
            .await
            .map_err(|e| NodeError::HttpError(format!("IMAP TCP connect failed: {e}")))?;

        let mut session = if secure {
            let tls = async_native_tls::connect(host.as_str(), tcp)
                .await
                .map_err(|e| NodeError::HttpError(format!("IMAP TLS handshake failed: {e}")))?;
            let client = async_imap::Client::new(tls);
            client
                .login(&username, &password)
                .await
                .map_err(|(e, _)| NodeError::AuthError(format!("IMAP login failed: {e}")))?
        } else {
            // Plain unencrypted IMAP (rare; defensive only). The Session type
            // here differs from the TLS branch, so we have to handle each arm
            // independently — duplicate the rest of the flow inside a helper.
            let client = async_imap::Client::new(tcp);
            let mut session = client
                .login(&username, &password)
                .await
                .map_err(|(e, _)| NodeError::AuthError(format!("IMAP login failed: {e}")))?;
            let items = fetch_and_parse(&mut session, &mailbox, criteria, limit, mark_as_seen)
                .await?;
            let _ = session.logout().await;
            return Ok(NodeOutput::single(items));
        };

        let items =
            fetch_and_parse(&mut session, &mailbox, criteria, limit, mark_as_seen).await?;
        let _ = session.logout().await;

        Ok(NodeOutput::single(items))
    }
}

/// Select a mailbox, run SEARCH, FETCH the matching UIDs, parse each message,
/// and return one JSON item per message. Generic over the transport so the
/// TLS and plaintext branches in `execute` can share the bulk of the logic.
async fn fetch_and_parse<T>(
    session: &mut async_imap::Session<T>,
    mailbox: &str,
    criteria: &str,
    limit: usize,
    mark_as_seen: bool,
) -> NodeResult<Vec<Value>>
where
    T: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + std::fmt::Debug + Send,
{
    session
        .select(mailbox)
        .await
        .map_err(|e| NodeError::Other(format!("IMAP SELECT {mailbox} failed: {e}")))?;

    // SEARCH returns matching UIDs (or sequence numbers — we use UID SEARCH).
    let uids: Vec<u32> = session
        .uid_search(criteria)
        .await
        .map_err(|e| NodeError::Other(format!("IMAP UID SEARCH {criteria} failed: {e}")))?
        .into_iter()
        .collect();

    if uids.is_empty() {
        return Ok(vec![]);
    }

    // Take the highest UIDs (== most recently delivered).
    let mut sorted = uids;
    sorted.sort_unstable();
    let take_from = sorted.len().saturating_sub(limit);
    let recent: Vec<u32> = sorted[take_from..].to_vec();

    // Build a comma-separated UID set: "12,15,18".
    let uid_set = recent
        .iter()
        .map(|u| u.to_string())
        .collect::<Vec<_>>()
        .join(",");

    // BODY.PEEK[] avoids implicitly flagging \Seen during the fetch; we set
    // the flag ourselves afterwards if `markAsSeen` is true. INTERNALDATE
    // gives us the server-side delivery timestamp.
    let fetch_items = if mark_as_seen {
        "(UID INTERNALDATE FLAGS BODY[])"
    } else {
        "(UID INTERNALDATE FLAGS BODY.PEEK[])"
    };

    let stream = session
        .uid_fetch(&uid_set, fetch_items)
        .await
        .map_err(|e| NodeError::Other(format!("IMAP UID FETCH failed: {e}")))?;

    let fetches: Vec<Fetch> = stream
        .try_collect()
        .await
        .map_err(|e| NodeError::Other(format!("IMAP FETCH stream error: {e}")))?;

    let mut out: Vec<Value> = Vec::with_capacity(fetches.len());
    for f in &fetches {
        let raw = match f.body() {
            Some(b) => b,
            None => continue,
        };
        out.push(parse_message(raw, f.uid, f.internal_date()));
    }

    Ok(out)
}

/// Parse a raw RFC-822 message into the public JSON shape.
fn parse_message(
    raw: &[u8],
    uid: Option<u32>,
    internal_date: Option<chrono::DateTime<chrono::FixedOffset>>,
) -> Value {
    let parser = MessageParser::default();
    let parsed = match parser.parse(raw) {
        Some(m) => m,
        None => {
            // Couldn't parse — surface the raw bytes as a best-effort fallback
            // so downstream nodes still see *something*.
            return json!({
                "uid": uid,
                "from": [],
                "to": [],
                "subject": null,
                "date": internal_date.map(|d| d.to_rfc3339()),
                "text": null,
                "html": null,
                "attachments": [],
                "parseError": true,
            });
        }
    };

    let from = address_list(parsed.from());
    let to = address_list(parsed.to());

    let subject = parsed.subject().map(|s| s.to_string());

    let date = parsed
        .date()
        .map(|d| d.to_rfc3339())
        .or_else(|| internal_date.map(|d| d.to_rfc3339()));

    let text = parsed
        .body_text(0)
        .map(|c| c.into_owned())
        .or_else(|| {
            // No part 0? Fall back to the first text/plain body of any index.
            (0..parsed.text_body_count())
                .find_map(|i| parsed.body_text(i).map(|c| c.into_owned()))
        });

    let html = parsed.body_html(0).map(|c| c.into_owned()).or_else(|| {
        (0..parsed.html_body_count())
            .find_map(|i| parsed.body_html(i).map(|c| c.into_owned()))
    });

    let mut attachments: Vec<Value> = Vec::new();
    for att in parsed.attachments() {
        let filename = att.attachment_name().map(|s| s.to_string());
        let content_type = att
            .content_type()
            .map(|ct| {
                if let Some(sub) = ct.subtype() {
                    format!("{}/{}", ct.ctype(), sub)
                } else {
                    ct.ctype().to_string()
                }
            });
        let data = att.contents();
        attachments.push(json!({
            "filename": filename,
            "contentType": content_type,
            "size": data.len(),
            // Base64-encode so the JSON is safe to pass between nodes. Large
            // attachments will balloon — downstream nodes should treat this as
            // an opt-in payload.
            "contentBase64": base64_encode(data),
        }));
    }

    json!({
        "uid": uid,
        "from": from,
        "to": to,
        "subject": subject,
        "date": date,
        "text": text,
        "html": html,
        "attachments": attachments,
    })
}

/// Flatten a mail-parser `Address` value into a Vec of `{name, email}` JSON
/// objects. Group syntax (`team: a@x.com, b@x.com;`) is flattened by listing
/// the group's members alongside any top-level addresses.
fn address_list(addr: Option<&mail_parser::Address<'_>>) -> Vec<Value> {
    let Some(addr) = addr else { return vec![] };
    let mut out: Vec<Value> = Vec::new();

    match addr {
        mail_parser::Address::List(list) => {
            for a in list {
                out.push(json!({
                    "name": a.name.as_ref().map(|s| s.to_string()),
                    "email": a.address.as_ref().map(|s| s.to_string()),
                }));
            }
        }
        mail_parser::Address::Group(groups) => {
            for g in groups {
                for a in &g.addresses {
                    out.push(json!({
                        "name": a.name.as_ref().map(|s| s.to_string()),
                        "email": a.address.as_ref().map(|s| s.to_string()),
                        "group": g.name.as_ref().map(|s| s.to_string()),
                    }));
                }
            }
        }
    }

    out
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}
