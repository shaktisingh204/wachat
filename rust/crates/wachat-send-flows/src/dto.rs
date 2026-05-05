//! Request / response DTOs for [`crate::FlowSender`].
//!
//! Mirrors the `data` parameters of the two TS actions in
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! | This DTO          | TS action                                   |
//! | ----------------- | ------------------------------------------- |
//! | [`SendLocationReq`] | `handleSendLocationRequestMessage` (1565) |
//! | [`SendAddressReq`]  | `handleSendAddressMessage` (1616)         |
//!
//! The TS resolves the recipient phone by looking up the `Contact` in
//! Mongo and reading `contact.waId`. We push that responsibility upstream
//! and accept a phone string directly in the `to` field — keeps the
//! sender free of the contact-collection concern (which lives in the
//! `wachat-webhook-contacts` / future `wachat-contacts` slice).

use bson::oid::ObjectId;
use serde_json::Value;

/// Caller-supplied input for `interactive.type = "location_request_message"`.
///
/// Field mapping vs `handleSendLocationRequestMessage`'s arguments
/// (`whatsapp.actions.ts` lines 1565-1571):
///
/// | This field   | TS arg     |
/// | ------------ | ---------- |
/// | `to`         | `waId`     |
/// | `body_text`  | `bodyText` |
#[derive(Debug, Clone)]
pub struct SendLocationReq {
    /// Recipient phone in any format `wachat_phone::normalize_e164`
    /// accepts. The sender will canonicalize it before passing to Meta.
    /// Meta accepts both `+CC...` and bare-digits forms; we send the
    /// bare-digits form to match the TS `waId` exactly.
    pub to: String,

    /// Body text shown above the "Send location" button. Becomes
    /// `interactive.body.text` in the Meta payload.
    pub body_text: String,
}

/// Caller-supplied input for `interactive.type = "address_message"`.
///
/// Field mapping vs `handleSendAddressMessage`'s `data` parameter
/// (`whatsapp.actions.ts` lines 1620-1626):
///
/// | This field    | TS `data` key       |
/// | ------------- | ------------------- |
/// | `to`          | `waId`              |
/// | `body_text`   | `data.bodyText`     |
/// | `country`     | `data.country`      |
/// | `values`      | `data.values`       |
///
/// `saved_address_id` (the third TS branch) is not surfaced on this DTO
/// — it's an MVP-3 feature the TS supports but the SabNode UI doesn't
/// actually wire up. Callers who need it can pass it via the `values`
/// JSON object using the literal key `"saved_address_id"` and the
/// sender will hoist it into `parameters` (see [`crate::sender`]).
#[derive(Debug, Clone)]
pub struct SendAddressReq {
    /// Recipient phone (see [`SendLocationReq::to`]).
    pub to: String,

    /// Body text shown above the address form. Becomes
    /// `interactive.body.text` in the Meta payload.
    pub body_text: String,

    /// ISO-3166 alpha-2 country code (e.g. `"IN"`, `"US"`). Becomes
    /// `interactive.action.parameters.country`.
    pub country: String,

    /// Pre-filled address fields per Meta's `address_message` schema —
    /// `name`, `phone_number`, `in_pin_code`, `house_number`, `tower_number`,
    /// `building_name`, `address`, `landmark_area`, `city`, etc. The
    /// shape varies per `country`. Passed through as
    /// `interactive.action.parameters.values` verbatim. Use
    /// [`serde_json::Value::Null`] (or omit the field at the JSON layer)
    /// for an empty form.
    pub values: Value,
}

/// Result of a successful send.
///
/// Mirrors the two pieces of identity the TS persists / returns: the
/// Mongo `_id` of the new `outgoing_messages` row and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `outgoing_messages` document.
    pub message_log_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id`. Used as the
    /// correlation key for status webhooks.
    pub wamid: String,
}
