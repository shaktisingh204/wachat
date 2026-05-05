//! Request / response DTOs for [`crate::CtaSender`].
//!
//! Field shapes are picked to match the TS form-data payloads byte-for-byte
//! at the Meta wire layer. The TS resolves things like `contact.waId` and
//! `project.connectedCatalogId` server-side; we accept both as plain request
//! fields so the sender doesn't need to know about the `contacts` collection.

use bson::oid::ObjectId;

/// Input for [`crate::CtaSender::send_catalog`].
///
/// Field mapping vs `handleSendCatalogMessage` (`whatsapp.actions.ts`
/// lines 1052-1109):
///
/// | This field             | TS source                                       |
/// | ---------------------- | ----------------------------------------------- |
/// | `to`                   | `contact.waId` (resolved upstream from `contactId`) |
/// | `catalog_id`           | `project.connectedCatalogId`                    |
/// | `product_retailer_id`  | first / only entry of `productRetailerIds.split(',')` |
/// | `body_text`            | form-data `bodyText`                            |
/// | `footer_text`          | form-data `footerText` (optional)               |
///
/// The TS supports an arbitrary list of `productRetailerIds` joined into a
/// single section. This slice exposes a single optional id (the most common
/// case in the action callsite) and lets future revisions widen to a `Vec`
/// without breaking the DTO. When `product_retailer_id` is `None` the
/// `product_items` array is empty — the call still ships, mirroring the TS
/// edge case where `productRetailerIds` may be `['']`.
#[derive(Debug, Clone)]
pub struct SendCatalogReq {
    /// Recipient phone in any format `wachat_phone::normalize_e164` accepts.
    /// The sender canonicalises before passing to Meta.
    pub to: String,

    /// Meta catalog id (the value the TS reads from
    /// `project.connectedCatalogId`).
    pub catalog_id: String,

    /// Optional product retailer id to feature in the section. The TS sends
    /// every id from a comma-split form value; this slice exposes a single
    /// id which is the dominant in-product callsite.
    pub product_retailer_id: Option<String>,

    /// Optional `interactive.body.text`. The TS treats this as required at
    /// the form-validation layer (rejects empty `bodyText`); we keep it
    /// optional so the wire shape can omit it when callers explicitly pass
    /// `None`.
    pub body_text: Option<String>,

    /// Optional `interactive.footer.text`.
    pub footer_text: Option<String>,
}

/// Input for [`crate::CtaSender::send_cta_url`].
///
/// Field mapping vs `handleSendCtaUrlMessage` (`whatsapp.actions.ts`
/// lines 1506-1563):
///
/// | This field      | TS source                       |
/// | --------------- | ------------------------------- |
/// | `to`            | `waId` arg                      |
/// | `display_text`  | `data.displayText`              |
/// | `url`           | `data.url`                      |
/// | `body_text`     | `data.bodyText`                 |
/// | `header_text`   | `data.headerText` (optional)    |
/// | `footer_text`   | `data.footerText` (optional)    |
#[derive(Debug, Clone)]
pub struct SendCtaUrlReq {
    /// Recipient phone in any format `wachat_phone::normalize_e164` accepts.
    pub to: String,

    /// CTA button label (`interactive.action.parameters.display_text`).
    pub display_text: String,

    /// CTA target URL (`interactive.action.parameters.url`).
    pub url: String,

    /// Optional `interactive.body.text`. The TS treats this as required;
    /// kept optional here so the wire shape is faithful when omitted.
    pub body_text: Option<String>,

    /// Optional `interactive.header` text (TS only renders a `text` header).
    pub header_text: Option<String>,

    /// Optional `interactive.footer.text`.
    pub footer_text: Option<String>,
}

/// Result of a successful send.
///
/// Mirrors the two pieces of identity the TS persists / returns: the Mongo
/// `_id` of the new `outgoing_messages` row and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `outgoing_messages` document.
    pub message_log_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id`. Used as the
    /// correlation key for status webhooks.
    pub wamid: String,
}
