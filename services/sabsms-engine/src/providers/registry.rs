//! Static provider registry.
//!
//! One adapter instance per provider, built lazily over a shared
//! `reqwest::Client`. Replaces the old `adapter_for(...)` factory —
//! both the send worker and the webhook dispatch resolve adapters here.

use once_cell::sync::Lazy;

use super::{gupshup::GupshupProvider, mock::MockProvider, msg91::Msg91Provider,
    telnyx::TelnyxProvider, twilio::TwilioProvider, SmsProvider};
use crate::types::ProviderId;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("building registry reqwest client")
});

static TWILIO: Lazy<TwilioProvider> = Lazy::new(|| TwilioProvider::new(HTTP.clone()));
static TELNYX: Lazy<TelnyxProvider> = Lazy::new(|| TelnyxProvider::new(HTTP.clone()));
static MSG91: Lazy<Msg91Provider> = Lazy::new(|| Msg91Provider::new(HTTP.clone()));
static GUPSHUP: Lazy<GupshupProvider> = Lazy::new(|| GupshupProvider::new(HTTP.clone()));
static MOCK: Lazy<MockProvider> = Lazy::new(MockProvider::new);

/// Resolve the adapter for a provider id. `None` for providers without
/// an engine implementation yet.
pub fn provider(id: ProviderId) -> Option<&'static dyn SmsProvider> {
    match id {
        ProviderId::Twilio => Some(&*TWILIO),
        ProviderId::Telnyx => Some(&*TELNYX),
        ProviderId::Msg91 => Some(&*MSG91),
        ProviderId::Gupshup => Some(&*GUPSHUP),
        ProviderId::Mock => Some(&*MOCK),
        _ => None,
    }
}

/// Provider ids with a live adapter (used by capability checks).
pub fn supported() -> &'static [ProviderId] {
    &[
        ProviderId::Twilio,
        ProviderId::Telnyx,
        ProviderId::Msg91,
        ProviderId::Gupshup,
        ProviderId::Mock,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_all_supported_providers() {
        for id in supported() {
            let adapter = provider(*id).expect("adapter must exist");
            assert_eq!(adapter.id(), *id);
        }
    }

    #[test]
    fn unsupported_providers_resolve_to_none() {
        assert!(provider(ProviderId::Vonage).is_none());
        assert!(provider(ProviderId::Plivo).is_none());
        assert!(provider(ProviderId::AwsSns).is_none());
    }
}
