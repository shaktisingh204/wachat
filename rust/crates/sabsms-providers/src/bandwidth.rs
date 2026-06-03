use crate::{SmsProvider, SmsStatus};
use async_trait::async_trait;

/// Maps a Bandwidth status string to the unified `SmsStatus` enum
pub fn map_bandwidth_status(status: &str) -> SmsStatus {
    match status.to_lowercase().as_str() {
        "queued" => SmsStatus::Queued,
        "sending" => SmsStatus::Sending,
        "sent" => SmsStatus::Sent,
        "delivered" => SmsStatus::Delivered,
        "failed" => SmsStatus::Failed,
        "undelivered" => SmsStatus::Undelivered,
        other => SmsStatus::Unknown(other.to_string()),
    }
}

pub struct BandwidthProvider {
    pub account_id: String,
    pub api_user: String,
    pub api_password: String,
    pub messaging_application_id: String,
}

#[async_trait]
impl SmsProvider for BandwidthProvider {
    async fn send_sms(&self, _to: &str, _from: &str, _body: &str) -> Result<String, String> {
        // Implementation for sending SMS via Bandwidth API would go here
        Ok("mock_bandwidth_message_id".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_bandwidth_status() {
        assert_eq!(map_bandwidth_status("Queued"), SmsStatus::Queued);
        assert_eq!(map_bandwidth_status("Delivered"), SmsStatus::Delivered);
        assert_eq!(map_bandwidth_status("failed"), SmsStatus::Failed);
        assert_eq!(
            map_bandwidth_status("UNKNOWN_STATUS"),
            SmsStatus::Unknown("unknown_status".to_string())
        );
    }
}
