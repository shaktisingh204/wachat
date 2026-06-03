pub mod rules;

#[cfg(test)]
mod tests;

use self::rules::{ComplianceRule, DltRule, TcpaGdprRule, TenDlcRule};
use crate::error::Result;
use crate::models::MessageContext;
use crate::store::ComplianceStore;
use std::sync::Arc;

pub struct OutboundEngine {
    rules: Vec<Box<dyn ComplianceRule>>,
    store: Arc<dyn ComplianceStore>,
}

impl OutboundEngine {
    pub fn new(store: Arc<dyn ComplianceStore>) -> Self {
        Self {
            rules: vec![
                Box::new(TenDlcRule::new()),
                Box::new(DltRule),
                Box::new(TcpaGdprRule),
            ],
            store,
        }
    }

    pub fn with_rule(mut self, rule: Box<dyn ComplianceRule>) -> Self {
        self.rules.push(rule);
        self
    }

    pub async fn check_message(&self, ctx: &MessageContext) -> Result<()> {
        for rule in &self.rules {
            rule.evaluate(ctx, Arc::clone(&self.store)).await?;
        }
        Ok(())
    }
}
