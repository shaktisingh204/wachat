//! [`MessageSender`] — the slice's public actor.
//!
//! Orchestration order matches `handleSendMessage` in
//! `src/app/actions/whatsapp.actions.ts` (line ~406):
//!
//! 1. **Project plumbing** — pull `accessToken` and the first
//!    `phoneNumbers[].id` off the supplied `Project`. The TS reads
//!    `phoneNumberId` straight off the form `data` argument; we project it
//!    off `Project.phone_numbers[0]` to match the rest of the Rust port
//!    and to give callers one less footgun.
//! 2. **Normalize phone** — `wachat_phone::normalize_e164` → canonical
//!    `+CCNNNNNNN`. The TS uses the contact's `waId` field directly
//!    (already in `wa_id` form, no `+`); Meta accepts both, but we strip
//!    the `+` before sending so the wire shape matches the TS exactly
//!    (Meta logs / dedup by the bare-digits form).
//! 3. **Build the Meta payload** — `messaging_product: "whatsapp"`,
//!    `recipient_type: "individual"`, `to`, `type`, plus the type-specific
//!    body (`text` / `image` / `video` / `document` / `audio`). Mirrors the
//!    TS `messagePayload` object literally.
//! 4. **POST to Meta** — `MetaClient::post_json` against
//!    `{phone-number-id}/messages`. TS line 472:
//!    ```text
//!    axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, ...)
//!    ```
//! 5. **Insert log** — `outgoing_messages.insertOne({ ... })` with the
//!    EXACT field set the TS writes at lines 484-487. We do this inline
//!    (not fire-and-forget) so the caller sees a 5xx if the write fails —
//!    different from the TS which fires the write off the request thread.

use bson::{Document, oid::ObjectId};
use chrono::Utc;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, instrument};

use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_meta_dto::SendResponse;
use wachat_phone::normalize_e164;
use wachat_types::project::Project;

use crate::OUTGOING_MESSAGES_COLL;
use crate::dto::{SendMessageRequest, SendOutcome};

/// Maximum length of the `lastMessage` preview the TS writes onto the
/// `contacts` collection (`whatsapp.actions.ts` line 490). We don't write
/// the contact preview in this slice (that's `wachat-webhook-contacts`'
/// job), but we expose the constant so a future caller can stay in sync.
#[allow(dead_code)]
pub(crate) const LAST_MESSAGE_PREVIEW_LEN: usize = 50;

/// The wachat chat-side message sender.
///
/// Cheap to clone — all three fields are `Arc`-backed (`MongoHandle`,
/// `MetaClient`, and `MediaUploader` document this in their own crates).
///
/// `media` is held even though this slice doesn't drive an upload itself
/// — keeping it on the actor lets the future "upload from raw bytes"
/// branch slot in without an API churn (the TS does the upload inline at
/// lines 430-445).
#[derive(Debug, Clone)]
pub struct MessageSender {
    mongo: MongoHandle,
    meta: MetaClient,
    #[allow(dead_code)]
    media: MediaUploader,
}

impl MessageSender {
    /// Construct a sender bound to the given Mongo + Meta + media handles.
    ///
    /// The `MetaClient` should be pinned to [`crate::META_API_VERSION`]
    /// (`v23.0`) to match the TS — but we don't enforce that here so
    /// tests can swap in a `with_base` mock pointed at any version.
    pub fn new(mongo: MongoHandle, meta: MetaClient, media: MediaUploader) -> Self {
        Self { mongo, meta, media }
    }

    /// Send one chat-side message.
    ///
    /// On success returns a [`SendOutcome`] with the new message log id
    /// and the Meta `wamid`. On failure returns the first error
    /// encountered as an [`ApiError`] — Mongo / Meta errors map through
    /// their existing `From` impls, validation errors (missing access
    /// token, bad phone, neither id nor link supplied for a media send,
    /// …) come back as [`ApiError::BadRequest`] / [`ApiError::Validation`].
    #[instrument(
        skip(self, request),
        fields(
            project_id = %project.id,
            recipient = %request.to(),
            kind = request.meta_type(),
        )
    )]
    pub async fn send(
        &self,
        project: &Project,
        request: SendMessageRequest,
    ) -> Result<SendOutcome, ApiError> {
        // ---- 1. Project plumbing ---------------------------------------
        let access_token = project
            .access_token
            .as_deref()
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                ApiError::BadRequest("Project access token is not configured.".to_owned())
            })?;

        let phone_number_id = project
            .phone_numbers
            .first()
            .and_then(|p| p.id.clone())
            .ok_or_else(|| {
                ApiError::BadRequest("Project has no phone number configured.".to_owned())
            })?;

        // ---- 2. Normalize recipient phone ------------------------------
        // The TS uses `data.waId` straight as the `to` field — bare digits
        // because contacts are stored with `waId: '<digits>'`. We accept
        // any format `normalize_e164` can canonicalize, then strip the
        // leading `+` so the on-the-wire `to` matches the TS exactly.
        let canonical = normalize_e164(request.to(), None)
            .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;
        let bare_to = canonical.trim_start_matches('+').to_owned();

        // ---- 3. Build the Meta payload ---------------------------------
        let (meta_type, type_body) = build_type_body(&request)?;
        let payload = json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": bare_to,
            "type": meta_type,
            // Inline the type-keyed body (`text` / `image` / …). Done via
            // `serde_json::Map::insert` rather than a static struct so we
            // can keep the inner shapes flexible (Meta adds optional
            // fields fairly often).
            meta_type: type_body,
        });

        // ---- 4. POST to Meta -------------------------------------------
        debug!(?phone_number_id, "POST /{{phone-number-id}}/messages");

        let path = format!("{phone_number_id}/messages");
        let resp: SendResponse = self
            .meta
            .post_json(&path, access_token, &payload)
            .await
            .map_err(ApiError::from)?;

        // TS line 474: "Message sent but no WAMID returned from Meta."
        let wamid = resp
            .messages
            .into_iter()
            .next()
            .map(|m| m.id)
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "Message sent but no WAMID returned from Meta."
                ))
            })?;

        // ---- 5. Insert outgoing message log ----------------------------
        let log_id = self
            .insert_outgoing_log(project, request.meta_type(), &wamid, &payload)
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    /// Insert the outgoing-message log row.
    ///
    /// The document shape mirrors the TS insert at
    /// `whatsapp.actions.ts` lines 484-487 EXACTLY:
    ///
    /// ```text
    /// db.collection('outgoing_messages').insertOne({
    ///   direction: 'out',
    ///   contactId: contactOid,
    ///   projectId: projectOid,
    ///   wamid,
    ///   messageTimestamp: now,
    ///   type: messageType,
    ///   content: messagePayload,
    ///   status: 'sent',
    ///   statusTimestamps: { sent: now },
    ///   createdAt: now,
    /// })
    /// ```
    ///
    /// One field is intentionally omitted vs the TS:
    ///
    /// * **`contactId`** — the TS resolves a `Contact` upstream and pins
    ///   its `_id` here. This slice doesn't take a contact (per the
    ///   `Public API` contract on the prompt), so we drop the field
    ///   rather than synthesising a zero id. Readers that need the
    ///   contact link can JOIN on `recipient` (the bare-digits phone).
    ///
    /// All remaining fields — including the literal strings `"out"` /
    /// `"sent"` and the `statusTimestamps.sent` map — match the TS doc
    /// byte-for-byte.
    async fn insert_outgoing_log(
        &self,
        project: &Project,
        message_type: &str,
        wamid: &str,
        message_payload: &Value,
    ) -> Result<ObjectId, ApiError> {
        let now = Utc::now();
        let bson_now = bson::DateTime::from_chrono(now);

        // The TS payload's `to` field is the bare-digits phone; we mirror
        // that into a sibling `recipient` field so consumers can index it
        // without parsing the JSON `content`. (The TS code doesn't write
        // `recipient` — see the comment in `wachat-templates-send`'s log
        // for the same additive-field rationale.)
        let recipient = message_payload
            .get("to")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned();

        let log_id = ObjectId::new();
        let doc = bson::doc! {
            "_id": log_id,
            "direction": "out",
            "projectId": project.id,
            "wamid": wamid,
            "recipient": recipient,
            "messageTimestamp": bson_now,
            "type": message_type,
            "content": bson::to_bson(message_payload).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("encode content"))
            })?,
            "status": "sent",
            "statusTimestamps": { "sent": bson_now },
            "createdAt": bson_now,
        };

        let coll = self.mongo.collection::<Document>(OUTGOING_MESSAGES_COLL);
        coll.insert_one(doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("outgoing_messages.insert_one"))
        })?;

        Ok(log_id)
    }
}

// -------------------------------------------------------------------------
// Type-body construction
// -------------------------------------------------------------------------

/// Build the (`type`, type-keyed body) pair for the Meta payload.
///
/// Returns `Err(Validation)` for the media variants when neither
/// `media_id` nor `link` was supplied — Meta requires exactly one and the
/// TS code is implicitly guarded by always uploading first.
fn build_type_body(req: &SendMessageRequest) -> Result<(&'static str, Value), ApiError> {
    match req {
        SendMessageRequest::Text {
            body, preview_url, ..
        } => Ok(("text", json!({ "body": body, "preview_url": preview_url }))),
        SendMessageRequest::Image {
            media_id,
            link,
            caption,
            ..
        } => Ok(("image", media_object(media_id, link, caption, None)?)),
        SendMessageRequest::Video {
            media_id,
            link,
            caption,
            ..
        } => Ok(("video", media_object(media_id, link, caption, None)?)),
        SendMessageRequest::Document {
            media_id,
            link,
            caption,
            filename,
            ..
        } => Ok((
            "document",
            media_object(media_id, link, caption, filename.as_deref())?,
        )),
        SendMessageRequest::Audio { media_id, link, .. } => {
            Ok(("audio", media_object(media_id, link, &None, None)?))
        }
    }
}

/// Build the inner `image` / `video` / `document` / `audio` object. Meta
/// requires **exactly one** of `id` or `link`; we surface a `Validation`
/// error if neither is supplied. (Both supplied is also invalid per Meta;
/// we let Meta reject it rather than re-implementing that check here.)
fn media_object(
    media_id: &Option<String>,
    link: &Option<String>,
    caption: &Option<String>,
    filename: Option<&str>,
) -> Result<Value, ApiError> {
    if media_id.is_none() && link.is_none() {
        return Err(ApiError::Validation(
            "media send requires either media_id or link".to_owned(),
        ));
    }

    let mut obj = serde_json::Map::new();
    if let Some(id) = media_id {
        obj.insert("id".to_owned(), Value::String(id.clone()));
    }
    if let Some(l) = link {
        obj.insert("link".to_owned(), Value::String(l.clone()));
    }
    if let Some(c) = caption {
        obj.insert("caption".to_owned(), Value::String(c.clone()));
    }
    if let Some(f) = filename {
        obj.insert("filename".to_owned(), Value::String(f.to_owned()));
    }
    Ok(Value::Object(obj))
}

// -------------------------------------------------------------------------
// Unit tests — pure shape checks, no Mongo / Meta required.
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_body_has_preview_url_flag() {
        let req = SendMessageRequest::Text {
            to: "+919876543210".to_owned(),
            body: "hi".to_owned(),
            preview_url: true,
        };
        let (kind, body) = build_type_body(&req).unwrap();
        assert_eq!(kind, "text");
        assert_eq!(body["body"], "hi");
        assert_eq!(body["preview_url"], true);
    }

    #[test]
    fn image_with_media_id_only() {
        let req = SendMessageRequest::Image {
            to: "+1".to_owned(),
            media_id: Some("MEDIA_42".to_owned()),
            link: None,
            caption: Some("hello".to_owned()),
        };
        let (kind, body) = build_type_body(&req).unwrap();
        assert_eq!(kind, "image");
        assert_eq!(body["id"], "MEDIA_42");
        assert_eq!(body["caption"], "hello");
        assert!(body.get("link").is_none());
    }

    #[test]
    fn document_with_link_and_filename() {
        let req = SendMessageRequest::Document {
            to: "+1".to_owned(),
            media_id: None,
            link: Some("https://x.test/a.pdf".to_owned()),
            caption: None,
            filename: Some("a.pdf".to_owned()),
        };
        let (kind, body) = build_type_body(&req).unwrap();
        assert_eq!(kind, "document");
        assert_eq!(body["link"], "https://x.test/a.pdf");
        assert_eq!(body["filename"], "a.pdf");
        assert!(body.get("id").is_none());
    }

    #[test]
    fn audio_requires_media_id_or_link() {
        let req = SendMessageRequest::Audio {
            to: "+1".to_owned(),
            media_id: None,
            link: None,
        };
        let err = build_type_body(&req).unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn video_with_link() {
        let req = SendMessageRequest::Video {
            to: "+1".to_owned(),
            media_id: None,
            link: Some("https://x.test/a.mp4".to_owned()),
            caption: None,
        };
        let (kind, body) = build_type_body(&req).unwrap();
        assert_eq!(kind, "video");
        assert_eq!(body["link"], "https://x.test/a.mp4");
    }

    #[test]
    fn meta_type_strings_match_ts_outgoing_union() {
        // Source of truth: TS `OutgoingMessage['type']` values:
        // 'text' | 'image' | 'video' | 'document' (audio added in Rust).
        assert_eq!(
            SendMessageRequest::Text {
                to: "x".into(),
                body: "y".into(),
                preview_url: false
            }
            .meta_type(),
            "text"
        );
        assert_eq!(
            SendMessageRequest::Image {
                to: "x".into(),
                media_id: None,
                link: Some("l".into()),
                caption: None,
            }
            .meta_type(),
            "image"
        );
        assert_eq!(
            SendMessageRequest::Video {
                to: "x".into(),
                media_id: None,
                link: Some("l".into()),
                caption: None,
            }
            .meta_type(),
            "video"
        );
        assert_eq!(
            SendMessageRequest::Document {
                to: "x".into(),
                media_id: None,
                link: Some("l".into()),
                caption: None,
                filename: None,
            }
            .meta_type(),
            "document"
        );
        assert_eq!(
            SendMessageRequest::Audio {
                to: "x".into(),
                media_id: None,
                link: Some("l".into()),
            }
            .meta_type(),
            "audio"
        );
    }

    #[test]
    fn meta_api_version_matches_ts() {
        // Source of truth: whatsapp.actions.ts top-of-file `API_VERSION`.
        assert_eq!(crate::META_API_VERSION, "v25.0");
    }

    #[test]
    fn outgoing_messages_collection_name_matches_ts() {
        // Source of truth: whatsapp.actions.ts line 484.
        assert_eq!(crate::OUTGOING_MESSAGES_COLL, "outgoing_messages");
    }
}
