use crate::{SmsProvider, SmsStatus};
use async_trait::async_trait;

/// Maps a MessageBird status string to the unified `SmsStatus` enum
pub fn map_messagebird_status(status: &str) -> SmsStatus {
    match status.to_lowercase().as_str() {
        "scheduled" => SmsStatus::Queued,
        "sent" => SmsStatus::Sent,
        "buffered" => SmsStatus::Sending,
        "delivered" => SmsStatus::Delivered,
        "delivery_failed" => SmsStatus::Failed,
        other => SmsStatus::Unknown(other.to_string()),
    }
}

pub struct MessageBirdProvider {
    pub access_key: String,
}

#[async_trait]
impl SmsProvider for MessageBirdProvider {
    async fn send_sms(&self, _to: &str, _from: &str, _body: &str) -> Result<String, String> {
        // Implementation for sending SMS via MessageBird API would go here
        Ok("mock_messagebird_id".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_messagebird_status() {
        assert_eq!(map_messagebird_status("scheduled"), SmsStatus::Queued);
        assert_eq!(map_messagebird_status("buffered"), SmsStatus::Sending);
        assert_eq!(map_messagebird_status("delivered"), SmsStatus::Delivered);
        assert_eq!(map_messagebird_status("delivery_failed"), SmsStatus::Failed);
        assert_eq!(
            map_messagebird_status("UNKNOWN_STATUS"),
            SmsStatus::Unknown("unknown_status".to_string())
        );
    }
}
