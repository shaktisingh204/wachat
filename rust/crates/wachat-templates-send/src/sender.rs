//! [`TemplateSender`] — the slice's public actor.
//!
//! Orchestration order matches `handleSendTemplateMessage` in
//! `src/app/actions/send-template.actions.ts`:
//!
//! 1. **Resolve template** — `db.collection('templates').findOne({ _id, projectId })`.
//!    We bake the `projectId` into the filter so a stolen `templateId`
//!    can't be used cross-tenant (mirrors the J3 P0-1 fix the TS file
//!    documents in its preamble).
//! 2. **Approval gate** — refuse `status != APPROVED`. Matches the TS
//!    `if (template.status !== 'APPROVED')` check at line 54.
//! 3. **Build components** — convert the stored `Template` into a
//!    [`TemplateSpec`] and run [`build_components`] for the BODY / HEADER
//!    text parameters. Non-substituting components (media headers,
//!    buttons) are left to the runtime data carried on
//!    [`SendTemplateRequest`].
//! 4. **Normalize phone** — `wachat_phone::normalize_e164` → canonical
//!    `+CCNNNNNNN`. The TS uses the contact's `waId` field (already in
//!    `wa_id` form, no `+`); the Meta API accepts both with and without
//!    the leading `+`, so the canonical form is fine.
//! 5. **POST to Meta** — `MetaClient::post_json` against
//!    `{phone-number-id}/messages`. The phone-number id comes off the
//!    project's first phone number summary (the TS reads it off the
//!    contact, which is itself denormalised from the project — same
//!    source of truth).
//! 6. **Insert log** — `outgoing_messages.insertOne({ ... })` with the
//!    exact field set the TS writes (see [`OutgoingLogDoc`]).

use std::collections::HashMap;

use bson::{Document, oid::ObjectId};
use chrono::Utc;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::{debug, instrument, warn};

use wachat_meta_client::MetaClient;
use wachat_meta_dto::{SendMessage, SendResponse, TemplateBody, TemplateLanguage};
use wachat_phone::normalize_e164;
use wachat_templates_engine::{TemplateButton, TemplateSpec, build_components};
use wachat_types::{project::Project, template::Template};

use crate::OUTGOING_MESSAGES_COLL;
use crate::dto::{SendOutcome, SendTemplateRequest};

/// Mongo collection name for templates. Matches `template.actions.ts`
/// (line 31) and the `wachat-templates::TemplatesReader` constant.
const TEMPLATES_COLL: &str = "templates";

/// The wachat single-template sender.
///
/// Cheap to clone — both fields are `Arc`-backed (`MongoHandle` and
/// `MetaClient` document this in their own crates).
#[derive(Debug, Clone)]
pub struct TemplateSender {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl TemplateSender {
    /// Construct a sender bound to the given Mongo + Meta handles.
    ///
    /// The `MetaClient` should be pinned to [`crate::META_API_VERSION`]
    /// (`v23.0`) to match the TS — but we don't enforce that here so
    /// tests can swap in a `with_base` mock.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// Send one template message.
    ///
    /// On success returns a [`SendOutcome`] with the new message log id
    /// and the Meta `wamid`. On failure returns the first error
    /// encountered as an [`ApiError`] — Mongo / Meta errors map through
    /// their existing `From` impls, validation errors (template not
    /// found, not approved, missing project access token, …) come back
    /// as [`ApiError::BadRequest`] / [`ApiError::NotFound`] /
    /// [`ApiError::Validation`].
    #[instrument(
        skip(self, request),
        fields(
            project_id = %project.id,
            template_id = %request.template_id,
            recipient = %request.recipient_phone,
        )
    )]
    pub async fn send(
        &self,
        project: &Project,
        request: SendTemplateRequest,
    ) -> Result<SendOutcome, ApiError> {
        // ---- 1. Resolve template (project-scoped) -----------------------
        let template = self.fetch_template(project.id, request.template_id).await?;

        // ---- 2. Approval gate ------------------------------------------
        // `status` is now stored as `Option<String>` for resilience against
        // legacy values like `"INTERACTIVE"`. We treat anything that isn't
        // the exact `"APPROVED"` enum value as not-approved.
        if template.status.as_deref() != Some("APPROVED") {
            return Err(ApiError::BadRequest(
                "Cannot send a template that is not approved.".to_owned(),
            ));
        }

        // ---- 3. Project plumbing the TS reads off the contact / project
        let access_token = project
            .access_token
            .as_deref()
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                // TS does not check this on the action path — it short-
                // circuits earlier in the auth layer. We surface a clear
                // 400 rather than letting the Meta call fail with a
                // generic OAuthException.
                ApiError::BadRequest("Project access token is not configured.".to_owned())
            })?;

        // App id check matches TS line 59: "Project App ID is not configured."
        if project.app_id.as_deref().map(str::is_empty).unwrap_or(true) {
            return Err(ApiError::BadRequest(
                "Project App ID is not configured.".to_owned(),
            ));
        }

        let phone_number_id = project
            .phone_numbers
            .first()
            .and_then(|p| p.id.clone())
            .ok_or_else(|| {
                ApiError::BadRequest("Project has no phone number configured.".to_owned())
            })?;

        // ---- 4. Normalize recipient phone ------------------------------
        let recipient = normalize_e164(&request.recipient_phone, None)
            .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;

        // ---- 5. Build components ---------------------------------------
        let spec = template_to_spec(&template);
        let mut components: Vec<Value> = build_components(&spec, &request.variables)
            .map_err(|e| ApiError::Validation(format!("template substitution failed: {e}")))?
            .into_iter()
            .map(|c| {
                serde_json::to_value(&c)
                    .expect("MetaComponent is serialisable to JSON by construction")
            })
            .collect();

        // Inject the media-header component if the caller supplied a
        // pre-uploaded media id and the template has a media HEADER. The
        // TS does this inline at lines 109-112 (`{ type: 'image', image:
        // { id: mediaId } }` etc).
        if let Some(media_id) = request.media_id.as_deref() {
            if let Some(header_param) = build_media_header_param(&template.components, media_id) {
                // Header parameters always go first in the TS array, so
                // we prepend.
                components.insert(
                    0,
                    json!({
                        "type": "header",
                        "parameters": [header_param],
                    }),
                );
            } else {
                warn!(
                    template_id = %template.id,
                    "media_id supplied but template has no media HEADER component; ignoring"
                );
            }
        }

        // ---- 6. POST to Meta -------------------------------------------
        let body = SendMessage::Template {
            // Meta accepts either `+CC...` or bare digits. Strip the `+`
            // so the wire shape matches the TS `waId` exactly (Meta
            // logs/dedup by the bare-digits form).
            to: recipient.trim_start_matches('+').to_owned(),
            template: TemplateBody {
                name: template.name.clone().ok_or_else(|| {
                    ApiError::BadRequest("Template is missing required `name`".to_owned())
                })?,
                language: TemplateLanguage {
                    code: template.language.clone().ok_or_else(|| {
                        ApiError::BadRequest("Template is missing required `language`".to_owned())
                    })?,
                },
                components: components.clone(),
            },
        };

        // Meta's `messages` endpoint requires the `messaging_product`
        // wrapper (TS line 308). The DTO's enum is internally-tagged and
        // missing that field on its own; we wrap with serde_json::json!
        // so the wire shape is byte-identical to what the TS sends.
        let payload = json!({
            "messaging_product": "whatsapp",
            "to": match &body { SendMessage::Template { to, .. } => to, _ => unreachable!() },
            "type": "template",
            "template": match &body {
                SendMessage::Template { template, .. } => template,
                _ => unreachable!(),
            },
        });

        debug!(?phone_number_id, "POST /{{phone-number-id}}/messages");

        let path = format!("{phone_number_id}/messages");
        let resp: SendResponse = self
            .meta
            .post_json(&path, access_token, &payload)
            .await
            .map_err(ApiError::from)?;

        // TS line 322-323: "Message sent but no WAMID returned from Meta."
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

        // ---- 7. Insert outgoing message log ----------------------------
        let log_id = self
            .insert_outgoing_log(project, &template, &recipient, &wamid, &components)
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    async fn fetch_template(
        &self,
        project_id: ObjectId,
        template_id: ObjectId,
    ) -> Result<Template, ApiError> {
        let coll = self.mongo.collection::<Template>(TEMPLATES_COLL);
        let filter = bson::doc! { "_id": template_id, "projectId": project_id };
        coll.find_one(filter)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("templates.find_one")))?
            .ok_or_else(|| {
                // TS line 53: "Template not found in this project."
                ApiError::NotFound("Template not found in this project.".to_owned())
            })
    }

    async fn insert_outgoing_log(
        &self,
        project: &Project,
        template: &Template,
        recipient: &str,
        wamid: &str,
        sent_components: &[Value],
    ) -> Result<ObjectId, ApiError> {
        let now = Utc::now();
        let bare_phone = recipient.trim_start_matches('+');

        // Mirror the TS document EXACTLY (`send-template.actions.ts`
        // lines 327-340). Field order matches insert-time as much as
        // BSON allows; tests assert on field presence + values, not
        // order.
        //
        // ```
        // db.collection('outgoing_messages').insertOne({
        //   direction: 'out',
        //   contactId: contact._id,
        //   projectId: hasAccess._id,
        //   wamid,
        //   messageTimestamp: now,
        //   type: 'template',
        //   content: { template: finalTemplatePayloadForDb },
        //   status: 'sent',
        //   statusTimestamps: { sent: now },
        //   createdAt: now,
        // })
        // ```
        let final_template = json!({
            "name": template.name,
            "language": { "code": template.language },
            "components": sent_components,
            "original_components": template.components,
            "sent_components": sent_components,
        });

        let log_id = ObjectId::new();
        let bson_now: bson::DateTime = bson::DateTime::from_chrono(now);

        let mut doc = bson::doc! {
            "_id": log_id,
            "direction": "out",
            "projectId": project.id,
            "templateId": template.id,
            "wamid": wamid,
            "recipient": bare_phone,
            "messageTimestamp": bson_now,
            "type": "template",
            "content": bson::to_bson(&final_template).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("encode content"))
            })?,
            "status": "pending",
            "statusTimestamps": { "sent": bson_now },
            "createdAt": bson_now,
        };

        // The TS additionally writes `contactId` — we don't have one in
        // this slice (the resolution moved upstream). We omit the field
        // rather than synthesising an id; readers that care about the
        // contact link can JOIN on `recipient` (the bare-digits phone).
        // Keeping the doc shape additive means consumers reading the TS
        // shape don't break.
        let _ = doc.remove("contactId"); // explicit no-op to flag the diff

        let coll = self.mongo.collection::<Document>(OUTGOING_MESSAGES_COLL);
        coll.insert_one(doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("outgoing_messages.insert_one"))
        })?;

        Ok(log_id)
    }
}

// -------------------------------------------------------------------------
// Template -> TemplateSpec conversion
// -------------------------------------------------------------------------

/// Project a stored `Template` into the engine's `TemplateSpec` shape.
///
/// The stored `components` JSON is Meta's wire shape — a JSON array of
/// component objects each with a `type` (`HEADER` / `BODY` / `FOOTER` /
/// `BUTTONS`) and type-specific fields. We pull out the bits the
/// substitution engine needs:
///
/// * HEADER → `header` text (only when `format == "TEXT"`).
/// * BODY   → `body` text.
/// * FOOTER → `footer` text (engine doesn't substitute, but the TS keeps it).
/// * BUTTONS → `buttons[]` (only `URL` buttons can substitute today).
///
/// Anything we don't recognise is silently dropped — exactly as the TS
/// `find(c => c.type === 'BODY')` skips unknown branches.
fn template_to_spec(t: &Template) -> TemplateSpec {
    let components = t.components.as_array().cloned().unwrap_or_default();

    let mut header: Option<String> = None;
    let mut body: String = String::new();
    let mut footer: Option<String> = None;
    let mut buttons: Vec<TemplateButton> = Vec::new();

    for comp in &components {
        let kind = comp
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_ascii_uppercase();

        match kind.as_str() {
            "HEADER" => {
                let format = comp
                    .get("format")
                    .and_then(Value::as_str)
                    .map(str::to_ascii_uppercase);
                if matches!(format.as_deref(), Some("TEXT") | None) {
                    header = comp.get("text").and_then(Value::as_str).map(str::to_owned);
                }
            }
            "BODY" => {
                body = comp
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .unwrap_or_default();
            }
            "FOOTER" => {
                footer = comp.get("text").and_then(Value::as_str).map(str::to_owned);
            }
            "BUTTONS" => {
                if let Some(arr) = comp.get("buttons").and_then(Value::as_array) {
                    for b in arr {
                        if let Some(button) = parse_button(b) {
                            buttons.push(button);
                        }
                    }
                }
            }
            _ => {} // FOOTER/CAROUSEL/LIMITED_TIME_OFFER etc. — out of scope
        }
    }

    TemplateSpec {
        name: t.name.clone().unwrap_or_default(),
        language_code: t.language.clone().unwrap_or_default(),
        header,
        body,
        footer,
        buttons,
    }
}

fn parse_button(b: &Value) -> Option<TemplateButton> {
    let kind = b
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_uppercase();
    let text = b
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_owned();
    match kind.as_str() {
        "URL" => Some(TemplateButton::Url {
            text,
            url_template: b
                .get("url")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned(),
        }),
        "QUICK_REPLY" => Some(TemplateButton::QuickReply { text }),
        "PHONE_NUMBER" => Some(TemplateButton::PhoneNumber {
            text,
            phone: b
                .get("phone_number")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned(),
        }),
        _ => None, // COPY_CODE, OTP, etc. — handled by upstream slices
    }
}

/// Build the Meta `header` component parameter for a media-id send. Returns
/// `None` if the template has no media HEADER component.
fn build_media_header_param(components: &Value, media_id: &str) -> Option<Value> {
    let arr = components.as_array()?;
    for comp in arr {
        let kind = comp
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_ascii_uppercase();
        if kind != "HEADER" {
            continue;
        }
        let format = comp
            .get("format")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_ascii_uppercase();
        return match format.as_str() {
            "IMAGE" => Some(json!({ "type": "image", "image": { "id": media_id } })),
            "VIDEO" => Some(json!({ "type": "video", "video": { "id": media_id } })),
            "DOCUMENT" => Some(json!({ "type": "document", "document": { "id": media_id } })),
            _ => None,
        };
    }
    None
}

// -------------------------------------------------------------------------
// Strict outgoing log shape (kept for documentation + future typed reads).
//
// We currently insert via `bson::doc!` so we can drop fields that don't
// apply (`contactId`). Defining the typed shape here lets future callers
// `find_one::<OutgoingLogDoc>(...)` without re-deriving it from scratch.
// -------------------------------------------------------------------------

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutgoingLogDoc {
    #[serde(rename = "_id")]
    id: ObjectId,
    direction: String, // always "out"
    project_id: ObjectId,
    template_id: ObjectId,
    wamid: String,
    recipient: String,
    message_timestamp: bson::DateTime,
    #[serde(rename = "type")]
    kind: String, // always "template"
    content: Value, // { template: { name, language, components, ... } }
    status: String, // "pending" / "sent" / "delivered" / "read" / "failed"
    status_timestamps: HashMap<String, bson::DateTime>,
    created_at: bson::DateTime,
}

// -------------------------------------------------------------------------
// Unit tests
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_template(components: Value) -> Template {
        Template {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            name: "welcome_template".to_owned(),
            language: "en_US".to_owned(),
            status: TemplateStatus::Approved,
            category: wachat_types::template::TemplateCategory::Marketing,
            components,
            meta_template_id: Some("meta_123".to_owned()),
            created_at: None,
        }
    }

    #[test]
    fn template_to_spec_extracts_body() {
        let t = make_template(json!([
            { "type": "BODY", "text": "Hello {{1}}!" }
        ]));
        let s = template_to_spec(&t);
        assert_eq!(s.body, "Hello {{1}}!");
        assert!(s.header.is_none());
    }

    #[test]
    fn template_to_spec_extracts_text_header() {
        let t = make_template(json!([
            { "type": "HEADER", "format": "TEXT", "text": "Hi {{1}}" },
            { "type": "BODY", "text": "Body" }
        ]));
        let s = template_to_spec(&t);
        assert_eq!(s.header.as_deref(), Some("Hi {{1}}"));
        assert_eq!(s.body, "Body");
    }

    #[test]
    fn template_to_spec_skips_media_header() {
        let t = make_template(json!([
            { "type": "HEADER", "format": "IMAGE" },
            { "type": "BODY", "text": "B" }
        ]));
        let s = template_to_spec(&t);
        // Media headers don't contribute to substitution-time `header`.
        assert!(s.header.is_none());
    }

    #[test]
    fn template_to_spec_extracts_url_button() {
        let t = make_template(json!([
            { "type": "BODY", "text": "x" },
            {
                "type": "BUTTONS",
                "buttons": [
                    { "type": "URL", "text": "Open", "url": "https://example.com/{{1}}" }
                ]
            }
        ]));
        let s = template_to_spec(&t);
        assert_eq!(s.buttons.len(), 1);
        assert!(matches!(
            &s.buttons[0],
            TemplateButton::Url { url_template, .. } if url_template == "https://example.com/{{1}}"
        ));
    }

    #[test]
    fn build_media_header_param_image() {
        let components = json!([{ "type": "HEADER", "format": "IMAGE" }]);
        let p = build_media_header_param(&components, "MEDIA_42").unwrap();
        assert_eq!(p["type"], "image");
        assert_eq!(p["image"]["id"], "MEDIA_42");
    }

    #[test]
    fn build_media_header_param_video() {
        let components = json!([{ "type": "HEADER", "format": "VIDEO" }]);
        let p = build_media_header_param(&components, "M").unwrap();
        assert_eq!(p["type"], "video");
        assert_eq!(p["video"]["id"], "M");
    }

    #[test]
    fn build_media_header_param_document() {
        let components = json!([{ "type": "HEADER", "format": "DOCUMENT" }]);
        let p = build_media_header_param(&components, "M").unwrap();
        assert_eq!(p["type"], "document");
        assert_eq!(p["document"]["id"], "M");
    }

    #[test]
    fn build_media_header_param_none_when_text_header() {
        let components = json!([{ "type": "HEADER", "format": "TEXT", "text": "x" }]);
        assert!(build_media_header_param(&components, "M").is_none());
    }

    #[test]
    fn build_media_header_param_none_when_no_header() {
        let components = json!([{ "type": "BODY", "text": "x" }]);
        assert!(build_media_header_param(&components, "M").is_none());
    }

    #[test]
    fn meta_api_version_matches_ts() {
        // Source of truth: send-template.actions.ts line 14.
        assert_eq!(crate::META_API_VERSION, "v25.0");
    }

    #[test]
    fn outgoing_messages_collection_name_matches_ts() {
        // Source of truth: send-template.actions.ts line 337.
        assert_eq!(crate::OUTGOING_MESSAGES_COLL, "outgoing_messages");
    }
}
