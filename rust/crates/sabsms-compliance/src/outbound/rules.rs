use async_trait::async_trait;
use chrono::{DateTime, Timelike, Utc};
use regex::Regex;
use std::sync::Arc;

use crate::error::{ComplianceError, Result};
use crate::models::{MessageContext, OptStatus};
use crate::store::ComplianceStore;

#[async_trait]
pub trait ComplianceRule: Send + Sync {
    async fn evaluate(&self, ctx: &MessageContext, store: Arc<dyn ComplianceStore>) -> Result<()>;
}

/// 10DLC Rule (US/CA)
/// Checks for forbidden content (e.g., SHAFT - Sex, Hate, Alcohol, Firearms, Tobacco)
pub struct TenDlcRule {
    forbidden_pattern: Regex,
}

impl TenDlcRule {
    pub fn new() -> Self {
        Self {
            forbidden_pattern: Regex::new(r"(?i)(cbd|vape|firearm|casino|sex)").unwrap(),
        }
    }
}

#[async_trait]
impl ComplianceRule for TenDlcRule {
    async fn evaluate(&self, ctx: &MessageContext, _store: Arc<dyn ComplianceStore>) -> Result<()> {
        if ctx.country_code != "US" && ctx.country_code != "CA" {
            return Ok(());
        }

        if self.forbidden_pattern.is_match(&ctx.content) {
            return Err(ComplianceError::TenDlcViolation(
                "Message contains forbidden SHAFT keywords.".to_string(),
            ));
        }

        Ok(())
    }
}

/// DLT Rule (India)
/// Requires entity ID and template ID for commercial communication
pub struct DltRule;

#[async_trait]
impl ComplianceRule for DltRule {
    async fn evaluate(&self, ctx: &MessageContext, _store: Arc<dyn ComplianceStore>) -> Result<()> {
        if ctx.country_code != "IN" {
            return Ok(());
        }

        if ctx.metadata.dlt_entity_id.is_none() {
            return Err(ComplianceError::DltViolation(
                "Missing DLT Entity ID for Indian recipient.".to_string(),
            ));
        }

        if ctx.metadata.dlt_template_id.is_none() {
            return Err(ComplianceError::DltViolation(
                "Missing DLT Template ID for Indian recipient.".to_string(),
            ));
        }

        Ok(())
    }
}

/// TCPA / GDPR Time-of-Day and Opt-out Rules
pub struct TcpaGdprRule;

impl TcpaGdprRule {
    fn is_quiet_hours(&self, timestamp: DateTime<Utc>, country_code: &str) -> bool {
        // Strict TCPA quiet hours: Before 8 AM or after 9 PM.
        let hour = timestamp.hour();

        if country_code == "US" {
            // Simplified check based on UTC (assuming EST - 5 hours)
            // 9 PM EST = 2 AM UTC next day
            // 8 AM EST = 1 PM UTC
            // So quiet hours in UTC for EST are 2 AM (02:00) to 1 PM (13:00)
            if hour >= 2 && hour < 13 {
                return true;
            }
        }

        false
    }

    fn is_eu(&self, country_code: &str) -> bool {
        let eu = [
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
            "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB",
        ];
        eu.contains(&country_code)
    }
}

#[async_trait]
impl ComplianceRule for TcpaGdprRule {
    async fn evaluate(&self, ctx: &MessageContext, store: Arc<dyn ComplianceStore>) -> Result<()> {
        // Check Opt-out status first
        let status = store.check_opt_status(&ctx.to, Some(&ctx.from)).await?;
        if status == OptStatus::OptedOut {
            return Err(ComplianceError::OptedOut);
        }

        // Strict GDPR: Opt-in required for promotional messages to EU
        if ctx.metadata.is_promotional && self.is_eu(&ctx.country_code) {
            if status != OptStatus::OptedIn {
                return Err(ComplianceError::TcpaGdprViolation(
                    "Strict GDPR: Explicit opt-in required for promotional messages in EU."
                        .to_string(),
                ));
            }
        }

        // Time-of-day checks for promotional messages
        if ctx.metadata.is_promotional && self.is_quiet_hours(ctx.timestamp, &ctx.country_code) {
            return Err(ComplianceError::TcpaGdprViolation(
                "Message blocked due to quiet hours restrictions.".to_string(),
            ));
        }

        Ok(())
    }
}
