use super::rules::{ComplianceRule, TcpaGdprRule};
use crate::models::{MessageContext, MessageMetadata, OptStatus};
use crate::store::ComplianceStore;
use async_trait::async_trait;
use chrono::{TimeZone, Utc};
use std::sync::Arc;
use std::sync::Mutex;

struct MockStore {
    status: Mutex<OptStatus>,
}

impl MockStore {
    fn new(status: OptStatus) -> Self {
        Self {
            status: Mutex::new(status),
        }
    }
}

#[async_trait]
impl ComplianceStore for MockStore {
    async fn check_opt_status(
        &self,
        _phone_number: &str,
        _sender: Option<&str>,
    ) -> crate::error::Result<OptStatus> {
        Ok(self.status.lock().unwrap().clone())
    }

    async fn update_opt_status(
        &self,
        _phone_number: &str,
        _sender: Option<&str>,
        status: OptStatus,
    ) -> crate::error::Result<()> {
        *self.status.lock().unwrap() = status;
        Ok(())
    }
}

#[tokio::test]
async fn test_tcpa_gdpr_opt_out() {
    let store = Arc::new(MockStore::new(OptStatus::OptedOut));
    let rule = TcpaGdprRule;

    let ctx = MessageContext {
        from: "123".to_string(),
        to: "456".to_string(),
        content: "Hello".to_string(),
        country_code: "US".to_string(),
        timestamp: Utc::now(),
        metadata: MessageMetadata::default(),
    };

    let result = rule.evaluate(&ctx, store).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err().to_string(),
        "Recipient has opted out (Suppression list)"
    );
}

#[tokio::test]
async fn test_tcpa_gdpr_quiet_hours() {
    let store = Arc::new(MockStore::new(OptStatus::OptedIn));
    let rule = TcpaGdprRule;

    // Test quiet hours (2 AM UTC which is 9 PM EST)
    let quiet_time = Utc.with_ymd_and_hms(2023, 1, 1, 4, 0, 0).unwrap();

    let ctx = MessageContext {
        from: "123".to_string(),
        to: "456".to_string(),
        content: "Promo".to_string(),
        country_code: "US".to_string(),
        timestamp: quiet_time,
        metadata: MessageMetadata {
            is_promotional: true,
            ..Default::default()
        },
    };

    let result = rule.evaluate(&ctx, store).await;
    assert!(result.is_err());
    assert_eq!(
        result.unwrap_err().to_string(),
        "Message violates TCPA/GDPR rules: Message blocked due to quiet hours restrictions."
    );
}

#[tokio::test]
async fn test_gdpr_strict_opt_in() {
    let store = Arc::new(MockStore::new(OptStatus::None)); // Not explicitly opted in
    let rule = TcpaGdprRule;

    let ctx = MessageContext {
        from: "123".to_string(),
        to: "456".to_string(),
        content: "Promo EU".to_string(),
        country_code: "FR".to_string(), // France is EU
        timestamp: Utc::now(),
        metadata: MessageMetadata {
            is_promotional: true,
            ..Default::default()
        },
    };

    let result = rule.evaluate(&ctx, store).await;
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Message violates TCPA/GDPR rules: Strict GDPR: Explicit opt-in required for promotional messages in EU.");
}
