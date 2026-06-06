//! # External seam — Google Contacts + Shopify Customers sync
//!
//! This is the **only** module in the crate that reaches toward a
//! third-party network boundary, and it is deliberately written so the
//! crate compiles and routes with **no live credentials** and **no
//! third-party SDKs**.
//!
//! ## Isolation contract
//!
//! - The CSV export and the vCard sync are 100% local and live in
//!   [`crate::handlers`]; they never touch this module.
//! - The Google / Shopify paths first look for stored OAuth /
//!   integration credentials on the project document. If the credentials
//!   are **absent** (the current state — nothing provisions them yet)
//!   the call **degrades to a typed [`ApiError::BadRequest`]** with a
//!   "<Provider> not connected" message. No socket is opened.
//! - When credentials *are* eventually present, the actual HTTP call to
//!   the provider would be added here — and only here. It MUST map any
//!   transport / decode failure to [`ApiError::Internal`] or
//!   [`ApiError::BadRequest`]; it MUST NEVER `panic!`, `unwrap`, or
//!   `expect` a network result. That single rule keeps a flaky provider
//!   from taking the whole API process down.
//!
//! Keeping the seam in its own file means the rest of the crate has zero
//! knowledge of provider auth — swapping in a real Google People API /
//! Shopify Admin API client is a localized change.

use bson::Document;
use sabnode_common::{ApiError, Result};

/// External contact-sync providers this seam knows about.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Google,
    Shopify,
}

impl Provider {
    /// Display name used in the "<Provider> not connected" degradation
    /// message.
    fn label(self) -> &'static str {
        match self {
            Provider::Google => "Google",
            Provider::Shopify => "Shopify",
        }
    }

    /// Field on the project document that would hold the provider's
    /// stored credential bundle, if one had been provisioned.
    ///
    /// These are read-only probes — we never *write* credentials here,
    /// and the absence of the field is the normal, expected state today.
    fn credential_field(self) -> &'static str {
        match self {
            // Google People API OAuth refresh token, stored by the
            // (not-yet-built) OAuth callback flow.
            Provider::Google => "googleContactsAuth",
            // Shopify Admin API access token + shop domain, stored by
            // Settings > Integrations.
            Provider::Shopify => "shopifyIntegration",
        }
    }
}

/// A normalized contact row pulled from an external provider, ready to be
/// upserted into the local `contacts` collection by the caller.
///
/// (Defined here so that when a real provider client is added, it can
/// return this shape without the handler module needing to learn the
/// provider's wire format.)
#[derive(Debug, Clone)]
pub struct ExternalContact {
    /// Display name (maps to `name`).
    pub name: String,
    /// Digits-only phone, used to derive the `waId` upsert key.
    pub phone: String,
}

/// Fetch contacts from an external `provider` for the given `project`.
///
/// ## Degradation (the whole point of this seam)
///
/// The project document is inspected for the provider's stored
/// credential bundle. Because no flow provisions those credentials yet,
/// this **always** returns
/// `Err(ApiError::BadRequest("<Provider> not connected"))` — a typed,
/// non-panicking failure the HTTP layer renders as a clean 400. No
/// network call is attempted and no provider SDK is linked.
///
/// When credentials are later provisioned, the real provider HTTP call
/// goes *inside the `Some(_)` arm below* and must map every transport
/// error to [`ApiError::Internal`] / [`ApiError::BadRequest`] — never
/// unwrap a network result.
pub fn fetch_external_contacts(
    provider: Provider,
    project: &Document,
) -> Result<Vec<ExternalContact>> {
    let credentials = project.get(provider.credential_field());

    // `None` (field absent) OR `Some(Bson::Null)` both mean "not
    // connected". We treat anything that is not a populated value as
    // unconnected and degrade gracefully.
    let connected = matches!(credentials, Some(v) if !matches!(v, bson::Bson::Null));

    if !connected {
        return Err(ApiError::BadRequest(format!(
            "{} not connected",
            provider.label()
        )));
    }

    // NOTE: This arm is currently unreachable in production because no
    // flow provisions credentials. It is left as a typed placeholder so
    // the contract is explicit: a real implementation performs the
    // provider HTTP call HERE and maps any error to a typed `ApiError`,
    // never unwrapping a network result. We return `BadRequest` (rather
    // than a fake success) so we never fabricate contacts from a
    // half-configured integration.
    Err(ApiError::BadRequest(format!(
        "{} sync is not available yet",
        provider.label()
    )))
}
