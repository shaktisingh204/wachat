pub mod twilio;
pub mod bandwidth;
pub mod messagebird;

use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SmsStatus {
    Queued,
    Sending,
    Sent,
    Delivered,
    Failed,
    Undelivered,
    Receiving,
    Received,
    Read,
    Unknown(String),
}

#[async_trait]
pub trait SmsProvider: Send + Sync {
    async fn send_sms(&self, to: &str, from: &str, body: &str) -> Result<String, String>;
    
    // Additional generic methods could be added here
}
