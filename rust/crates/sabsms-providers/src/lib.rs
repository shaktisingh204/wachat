pub mod twilio;

use async_trait::async_trait;

#[async_trait]
pub trait SmsProvider: Send + Sync {
    async fn send_sms(&self, to: &str, from: &str, body: &str) -> Result<String, String>;
    
    // Additional generic methods could be added here
}
