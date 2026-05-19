//! AWS SES adapter — stub.
//!
//! Returns `NotImplemented` for now. Real SES wiring needs SigV4 signing
//! (or the `aws-sdk-sesv2` crate) which is a heavier dep we don't want
//! to pull until we have a tenant asking for it. The factory keeps SES
//! reachable so the UI can list it; the first real send surfaces a
//! clear error instead of silent fallback.

use anyhow::{Result, anyhow};
use async_trait::async_trait;

use crate::providers::{EmailProvider, OutboundMessage, ProviderReceipt};
use crate::settings::SesConfig;

pub struct SesProvider {
    #[allow(dead_code)]
    cfg: SesConfig,
}

impl SesProvider {
    pub fn new(cfg: SesConfig) -> Self {
        Self { cfg }
    }
}

#[async_trait]
impl EmailProvider for SesProvider {
    async fn send(&self, _msg: OutboundMessage) -> Result<ProviderReceipt> {
        Err(anyhow!(
            "SES provider is not implemented yet — wire `aws-sdk-sesv2` when needed"
        ))
    }
}
