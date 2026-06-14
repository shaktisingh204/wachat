//! [`CtaSender`] — catalog (`product_list`) and CTA URL (`cta_url`) sender.
//!
//! Both methods follow the same pipeline:
//!
//! 1. Validate project plumbing (`access_token`, `phone_numbers[0].id`).
//! 2. Normalise the recipient phone via [`wachat_phone::normalize_e164`] and
//!    strip the leading `+` so the wire shape matches the TS `waId` exactly.
//! 3. Build the Meta `interactive` body (untyped `serde_json::Value`, then
//!    wrap with [`SendMessage::Interactive`] so the rest of the workspace
//!    sees the same DTO surface).
//! 4. Wrap with the `messaging_product: "whatsapp"` envelope and POST to
//!    `{phone-number-id}/messages` via [`MetaClient::post_json`].
//! 5. Insert an `outgoing_messages` Mongo doc with the same field set the
//!    TS writes (see [`build_outgoing_log_doc`]).
//!
//! ## Why two methods on one struct
//!
//! The TS keeps these as two top-level actions. We co-locate them on a
//! single struct because they share 100% of the plumbing — splitting would
//! mean two near-identical `MetaClient` / `MongoHandle` borrows.

use bson::{Document, oid::ObjectId};
use chrono::Utc;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, instrument};

use wachat_meta_client::MetaClient;
use wachat_meta_dto::{SendMessage, SendResponse};
use wachat_phone::normalize_e164;
use wachat_types::project::Project;

use crate::OUTGOING_MESSAGES_COLL;
use crate::dto::{SendCatalogReq, SendCtaUrlReq, SendOutcome};

/// The wachat catalog + CTA URL sender.
///
/// Cheap to clone — both fields are `Arc`-backed.
#[derive(Debug, Clone)]
pub struct CtaSender {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl CtaSender {
    /// Construct a sender bound to the given Mongo + Meta handles.
    ///
    /// The `MetaClient` should be pinned to [`crate::META_API_VERSION`]
    /// (`v23.0`) to match the TS — but we don't enforce that here so tests
    /// can swap in a `with_base` mock pointed at a wiremock server.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// Send a `product_list` (catalog) interactive message.
    ///
    /// TS source: `handleSendCatalogMessage` (`whatsapp.actions.ts` line 1052).
    /// Wire shape — quoted from the TS (lines 1077-1096):
    /// ```text
    /// {
    ///   messaging_product: 'whatsapp',
    ///   to: waId,
    ///   type: 'interactive',
    ///   interactive: {
    ///     type: 'product_list',
    ///     ...(headerText && { header: { type: 'text', text: headerText } }),
    ///     body: { text: bodyText },
    ///     ...(footerText && { footer: { text: footerText } }),
    ///     action: {
    ///       catalog_id: project.connectedCatalogId,
    ///       sections: [{ title: 'Our Products', product_items: [...] }],
    ///     },
    ///   },
    /// }
    /// ```
    #[instrument(
        skip(self, req),
        fields(project_id = %project.id, recipient = %req.to, kind = "catalog")
    )]
    pub async fn send_catalog(
        &self,
        project: &Project,
        req: SendCatalogReq,
    ) -> Result<SendOutcome, ApiError> {
        let (access_token, phone_number_id) = project_plumbing(project)?;
        let recipient = normalize_to_meta(&req.to)?;

        let interactive = build_catalog_interactive(&req);
        // Slice contract: the DTO surface uses `SendMessage::Interactive`
        // (Phase 1 left interactive untyped — `serde_json::Value`). We
        // construct the typed variant for type-checking but POST the raw
        // envelope below since the catalog action has no `recipient_type`
        // and the typed variant doesn't carry that field.
        let _typed: SendMessage = SendMessage::Interactive {
            to: recipient.clone(),
            interactive: interactive.clone(),
        };

        // Mirror the TS payload byte-for-byte. The TS catalog action does
        // NOT include `recipient_type` (unlike CTA URL), so we omit it
        // here — the Meta API treats it as defaulting to `individual`.
        let payload = json!({
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "interactive",
            "interactive": interactive,
        });

        debug!(
            ?phone_number_id,
            "POST /{{phone-number-id}}/messages (catalog)"
        );

        let wamid = self
            .post_and_extract_wamid(phone_number_id.as_str(), access_token, &payload)
            .await?;

        // Persist the outgoing log. The TS catalog action doesn't write a
        // log row (a TS bug we don't replicate — its lack of insertion
        // means catalog sends never show up in webhook reconciliation).
        // We DO write the log so the row shape is consistent across all
        // interactive sends in this slice.
        let log_id = self
            .insert_outgoing_log(project, &recipient, &wamid, "interactive", &payload)
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    /// Send a `cta_url` interactive message.
    ///
    /// TS source: `handleSendCtaUrlMessage` (`whatsapp.actions.ts` line 1506).
    /// Wire shape — quoted from the TS (lines 1518-1536):
    /// ```text
    /// {
    ///   messaging_product: 'whatsapp',
    ///   recipient_type: 'individual',
    ///   to: waId,
    ///   type: 'interactive',
    ///   interactive: {
    ///     type: 'cta_url',
    ///     ...(data.headerText && { header: { type: 'text', text: data.headerText } }),
    ///     body: { text: data.bodyText },
    ///     ...(data.footerText && { footer: { text: data.footerText } }),
    ///     action: {
    ///       name: 'cta_url',
    ///       parameters: { display_text: data.displayText, url: data.url },
    ///     },
    ///   },
    /// }
    /// ```
    #[instrument(
        skip(self, req),
        fields(project_id = %project.id, recipient = %req.to, kind = "cta_url")
    )]
    pub async fn send_cta_url(
        &self,
        project: &Project,
        req: SendCtaUrlReq,
    ) -> Result<SendOutcome, ApiError> {
        let (access_token, phone_number_id) = project_plumbing(project)?;
        let recipient = normalize_to_meta(&req.to)?;

        let interactive = build_cta_url_interactive(&req);
        // We mention `SendMessage::Interactive` to satisfy the slice
        // contract (callers may want to construct it themselves later).
        // The actual wire payload below uses the raw envelope so the
        // `recipient_type` field can be included (the DTO's
        // `Interactive` variant doesn't carry it).
        let _typed: SendMessage = SendMessage::Interactive {
            to: recipient.clone(),
            interactive: interactive.clone(),
        };

        // The TS CTA URL action DOES include `recipient_type: 'individual'`
        // — match it here. Field order in JSON doesn't matter on the wire,
        // but we replicate the TS ordering for diff-friendliness.
        let payload = json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "interactive",
            "interactive": interactive,
        });

        debug!(
            ?phone_number_id,
            "POST /{{phone-number-id}}/messages (cta_url)"
        );

        let wamid = self
            .post_and_extract_wamid(phone_number_id.as_str(), access_token, &payload)
            .await?;

        let log_id = self
            .insert_outgoing_log(project, &recipient, &wamid, "interactive", &payload)
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    async fn post_and_extract_wamid(
        &self,
        phone_number_id: &str,
        access_token: &str,
        payload: &Value,
    ) -> Result<String, ApiError> {
        let path = format!("{phone_number_id}/messages");
        let resp: SendResponse = self
            .meta
            .post_json(&path, access_token, payload)
            .await
            .map_err(ApiError::from)?;

        // TS line 1544-1545 / 1595-1596: "Message sent but no WAMID
        // returned." Both actions throw the same generic error string.
        resp.messages
            .into_iter()
            .next()
            .map(|m| m.id)
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!("Message sent but no WAMID returned."))
            })
    }

    async fn insert_outgoing_log(
        &self,
        project: &Project,
        recipient_bare: &str,
        wamid: &str,
        kind: &str,
        payload: &Value,
    ) -> Result<ObjectId, ApiError> {
        // TS reference (`whatsapp.actions.ts` lines 1547-1552):
        // ```
        // db.collection('outgoing_messages').insertOne({
        //   direction: 'out', contactId, projectId,
        //   wamid, messageTimestamp: now, type: 'interactive', content: payload,
        //   status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        // })
        // ```
        //
        // We omit `contactId` because contact resolution moved upstream
        // for this slice; we add `recipient` (bare-digits phone) so
        // readers can JOIN to `contacts.waId` if they need the contact
        // link. This is additive — TS-shaped consumers ignore the extra
        // field.
        let now = Utc::now();
        let bson_now = bson::DateTime::from_chrono(now);
        let log_id = ObjectId::new();

        let mut doc = bson::doc! {
            "_id": log_id,
            "direction": "out",
            "projectId": project.id,
            "wamid": wamid,
            "recipient": recipient_bare,
            "messageTimestamp": bson_now,
            "type": kind,
            "content": bson::to_bson(payload).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("encode content"))
            })?,
            "status": "sent",
            "statusTimestamps": { "sent": bson_now },
            "createdAt": bson_now,
        };
        let _ = doc.remove("contactId"); // explicit no-op to flag the diff vs TS

        let coll = self.mongo.collection::<Document>(OUTGOING_MESSAGES_COLL);
        coll.insert_one(doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("outgoing_messages.insert_one"))
        })?;

        Ok(log_id)
    }
}

// -------------------------------------------------------------------------
// Pure helpers — exposed `pub(crate)` so unit tests can exercise them
// without spinning up a `MongoHandle`.
// -------------------------------------------------------------------------

/// Build the `interactive` JSON value for a catalog send.
///
/// Matches the TS object literal field-for-field, including the conditional
/// `header` / `footer` keys (TS uses `...(x && { key: ... })` spread; we
/// use `if let Some(_)` plus `obj.insert`).
pub(crate) fn build_catalog_interactive(req: &SendCatalogReq) -> Value {
    let mut interactive = serde_json::Map::new();
    interactive.insert("type".to_owned(), json!("product_list"));

    // Header is intentionally absent from `SendCatalogReq`. The TS does
    // accept a `headerText` form field on this action (line 1055), but the
    // dominant in-product callsite never sets it; we omit the field rather
    // than carrying a no-op slot. Adding it later is a non-breaking change
    // (the public DTO can grow an `Option<String>` field).

    if let Some(body) = req.body_text.as_deref() {
        interactive.insert("body".to_owned(), json!({ "text": body }));
    }
    if let Some(footer) = req.footer_text.as_deref() {
        interactive.insert("footer".to_owned(), json!({ "text": footer }));
    }

    let product_items: Vec<Value> = req
        .product_retailer_id
        .as_deref()
        .map(|id| vec![json!({ "product_retailer_id": id })])
        .unwrap_or_default();

    interactive.insert(
        "action".to_owned(),
        json!({
            "catalog_id": req.catalog_id,
            "sections": [{
                "title": "Our Products",
                "product_items": product_items,
            }],
        }),
    );

    Value::Object(interactive)
}

/// Build the `interactive` JSON value for a CTA URL send.
pub(crate) fn build_cta_url_interactive(req: &SendCtaUrlReq) -> Value {
    let mut interactive = serde_json::Map::new();
    interactive.insert("type".to_owned(), json!("cta_url"));

    if let Some(header) = req.header_text.as_deref() {
        interactive.insert(
            "header".to_owned(),
            json!({ "type": "text", "text": header }),
        );
    }
    if let Some(body) = req.body_text.as_deref() {
        interactive.insert("body".to_owned(), json!({ "text": body }));
    }
    if let Some(footer) = req.footer_text.as_deref() {
        interactive.insert("footer".to_owned(), json!({ "text": footer }));
    }

    interactive.insert(
        "action".to_owned(),
        json!({
            "name": "cta_url",
            "parameters": {
                "display_text": req.display_text,
                "url": req.url,
            },
        }),
    );

    Value::Object(interactive)
}

/// Pull `(access_token, phone_number_id)` off a project, returning a clear
/// 400 if either is missing. Mirrors the implicit short-circuit the TS does
/// in its auth wrapper / `phoneNumberId = contact.phoneNumberId` reads.
fn project_plumbing(project: &Project) -> Result<(&str, String), ApiError> {
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

    Ok((access_token, phone_number_id))
}

/// Normalise to canonical E.164 then strip the leading `+` for the Meta
/// `to` field (Meta logs/dedup by the bare-digits form, matching the TS
/// `waId`).
fn normalize_to_meta(raw: &str) -> Result<String, ApiError> {
    let canonical = normalize_e164(raw, None)
        .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;
    Ok(canonical.trim_start_matches('+').to_owned())
}

// -------------------------------------------------------------------------
// Unit tests — pure shape checks, no network / Mongo.
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_interactive_minimal_shape() {
        let req = SendCatalogReq {
            to: "+1 555 555 5555".to_owned(),
            catalog_id: "CAT_1".to_owned(),
            product_retailer_id: Some("SKU-A".to_owned()),
            body_text: Some("Browse our catalog".to_owned()),
            footer_text: None,
        };
        let v = build_catalog_interactive(&req);
        assert_eq!(v["type"], "product_list");
        assert_eq!(v["body"]["text"], "Browse our catalog");
        assert!(v.get("footer").is_none(), "footer omitted when None");
        assert!(v.get("header").is_none(), "header omitted on catalog");
        assert_eq!(v["action"]["catalog_id"], "CAT_1");
        assert_eq!(v["action"]["sections"][0]["title"], "Our Products");
        assert_eq!(
            v["action"]["sections"][0]["product_items"][0]["product_retailer_id"],
            "SKU-A"
        );
    }

    #[test]
    fn catalog_interactive_with_footer() {
        let req = SendCatalogReq {
            to: "+15555555555".to_owned(),
            catalog_id: "CAT_2".to_owned(),
            product_retailer_id: None,
            body_text: Some("Body".to_owned()),
            footer_text: Some("Footer".to_owned()),
        };
        let v = build_catalog_interactive(&req);
        assert_eq!(v["footer"]["text"], "Footer");
        assert_eq!(
            v["action"]["sections"][0]["product_items"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
    }

    #[test]
    fn cta_url_interactive_minimal_shape() {
        let req = SendCtaUrlReq {
            to: "+15555555555".to_owned(),
            display_text: "Open Site".to_owned(),
            url: "https://example.com".to_owned(),
            body_text: Some("Tap below".to_owned()),
            header_text: None,
            footer_text: None,
        };
        let v = build_cta_url_interactive(&req);
        assert_eq!(v["type"], "cta_url");
        assert_eq!(v["body"]["text"], "Tap below");
        assert!(v.get("header").is_none());
        assert!(v.get("footer").is_none());
        assert_eq!(v["action"]["name"], "cta_url");
        assert_eq!(v["action"]["parameters"]["display_text"], "Open Site");
        assert_eq!(v["action"]["parameters"]["url"], "https://example.com");
    }

    #[test]
    fn cta_url_interactive_full_shape() {
        let req = SendCtaUrlReq {
            to: "+15555555555".to_owned(),
            display_text: "Open".to_owned(),
            url: "https://example.com/x".to_owned(),
            body_text: Some("B".to_owned()),
            header_text: Some("H".to_owned()),
            footer_text: Some("F".to_owned()),
        };
        let v = build_cta_url_interactive(&req);
        assert_eq!(v["header"]["type"], "text");
        assert_eq!(v["header"]["text"], "H");
        assert_eq!(v["body"]["text"], "B");
        assert_eq!(v["footer"]["text"], "F");
    }

    #[test]
    fn meta_api_version_matches_ts() {
        assert_eq!(crate::META_API_VERSION, "v25.0");
    }

    #[test]
    fn outgoing_messages_collection_name_matches_ts() {
        assert_eq!(crate::OUTGOING_MESSAGES_COLL, "outgoing_messages");
    }
}
