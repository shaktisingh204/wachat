use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::models::{Campaign, Contact};

#[async_trait]
pub trait CampaignStore: Send + Sync {
    /// Fetch all active campaigns that might need scheduling
    async fn get_active_campaigns(&self) -> Result<Vec<Campaign>>;

    /// Update the last run time of a campaign
    async fn update_last_run(&self, campaign_id: Uuid, last_run: DateTime<Utc>) -> Result<()>;
}

#[async_trait]
pub trait SegmentResolver: Send + Sync {
    /// Resolve a segment into a list of contacts
    async fn resolve_segment(&self, segment_id: Uuid) -> Result<Vec<Contact>>;
}
