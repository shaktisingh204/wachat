use crate::error::Result;
use crate::models::OptStatus;
use async_trait::async_trait;

#[async_trait]
pub trait ComplianceStore: Send + Sync {
    /// Check if a recipient has opted out for a specific sender or overall
    async fn check_opt_status(&self, phone_number: &str, sender: Option<&str>)
        -> Result<OptStatus>;

    /// Update the opt-status (e.g. when STOP or START is received)
    async fn update_opt_status(
        &self,
        phone_number: &str,
        sender: Option<&str>,
        status: OptStatus,
    ) -> Result<()>;
}
