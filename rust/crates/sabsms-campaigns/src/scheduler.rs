use anyhow::Result;
use chrono::Utc;
use cron::Schedule;
use std::str::FromStr;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::{error, info};

use crate::enqueuer::{QueueEnqueuer, SendJob};
use crate::models::Campaign;
use crate::store::{CampaignStore, SegmentResolver};
use sabsms_types::SendRequest;

pub struct CampaignScheduler {
    store: Arc<dyn CampaignStore>,
    resolver: Arc<dyn SegmentResolver>,
    enqueuer: Arc<dyn QueueEnqueuer>,
}

impl CampaignScheduler {
    pub fn new(
        store: Arc<dyn CampaignStore>,
        resolver: Arc<dyn SegmentResolver>,
        enqueuer: Arc<dyn QueueEnqueuer>,
    ) -> Self {
        Self {
            store,
            resolver,
            enqueuer,
        }
    }

    pub async fn start(&self) -> Result<()> {
        info!("Starting campaign scheduler...");
        loop {
            if let Err(e) = self.tick().await {
                error!("Error during scheduler tick: {}", e);
            }
            // Sleep before next tick. For cron-based, checking every minute is usually enough,
            // but we can check every 10 seconds for higher precision.
            sleep(Duration::from_secs(10)).await;
        }
    }

    async fn tick(&self) -> Result<()> {
        let campaigns = self.store.get_active_campaigns().await?;
        let now = Utc::now();

        for campaign in campaigns {
            if self.should_run(&campaign, &now) {
                info!("Campaign {} is due to run", campaign.id);
                self.run_campaign(&campaign).await?;
                self.store.update_last_run(campaign.id, now).await?;
            }
        }

        Ok(())
    }

    fn should_run(&self, campaign: &Campaign, now: &chrono::DateTime<Utc>) -> bool {
        let schedule = match Schedule::from_str(&campaign.cron_expression) {
            Ok(s) => s,
            Err(e) => {
                error!("Invalid cron expression for campaign {}: {}", campaign.id, e);
                return false;
            }
        };

        // If it never ran, find the most recent past event. Wait, usually for a new campaign 
        // we start from now. But let's keep it simple: find the last scheduled time before now.
        // If the last scheduled time is after the last_run_at, we should run it.
        // Because cron schedules are infinite, we check `after(last_run_at)`.
        
        let last_run = campaign.last_run_at.unwrap_or(*now - chrono::Duration::minutes(1));
        
        if let Some(next_due) = schedule.after(&last_run).next() {
            if next_due <= *now {
                return true;
            }
        }

        false
    }

    async fn run_campaign(&self, campaign: &Campaign) -> Result<()> {
        info!("Resolving segment {} for campaign {}", campaign.segment_id, campaign.id);
        let contacts = self.resolver.resolve_segment(campaign.segment_id).await?;
        
        info!("Found {} contacts for campaign {}", contacts.len(), campaign.id);

        let delay_ms = match campaign.throttle_rate_per_sec {
            Some(rate) if rate > 0 => 1000 / rate,
            _ => 0,
        };

        for contact in contacts {
            let job = SendJob {
                request: SendRequest {
                    to: contact.phone_number,
                    from: campaign.from_sender.clone(),
                    body: campaign.message_body.clone(),
                },
            };

            if let Err(e) = self.enqueuer.enqueue_job(job).await {
                error!("Failed to enqueue job for campaign {}: {}", campaign.id, e);
            }

            if delay_ms > 0 {
                sleep(Duration::from_millis(delay_ms as u64)).await;
            }
        }

        Ok(())
    }
}
