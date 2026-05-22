use std::sync::Arc;
use regex::Regex;

use crate::error::Result;
use crate::models::{MessageContext, OptStatus};
use crate::store::ComplianceStore;

pub struct InboundInterceptor {
    store: Arc<dyn ComplianceStore>,
    stop_pattern: Regex,
    start_pattern: Regex,
}

impl InboundInterceptor {
    pub fn new(store: Arc<dyn ComplianceStore>) -> Self {
        Self {
            store,
            stop_pattern: Regex::new(r"(?i)^\s*(stop|unsubscribe|cancel|quit|end)\s*$").unwrap(),
            start_pattern: Regex::new(r"(?i)^\s*(start|unstop|yes)\s*$").unwrap(),
        }
    }

    /// Process an inbound message.
    /// Returns true if it was an intercept keyword (e.g., STOP/START), meaning
    /// it shouldn't be forwarded to the end-user application.
    pub async fn process_inbound(&self, ctx: &MessageContext) -> Result<bool> {
        let text = &ctx.content;

        if self.stop_pattern.is_match(text) {
            // Recipient (ctx.from) is opting out from Sender (ctx.to)
            self.store.update_opt_status(&ctx.from, Some(&ctx.to), OptStatus::OptedOut).await?;
            return Ok(true);
        }

        if self.start_pattern.is_match(text) {
            // Recipient (ctx.from) is opting in to Sender (ctx.to)
            self.store.update_opt_status(&ctx.from, Some(&ctx.to), OptStatus::OptedIn).await?;
            return Ok(true);
        }

        Ok(false)
    }
}
