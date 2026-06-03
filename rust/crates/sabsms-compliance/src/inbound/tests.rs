use super::InboundInterceptor;
use crate::models::{MessageContext, MessageMetadata, OptStatus};
use crate::store::ComplianceStore;
use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;
use std::sync::Mutex;

struct MockStore {
    status: Mutex<OptStatus>,
}

impl MockStore {
    fn new() -> Self {
        Self {
            status: Mutex::new(OptStatus::None),
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
async fn test_stop_words_strict() {
    let store = Arc::new(MockStore::new());
    let interceptor = InboundInterceptor::new(store.clone());

    let cases = vec![
        ("STOP", true),
        ("stop", true),
        ("Stop.", true), // punctuation
        (" UNSUBSCRIBE ", true),
        ("cancel", true),
        ("quit!", true),
        ("end", true),
        ("STOPALL", true),
        ("Please stop", false),
        ("I want to unsubscribe", false),
        ("stop it", false),
        ("don't stop", false),
    ];

    for (content, expected) in cases {
        let ctx = MessageContext {
            from: "123".to_string(),
            to: "456".to_string(),
            content: content.to_string(),
            country_code: "US".to_string(),
            timestamp: Utc::now(),
            metadata: MessageMetadata::default(),
        };

        let result = interceptor.process_inbound(&ctx).await.unwrap();
        assert_eq!(result, expected, "Failed on content: '{}'", content);
    }
}
