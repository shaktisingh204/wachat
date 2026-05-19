//! Inbound webhook handlers.
//!
//! Three flavours of upstream:
//!   * Mailgun — form-encoded; Mailgun pre-extracts text/html/subject.
//!   * SES via SNS — JSON envelope, base64'd raw MIME inside.
//!   * Raw RFC-822 — direct MIME stream (for SMTP relay shims).
//!
//! All three normalise into a [`ParsedMessage`] which is then threaded
//! and persisted by the shared [`persist_inbound`] helper.

use axum::{
    Form, Json,
    body::Bytes,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use base64::Engine as _;
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use mail_parser::{Address, HeaderValue, MessageParser};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::{instrument, warn};

use crate::dto::{
    IngestResponse, MailgunInboundForm, SesMessage, SnsEnvelope, TokenQuery,
};
use crate::state::EmailInboundState;

const SETTINGS_COLL: &str = "email_settings";
const THREADS_COLL: &str = "email_threads";
const MESSAGES_COLL: &str = "email_messages";

// ===========================================================================
// Common: token resolution
// ===========================================================================

/// Resolve a path-or-query token to the owning tenant's `userId`. Returns
/// `404` for missing/invalid tokens — never `401`/`403`, to avoid
/// confirming token existence to a probing attacker.
async fn resolve_tenant(mongo: &MongoHandle, token: &str) -> Result<(ObjectId, ObjectId)> {
    if token.is_empty() {
        return Err(ApiError::NotFound("inbound endpoint".into()));
    }
    let settings = mongo.collection::<Document>(SETTINGS_COLL);
    let doc_ = settings
        .find_one(doc! { "inboundSecret": token })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("email_settings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("inbound endpoint".into()))?;

    let user_id = doc_
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("email_settings missing userId")))?;
    let account_id = doc_
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("email_settings missing _id")))?;
    Ok((user_id, account_id))
}

/// Normalised inbound message — what we feed into the threading +
/// persist step.
struct ParsedMessage {
    from_email: String,
    from_name: Option<String>,
    to: Vec<(String, Option<String>)>,
    cc: Vec<(String, Option<String>)>,
    subject: String,
    body_text: Option<String>,
    body_html: Option<String>,
    message_id: Option<String>,
    in_reply_to: Option<String>,
    references: Vec<String>,
}

// ===========================================================================
// Mailgun
// ===========================================================================

#[instrument(skip_all, fields(token = %token))]
pub async fn ingest_mailgun(
    State(state): State<EmailInboundState>,
    Path(token): Path<String>,
    Form(form): Form<MailgunInboundForm>,
) -> Result<Json<IngestResponse>> {
    ingest_mailgun_inner(state, Some(token), form).await
}

#[instrument(skip_all)]
pub async fn ingest_mailgun_noid(
    State(state): State<EmailInboundState>,
    Query(q): Query<TokenQuery>,
    Form(form): Form<MailgunInboundForm>,
) -> Result<Json<IngestResponse>> {
    let token = q.token.clone();
    ingest_mailgun_inner(state, token, form).await
}

async fn ingest_mailgun_inner(
    state: EmailInboundState,
    path_token: Option<String>,
    form: MailgunInboundForm,
) -> Result<Json<IngestResponse>> {
    let token = path_token
        .or_else(|| form.token.clone())
        .unwrap_or_default();
    let (user_id, account_id) = resolve_tenant(&state.mongo, &token).await?;

    // If Mailgun forwarded raw MIME (`body-mime`), prefer parsing that
    // — it gives us authoritative headers / message-id / references.
    let parsed: ParsedMessage = if let Some(mime) = form.body_mime.as_deref() {
        match parse_mime(mime.as_bytes()) {
            Ok(p) => p,
            Err(e) => {
                warn!(error = %e, "mailgun body-mime parse failed; falling back to form fields");
                parsed_from_mailgun_form(&form)
            }
        }
    } else {
        parsed_from_mailgun_form(&form)
    };

    let res = persist_inbound(&state.mongo, user_id, account_id, parsed).await?;
    Ok(Json(res))
}

fn parsed_from_mailgun_form(f: &MailgunInboundForm) -> ParsedMessage {
    let (from_email, from_name) = parse_addr_line(
        f.sender
            .as_deref()
            .or(f.from_header.as_deref())
            .unwrap_or(""),
    );

    let to: Vec<(String, Option<String>)> = f
        .recipient
        .as_deref()
        .or(f.to_header.as_deref())
        .map(parse_addr_list)
        .unwrap_or_default();
    let cc: Vec<(String, Option<String>)> = f
        .cc_header
        .as_deref()
        .map(parse_addr_list)
        .unwrap_or_default();

    let subject = f
        .subject
        .clone()
        .or_else(|| f.subject_lc.clone())
        .unwrap_or_else(|| "(no subject)".to_owned());

    let body_text = f.body_plain.clone().or_else(|| f.stripped_text.clone());
    let body_html = f.body_html.clone().or_else(|| f.stripped_html.clone());

    let message_id = f
        .message_id_header
        .clone()
        .or_else(|| f.message_id_lc.clone())
        .map(strip_angle_brackets);
    let in_reply_to = f.in_reply_to.clone().map(strip_angle_brackets);
    let references = f
        .references
        .as_deref()
        .map(|s| {
            s.split_whitespace()
                .map(strip_angle_brackets)
                .filter(|x| !x.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    ParsedMessage {
        from_email,
        from_name,
        to,
        cc,
        subject,
        body_text,
        body_html,
        message_id,
        in_reply_to,
        references,
    }
}

// ===========================================================================
// SES → SNS
// ===========================================================================

#[instrument(skip_all, fields(token = %token))]
pub async fn ingest_ses(
    State(state): State<EmailInboundState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    ingest_ses_inner(state, Some(token), headers, body).await
}

#[instrument(skip_all)]
pub async fn ingest_ses_noid(
    State(state): State<EmailInboundState>,
    Query(q): Query<TokenQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    ingest_ses_inner(state, q.token.clone(), headers, body).await
}

async fn ingest_ses_inner(
    state: EmailInboundState,
    path_token: Option<String>,
    _headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    let token = path_token.unwrap_or_default();

    let envelope: SnsEnvelope = serde_json::from_slice(&body)
        .map_err(|e| ApiError::BadRequest(format!("invalid SNS envelope: {e}")))?;
    let notification = match envelope {
        SnsEnvelope::Notification(n) => n,
        SnsEnvelope::SubscriptionConfirmation(c) | SnsEnvelope::UnsubscribeConfirmation(c) => {
            // Operator needs to GET the SubscribeURL once. Surface it
            // via tracing so the platform team can find it in logs;
            // return a 200 so AWS doesn't keep retrying.
            warn!(
                subscribe_url = ?c.subscribe_url,
                "received SNS subscription confirmation — operator must visit SubscribeURL"
            );
            return Ok(Json(IngestResponse {
                ok: true,
                new_thread: false,
                thread_id: String::new(),
                message_id: String::new(),
            }));
        }
    };

    // Resolve tenancy AFTER we know it's a real notification — the SNS
    // confirmation path doesn't carry a useful tenant.
    let (user_id, account_id) = resolve_tenant(&state.mongo, &token).await?;

    let ses: SesMessage = serde_json::from_str(&notification.message)
        .map_err(|e| ApiError::BadRequest(format!("invalid SES message payload: {e}")))?;

    let parsed = if let Some(b64) = ses.content.as_deref() {
        // Standard base64 alphabet, padded.
        let raw = base64::engine::general_purpose::STANDARD
            .decode(b64.as_bytes())
            .map_err(|e| ApiError::BadRequest(format!("SES content base64 decode: {e}")))?;
        parse_mime(&raw)?
    } else if let Some(mail) = ses.mail.as_ref() {
        parsed_from_ses_headers(mail)
    } else {
        return Err(ApiError::BadRequest(
            "SES payload has neither `content` nor `mail` block".into(),
        ));
    };

    let res = persist_inbound(&state.mongo, user_id, account_id, parsed).await?;
    Ok(Json(res))
}

fn parsed_from_ses_headers(mail: &crate::dto::SesMail) -> ParsedMessage {
    let mut subject = String::new();
    let mut message_id = mail.message_id.clone().map(strip_angle_brackets);
    let mut in_reply_to: Option<String> = None;
    let mut references: Vec<String> = Vec::new();

    for h in &mail.headers {
        match h.name.to_ascii_lowercase().as_str() {
            "subject" if subject.is_empty() => subject = h.value.clone(),
            "message-id" if message_id.is_none() => {
                message_id = Some(strip_angle_brackets(h.value.clone()));
            }
            "in-reply-to" if in_reply_to.is_none() => {
                in_reply_to = Some(strip_angle_brackets(h.value.clone()));
            }
            "references" => {
                for tok in h.value.split_whitespace() {
                    references.push(strip_angle_brackets(tok.to_owned()));
                }
            }
            _ => {}
        }
    }

    let (from_email, from_name) = parse_addr_line(mail.source.as_deref().unwrap_or(""));
    let to: Vec<(String, Option<String>)> = mail
        .destination
        .iter()
        .map(|s| parse_addr_line(s))
        .collect();

    ParsedMessage {
        from_email,
        from_name,
        to,
        cc: Vec::new(),
        subject: if subject.is_empty() {
            "(no subject)".to_owned()
        } else {
            subject
        },
        body_text: None,
        body_html: None,
        message_id,
        in_reply_to,
        references,
    }
}

// ===========================================================================
// Raw MIME (SMTP relay)
// ===========================================================================

#[instrument(skip_all, fields(token = %token))]
pub async fn ingest_raw(
    State(state): State<EmailInboundState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    ingest_raw_inner(state, Some(token), headers, body).await
}

#[instrument(skip_all)]
pub async fn ingest_raw_noid(
    State(state): State<EmailInboundState>,
    Query(q): Query<TokenQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    ingest_raw_inner(state, q.token.clone(), headers, body).await
}

async fn ingest_raw_inner(
    state: EmailInboundState,
    path_token: Option<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<IngestResponse>> {
    let token = path_token.unwrap_or_default();

    // Per spec, raw relays MUST set `Content-Type: message/rfc822` (or
    // `text/plain`). We don't reject mismatches outright but we do
    // require the header to be present — that's the spec's safety net.
    if !headers.contains_key(axum::http::header::CONTENT_TYPE) {
        return Err(ApiError::BadRequest(
            "Content-Type header is required for raw inbound".into(),
        ));
    }

    let (user_id, account_id) = resolve_tenant(&state.mongo, &token).await?;
    let parsed = parse_mime(&body)?;
    let res = persist_inbound(&state.mongo, user_id, account_id, parsed).await?;
    Ok(Json(res))
}

// ===========================================================================
// MIME → ParsedMessage
// ===========================================================================

fn parse_mime(raw: &[u8]) -> Result<ParsedMessage> {
    let msg = MessageParser::default()
        .parse(raw)
        .ok_or_else(|| ApiError::BadRequest("could not parse MIME body".into()))?;

    let (from_email, from_name) = msg
        .from()
        .and_then(first_addr)
        .unwrap_or((String::new(), None));

    let to = msg.to().map(addr_list).unwrap_or_default();
    let cc = msg.cc().map(addr_list).unwrap_or_default();

    let subject = msg
        .subject()
        .map(|s| s.to_owned())
        .unwrap_or_else(|| "(no subject)".to_owned());

    let body_text = if msg.text_body_count() > 0 {
        msg.body_text(0).map(|c| c.into_owned())
    } else {
        None
    };
    let body_html = if msg.html_body_count() > 0 {
        msg.body_html(0).map(|c| c.into_owned())
    } else {
        None
    };

    let message_id = msg.message_id().map(|s| strip_angle_brackets(s.to_owned()));

    let in_reply_to = match msg.in_reply_to() {
        HeaderValue::Text(s) => Some(strip_angle_brackets(s.to_string())),
        HeaderValue::TextList(v) => v.first().map(|s| strip_angle_brackets(s.to_string())),
        _ => None,
    };
    let references: Vec<String> = match msg.references() {
        HeaderValue::Text(s) => s
            .split_whitespace()
            .map(|x| strip_angle_brackets(x.to_owned()))
            .collect(),
        HeaderValue::TextList(v) => v
            .iter()
            .flat_map(|s| {
                s.split_whitespace()
                    .map(|x| strip_angle_brackets(x.to_owned()))
                    .collect::<Vec<_>>()
            })
            .collect(),
        _ => Vec::new(),
    };

    Ok(ParsedMessage {
        from_email,
        from_name,
        to,
        cc,
        subject,
        body_text,
        body_html,
        message_id,
        in_reply_to,
        references,
    })
}

fn first_addr(a: &Address<'_>) -> Option<(String, Option<String>)> {
    match a {
        Address::List(list) => list.first().map(|x| {
            (
                x.address.as_ref().map(|s| s.to_string()).unwrap_or_default(),
                x.name.as_ref().map(|s| s.to_string()),
            )
        }),
        Address::Group(groups) => groups
            .iter()
            .flat_map(|g| g.addresses.iter())
            .next()
            .map(|x| {
                (
                    x.address.as_ref().map(|s| s.to_string()).unwrap_or_default(),
                    x.name.as_ref().map(|s| s.to_string()),
                )
            }),
    }
}

fn addr_list(a: &Address<'_>) -> Vec<(String, Option<String>)> {
    match a {
        Address::List(list) => list
            .iter()
            .filter_map(|x| {
                x.address
                    .as_ref()
                    .map(|s| (s.to_string(), x.name.as_ref().map(|n| n.to_string())))
            })
            .collect(),
        Address::Group(groups) => groups
            .iter()
            .flat_map(|g| g.addresses.iter())
            .filter_map(|x| {
                x.address
                    .as_ref()
                    .map(|s| (s.to_string(), x.name.as_ref().map(|n| n.to_string())))
            })
            .collect(),
    }
}

// ===========================================================================
// Threading + persist
// ===========================================================================

/// Find an existing thread for the inbound message, else create a new
/// one. Persists the message and bumps the thread metadata.
async fn persist_inbound(
    mongo: &MongoHandle,
    user_id: ObjectId,
    account_id: ObjectId,
    parsed: ParsedMessage,
) -> Result<IngestResponse> {
    let messages = mongo.collection::<Document>(MESSAGES_COLL);
    let threads = mongo.collection::<Document>(THREADS_COLL);

    // Threading step 1 — In-Reply-To / References → existing message →
    // its thread.
    let mut thread_oid: Option<ObjectId> = None;
    let mut header_lookup: Vec<&str> = Vec::new();
    if let Some(irt) = parsed.in_reply_to.as_deref() {
        header_lookup.push(irt);
    }
    for r in &parsed.references {
        header_lookup.push(r.as_str());
    }
    if !header_lookup.is_empty() {
        if let Some(msg) = messages
            .find_one(doc! {
                "userId": user_id,
                "messageId": { "$in": header_lookup },
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("messages.find_by_message_id"))
            })?
        {
            if let Ok(tid) = msg.get_object_id("threadId") {
                thread_oid = Some(tid);
            }
        }
    }

    // Threading step 2 — same tenant + same normalised subject.
    let normalised_subject = normalise_subject(&parsed.subject);
    if thread_oid.is_none() && !normalised_subject.is_empty() {
        if let Some(t) = threads
            .find_one(doc! {
                "userId": user_id,
                "accountId": account_id,
                "normalizedSubject": &normalised_subject,
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("threads.find_by_subject"))
            })?
        {
            if let Ok(tid) = t.get_object_id("_id") {
                thread_oid = Some(tid);
            }
        }
    }

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let preview = build_preview(
        parsed.body_text.as_deref(),
        parsed.body_html.as_deref().unwrap_or(""),
    );

    // Threading step 3 — create fresh thread.
    let (thread_oid, new_thread) = if let Some(tid) = thread_oid {
        threads
            .update_one(
                doc! { "_id": tid, "userId": user_id },
                doc! {
                    "$set": {
                        "lastMessageAt": now_bson,
                        "lastMessagePreview": &preview,
                        "unread": true,
                        "updatedAt": now_bson,
                    },
                    "$inc": { "messageCount": 1_i64 },
                },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("threads.bump_on_inbound"))
            })?;
        (tid, false)
    } else {
        let new_oid = ObjectId::new();
        let mut participants: Vec<Bson> = Vec::new();
        if !parsed.from_email.is_empty() {
            let mut d = doc! { "email": &parsed.from_email };
            if let Some(name) = parsed.from_name.as_deref() {
                d.insert("name", name);
            }
            participants.push(Bson::Document(d));
        }
        for (email, name) in &parsed.to {
            let mut d = doc! { "email": email };
            if let Some(n) = name.as_deref() {
                d.insert("name", n);
            }
            participants.push(Bson::Document(d));
        }

        let thread_doc = doc! {
            "_id": new_oid,
            "userId": user_id,
            "accountId": account_id,
            "subject": &parsed.subject,
            "normalizedSubject": &normalised_subject,
            "participants": Bson::Array(participants),
            "status": "open",
            "unread": true,
            "labels": Bson::Array(Vec::new()),
            "lastMessageAt": now_bson,
            "lastMessagePreview": &preview,
            "messageCount": 1_i64,
            "createdAt": now_bson,
            "updatedAt": now_bson,
        };
        threads.insert_one(thread_doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("threads.insert_one"))
        })?;
        (new_oid, true)
    };

    // Insert the message row.
    let message_oid = ObjectId::new();
    let mut message_doc = doc! {
        "_id": message_oid,
        "userId": user_id,
        "threadId": thread_oid,
        "direction": "inbound",
        "from": {
            "email": &parsed.from_email,
            "name": parsed.from_name.as_deref().unwrap_or_default(),
        },
        "to": Bson::Array(parsed.to.iter().map(|(e, n)| {
            let mut d = doc! { "email": e };
            if let Some(name) = n { d.insert("name", name); }
            Bson::Document(d)
        }).collect()),
        "cc": Bson::Array(parsed.cc.iter().map(|(e, n)| {
            let mut d = doc! { "email": e };
            if let Some(name) = n { d.insert("name", name); }
            Bson::Document(d)
        }).collect()),
        "subject": &parsed.subject,
        "createdAt": now_bson,
    };
    if let Some(t) = parsed.body_text.as_deref() {
        message_doc.insert("bodyText", t);
    }
    if let Some(h) = parsed.body_html.as_deref() {
        message_doc.insert("bodyHtml", h);
    }
    if let Some(mid) = parsed.message_id.as_deref() {
        message_doc.insert("messageId", mid);
    }
    if let Some(irt) = parsed.in_reply_to.as_deref() {
        message_doc.insert("inReplyTo", irt);
    }
    if !parsed.references.is_empty() {
        message_doc.insert(
            "references",
            Bson::Array(parsed.references.iter().map(|s| Bson::String(s.clone())).collect()),
        );
    }
    messages.insert_one(message_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("messages.insert_inbound"))
    })?;

    Ok(IngestResponse {
        ok: true,
        new_thread,
        thread_id: thread_oid.to_hex(),
        message_id: message_oid.to_hex(),
    })
}

// ===========================================================================
// Small string helpers
// ===========================================================================

fn strip_angle_brackets<S: Into<String>>(s: S) -> String {
    let s = s.into();
    let trimmed = s.trim();
    trimmed
        .strip_prefix('<')
        .and_then(|t| t.strip_suffix('>'))
        .map(|t| t.to_owned())
        .unwrap_or_else(|| trimmed.to_owned())
}

/// Strip leading `Re:` / `Fwd:` (any case, any number of times) so two
/// messages in the same thread thread together regardless of the client
/// quirks at each hop.
fn normalise_subject(s: &str) -> String {
    let mut cur = s.trim();
    loop {
        let lower = cur.to_ascii_lowercase();
        if let Some(rest) = lower
            .strip_prefix("re:")
            .or_else(|| lower.strip_prefix("fwd:"))
            .or_else(|| lower.strip_prefix("fw:"))
        {
            // Map the same byte slice in the original to preserve case
            // for cases where the body of the subject itself contains
            // those tokens.
            let cut = cur.len() - rest.len();
            cur = cur[cut..].trim_start();
        } else {
            break;
        }
    }
    cur.to_owned()
}

/// Parse a single address line — `"Display Name" <user@example.com>` or
/// bare `user@example.com`. Returns `(email, name)`. Used for Mailgun /
/// SES paths where the address comes in pre-rendered.
fn parse_addr_line(line: &str) -> (String, Option<String>) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return (String::new(), None);
    }
    if let Some(start) = trimmed.rfind('<') {
        if let Some(end_rel) = trimmed[start..].find('>') {
            let email = trimmed[start + 1..start + end_rel].trim().to_owned();
            let name_raw = trimmed[..start].trim().trim_matches('"').trim();
            let name = if name_raw.is_empty() {
                None
            } else {
                Some(name_raw.to_owned())
            };
            return (email, name);
        }
    }
    (trimmed.to_owned(), None)
}

/// Parse a comma-separated `To:` / `Cc:` line into one (email, name)
/// pair per recipient.
fn parse_addr_list(line: &str) -> Vec<(String, Option<String>)> {
    // Naive split on `,` — RFC-2822 allows commas inside quoted display
    // names, but Mailgun pre-normalises so the form value is safe to
    // split. For raw MIME we go through the parser instead.
    line.split(',')
        .map(|s| parse_addr_line(s))
        .filter(|(e, _)| !e.is_empty())
        .collect()
}

fn build_preview(body_text: Option<&str>, body_html: &str) -> String {
    let raw = match body_text {
        Some(t) if !t.trim().is_empty() => t.to_owned(),
        _ => strip_html(body_html),
    };
    let collapsed = collapse_whitespace(&raw);
    if collapsed.chars().count() <= 280 {
        collapsed
    } else {
        collapsed.chars().take(280).collect::<String>() + "…"
    }
}

fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_was_space = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !last_was_space {
                out.push(' ');
                last_was_space = true;
            }
        } else {
            out.push(ch);
            last_was_space = false;
        }
    }
    out.trim().to_owned()
}
