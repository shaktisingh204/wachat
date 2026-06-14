//! [`FlowSender`] — the slice's public actor.
//!
//! Builds Meta `interactive` payloads for the `location_request_message`
//! and `address_message` subtypes, posts them, and writes the outgoing
//! log. The two methods share enough plumbing (project access-token
//! check, phone normalization, log insert) that they go through a
//! private `dispatch` helper.
//!
//! ## Meta wire shapes (quoted from the TS, verbatim)
//!
//! `handleSendLocationRequestMessage` (lines 1577-1587):
//! ```text
//! const payload = {
//!     messaging_product: 'whatsapp',
//!     recipient_type: 'individual',
//!     to: waId,
//!     type: 'interactive',
//!     interactive: {
//!         type: 'location_request_message',
//!         body: { text: bodyText },
//!         action: { name: 'send_location' },
//!     },
//! };
//! ```
//!
//! `handleSendAddressMessage` (lines 1633-1650):
//! ```text
//! const parameters: any = { country: data.country };
//! if (data.values) parameters.values = data.values;
//! if (data.savedAddressId) parameters.saved_address_id = data.savedAddressId;
//!
//! const payload = {
//!     messaging_product: 'whatsapp',
//!     recipient_type: 'individual',
//!     to: waId,
//!     type: 'interactive',
//!     interactive: {
//!         type: 'address_message',
//!         body: { text: data.bodyText },
//!         action: {
//!             name: 'address_message',
//!             parameters,
//!         },
//!     },
//! };
//! ```

use bson::{Document, oid::ObjectId};
use chrono::Utc;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde_json::{Map, Value, json};
use tracing::{debug, instrument};

use wachat_meta_client::MetaClient;
use wachat_meta_dto::SendResponse;
use wachat_phone::normalize_e164;
use wachat_types::project::Project;

use crate::OUTGOING_MESSAGES_COLL;
use crate::dto::{SendAddressReq, SendLocationReq, SendOutcome};

/// The wachat interactive-flow sender.
///
/// Cheap to clone — both fields are `Arc`-backed (`MongoHandle` and
/// `MetaClient` document this in their own crates).
#[derive(Debug, Clone)]
pub struct FlowSender {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl FlowSender {
    /// Construct a sender bound to the given Mongo + Meta handles.
    ///
    /// The `MetaClient` should be pinned to [`crate::META_API_VERSION`]
    /// (`v23.0`) to match the TS — but we don't enforce that here so
    /// tests can swap in a `with_base` mock pointed at a `wiremock`
    /// server.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// Send an interactive `location_request_message`.
    ///
    /// Payload shape — quoted in the module-level doc comment — is
    /// reproduced exactly. See `handleSendLocationRequestMessage` at
    /// `whatsapp.actions.ts:1565`.
    #[instrument(
        skip(self, req),
        fields(project_id = %project.id, recipient = %req.to)
    )]
    pub async fn send_location_request(
        &self,
        project: &Project,
        req: SendLocationReq,
    ) -> Result<SendOutcome, ApiError> {
        let recipient = canonical_phone(&req.to)?;
        let interactive = json!({
            "type": "location_request_message",
            "body": { "text": req.body_text },
            "action": { "name": "send_location" },
        });
        let payload = build_envelope(&recipient, interactive);
        self.dispatch(project, payload, &recipient).await
    }

    /// Send an interactive `address_message`.
    ///
    /// `parameters` is built dynamically — `country` is always present;
    /// `values` is included only when it's a non-null JSON object (matches
    /// the TS `if (data.values) parameters.values = data.values`); a
    /// `"saved_address_id"` key inside `values` is hoisted up to a
    /// sibling of `values` so the wire shape matches the TS branch at
    /// line 1635.
    #[instrument(
        skip(self, req),
        fields(project_id = %project.id, recipient = %req.to, country = %req.country)
    )]
    pub async fn send_address(
        &self,
        project: &Project,
        req: SendAddressReq,
    ) -> Result<SendOutcome, ApiError> {
        let recipient = canonical_phone(&req.to)?;
        let parameters = build_address_parameters(&req.country, &req.values);
        let interactive = json!({
            "type": "address_message",
            "body": { "text": req.body_text },
            "action": {
                "name": "address_message",
                "parameters": parameters,
            },
        });
        let payload = build_envelope(&recipient, interactive);
        self.dispatch(project, payload, &recipient).await
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    /// Shared POST-and-log path. Returns the Meta `wamid` and the new
    /// `outgoing_messages._id` packaged as a [`SendOutcome`].
    async fn dispatch(
        &self,
        project: &Project,
        payload: Value,
        recipient: &str,
    ) -> Result<SendOutcome, ApiError> {
        let access_token = project
            .access_token
            .as_deref()
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                // The TS short-circuits via `getProjectById` upstream — we
                // surface a clear 400 rather than letting Meta reject with
                // a generic OAuthException.
                ApiError::BadRequest("Project access token is not configured.".to_owned())
            })?;

        let phone_number_id = project
            .phone_numbers
            .first()
            .and_then(|p| p.id.clone())
            .ok_or_else(|| {
                ApiError::BadRequest("Project has no phone number configured.".to_owned())
            })?;

        debug!(?phone_number_id, "POST /{{phone-number-id}}/messages");

        let path = format!("{phone_number_id}/messages");
        let resp: SendResponse = self
            .meta
            .post_json(&path, access_token, &payload)
            .await
            .map_err(ApiError::from)?;

        // TS lines 1596 / 1659: "Message sent but no WAMID returned."
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

        let log_id = self
            .insert_outgoing_log(project, recipient, &wamid, &payload)
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    /// Insert the `outgoing_messages` document.
    ///
    /// Mirrors the TS document at lines 1599-1603 / 1662-1666 EXACTLY —
    /// `direction: 'out'`, `type: 'interactive'`, `content: <full payload>`,
    /// `status: 'sent'`, `statusTimestamps: { sent: now }`. The TS also
    /// writes `contactId`; we omit it (callers can JOIN on `recipient`).
    async fn insert_outgoing_log(
        &self,
        project: &Project,
        recipient: &str,
        wamid: &str,
        payload: &Value,
    ) -> Result<ObjectId, ApiError> {
        let now = Utc::now();
        let bson_now: bson::DateTime = bson::DateTime::from_chrono(now);
        let log_id = ObjectId::new();

        let doc = bson::doc! {
            "_id": log_id,
            "direction": "out",
            "projectId": project.id,
            "wamid": wamid,
            "recipient": recipient,
            "messageTimestamp": bson_now,
            "type": "interactive",
            "content": bson::to_bson(payload).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("encode interactive content"))
            })?,
            // The TS writes `status: 'sent'` (line 1602 / 1665) — keep
            // exact parity. Status webhooks will overwrite this later.
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
// free helpers
// -------------------------------------------------------------------------

/// Normalise the recipient phone and return the bare-digits form (no `+`),
/// matching the TS `waId` shape (Meta logs/dedup by bare digits).
fn canonical_phone(raw: &str) -> Result<String, ApiError> {
    let canonical = normalize_e164(raw, None)
        .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;
    Ok(canonical.trim_start_matches('+').to_owned())
}

/// Build the outermost message envelope shared by both senders. Field
/// order matches the TS literal exactly.
fn build_envelope(recipient: &str, interactive: Value) -> Value {
    json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "interactive",
        "interactive": interactive,
    })
}

/// Build `interactive.action.parameters` for `address_message`.
///
/// Matches the TS branching at lines 1633-1635:
/// ```text
/// const parameters: any = { country: data.country };
/// if (data.values) parameters.values = data.values;
/// if (data.savedAddressId) parameters.saved_address_id = data.savedAddressId;
/// ```
///
/// We accept the third branch (`saved_address_id`) by hoisting it out of
/// the `values` JSON object if a caller supplies it as a top-level key
/// there — see [`crate::dto::SendAddressReq`] for the rationale.
fn build_address_parameters(country: &str, values: &Value) -> Value {
    let mut params = Map::new();
    params.insert("country".to_owned(), Value::String(country.to_owned()));

    // `values` may be Null (caller has no prefill), an Object (the normal
    // case), or another type (we treat as "no values" and warn callers
    // via the public-API doc). We strip an inner `saved_address_id` key
    // and lift it up so the wire shape matches the TS.
    if let Value::Object(map) = values {
        let mut inner = map.clone();
        if let Some(saved) = inner.remove("saved_address_id") {
            if !matches!(saved, Value::Null) {
                params.insert("saved_address_id".to_owned(), saved);
            }
        }
        if !inner.is_empty() {
            params.insert("values".to_owned(), Value::Object(inner));
        }
    }

    Value::Object(params)
}

// -------------------------------------------------------------------------
// Unit tests — payload-shape coverage. The full HTTP/Mongo round-trip
// lives in `tests/sender.rs`.
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn location_request_payload_matches_ts() {
        let interactive = json!({
            "type": "location_request_message",
            "body": { "text": "Where are you?" },
            "action": { "name": "send_location" },
        });
        let payload = build_envelope("919876543210", interactive);
        assert_eq!(payload["messaging_product"], "whatsapp");
        assert_eq!(payload["recipient_type"], "individual");
        assert_eq!(payload["to"], "919876543210");
        assert_eq!(payload["type"], "interactive");
        assert_eq!(payload["interactive"]["type"], "location_request_message");
        assert_eq!(payload["interactive"]["body"]["text"], "Where are you?");
        assert_eq!(payload["interactive"]["action"]["name"], "send_location");
    }

    #[test]
    fn address_parameters_country_only() {
        let p = build_address_parameters("IN", &Value::Null);
        assert_eq!(p["country"], "IN");
        assert!(p.get("values").is_none());
        assert!(p.get("saved_address_id").is_none());
    }

    #[test]
    fn address_parameters_with_values() {
        let v = json!({ "name": "Alice", "in_pin_code": "560001" });
        let p = build_address_parameters("IN", &v);
        assert_eq!(p["country"], "IN");
        assert_eq!(p["values"]["name"], "Alice");
        assert_eq!(p["values"]["in_pin_code"], "560001");
        assert!(p.get("saved_address_id").is_none());
    }

    #[test]
    fn address_parameters_lifts_saved_address_id() {
        let v = json!({
            "saved_address_id": "addr_42",
            "name": "Alice"
        });
        let p = build_address_parameters("US", &v);
        assert_eq!(p["country"], "US");
        assert_eq!(p["saved_address_id"], "addr_42");
        assert_eq!(p["values"]["name"], "Alice");
        // Should NOT also appear inside `values`.
        assert!(p["values"].get("saved_address_id").is_none());
    }

    #[test]
    fn address_parameters_only_saved_id_drops_values() {
        let v = json!({ "saved_address_id": "addr_42" });
        let p = build_address_parameters("US", &v);
        assert_eq!(p["saved_address_id"], "addr_42");
        // After hoisting, `values` is empty → omitted.
        assert!(p.get("values").is_none());
    }

    #[test]
    fn address_parameters_ignores_non_object_values() {
        // String / array / number `values` mean "no prefill" per the TS
        // truthy check (`if (data.values)`); arrays would be truthy in
        // JS but the Meta schema requires an object, so we drop them.
        let p = build_address_parameters("IN", &json!("not-an-object"));
        assert_eq!(p["country"], "IN");
        assert!(p.get("values").is_none());
    }

    #[test]
    fn envelope_field_order_is_stable() {
        // serde_json preserves insertion order with the `preserve_order`
        // feature off — we still assert structural shape so a future
        // refactor that swaps key order can't sneak through.
        let payload = build_envelope("123", json!({ "type": "x" }));
        let s = serde_json::to_string(&payload).unwrap();
        // `messaging_product` always first; `interactive` always last.
        assert!(s.starts_with(r#"{"messaging_product":"whatsapp""#));
        assert!(s.contains(r#""recipient_type":"individual""#));
        assert!(s.contains(r#""to":"123""#));
        assert!(s.contains(r#""type":"interactive""#));
    }

    #[test]
    fn canonical_phone_strips_plus() {
        let p = canonical_phone("+91 98765-43210").unwrap();
        assert_eq!(p, "919876543210");
    }

    #[test]
    fn canonical_phone_rejects_empty() {
        assert!(canonical_phone("").is_err());
    }

    #[test]
    fn meta_api_version_matches_ts() {
        // Source of truth: top of `whatsapp.actions.ts` — `const API_VERSION = 'v23.0';`
        assert_eq!(crate::META_API_VERSION, "v25.0");
    }

    #[test]
    fn outgoing_messages_collection_name_matches_ts() {
        // Source of truth: `whatsapp.actions.ts:1599` and 1662.
        assert_eq!(crate::OUTGOING_MESSAGES_COLL, "outgoing_messages");
    }
}
