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
                self.store.update_last_run(campaign.id, now).await?;

                let resolver = self.resolver.clone();
                let enqueuer = self.enqueuer.clone();
                let campaign_clone = campaign.clone();

                tokio::spawn(async move {
                    if let Err(e) = run_campaign_task(campaign_clone, resolver, enqueuer).await {
                        error!("Campaign task failed: {}", e);
                    }
                });
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

        let last_run = campaign.last_run_at.unwrap_or(*now - chrono::Duration::minutes(1));
        
        if let Some(next_due) = schedule.after(&last_run).next() {
            if next_due <= *now {
                return true;
            }
        }

        false
    }
}

async fn run_campaign_task(
    campaign: Campaign,
    resolver: Arc<dyn SegmentResolver>,
    enqueuer: Arc<dyn QueueEnqueuer>,
) -> Result<()> {
    info!("Resolving segment {} for campaign {}", campaign.segment_id, campaign.id);
    let contacts = resolver.resolve_segment(campaign.segment_id).await?;
    
    info!("Found {} contacts for campaign {}", contacts.len(), campaign.id);

    let batch_size = if let Some(rate) = campaign.throttle_rate_per_sec {
        if rate > 0 {
            rate as usize
        } else {
            1000
        }
    } else {
        1000
    };

    let delay_between_batches = if campaign.throttle_rate_per_sec.unwrap_or(0) > 0 {
        Duration::from_secs(1)
    } else {
        Duration::from_millis(0)
    };

    for chunk in contacts.chunks(batch_size) {
        let mut jobs = Vec::with_capacity(chunk.len());
        for contact in chunk {
            jobs.push(SendJob {
                request: SendRequest {
                    to: contact.phone_number.clone(),
                    from: campaign.from_sender.clone(),
                    body: campaign.message_body.clone(),
                },
            });
        }

        if let Err(e) = enqueuer.enqueue_jobs(jobs).await {
            error!("Failed to enqueue jobs for campaign {}: {}", campaign.id, e);
        }

        if !delay_between_batches.is_zero() {
            sleep(delay_between_batches).await;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use chrono::{DateTime, Duration as ChronoDuration, Utc};
    use std::sync::Mutex;
    use uuid::Uuid;
    use crate::models::{Campaign, Contact};

    struct MockStore {
        campaigns: Mutex<Vec<Campaign>>,
        updated: Mutex<Vec<(Uuid, DateTime<Utc>)>>,
    }

    #[async_trait]
    impl CampaignStore for MockStore {
        async fn get_active_campaigns(&self) -> Result<Vec<Campaign>> {
            let campaigns = self.campaigns.lock().unwrap().clone();
            Ok(campaigns)
        }

        async fn update_last_run(&self, campaign_id: Uuid, last_run: DateTime<Utc>) -> Result<()> {
            self.updated.lock().unwrap().push((campaign_id, last_run));
            Ok(())
        }
    }

    struct MockResolver {
        contacts: Mutex<Vec<Contact>>,
    }

    #[async_trait]
    impl SegmentResolver for MockResolver {
        async fn resolve_segment(&self, _segment_id: Uuid) -> Result<Vec<Contact>> {
            let contacts = self.contacts.lock().unwrap().clone();
            Ok(contacts)
        }
    }

    struct MockEnqueuer {
        jobs: Mutex<Vec<SendJob>>,
        batches: Mutex<Vec<usize>>, // keep track of batch sizes
    }

    #[async_trait]
    impl QueueEnqueuer for MockEnqueuer {
        async fn enqueue_job(&self, job: SendJob) -> Result<()> {
            self.jobs.lock().unwrap().push(job);
            Ok(())
        }
        
        async fn enqueue_jobs(&self, jobs: Vec<SendJob>) -> Result<()> {
            self.batches.lock().unwrap().push(jobs.len());
            let mut all_jobs = self.jobs.lock().unwrap();
            all_jobs.extend(jobs);
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_run_campaign_task_batching() {
        let store = Arc::new(MockStore {
            campaigns: Mutex::new(vec![]),
            updated: Mutex::new(vec![]),
        });
        
        // 25 contacts total
        let mut contacts = vec![];
        for i in 0..25 {
            contacts.push(Contact {
                id: Uuid::new_v4(),
                phone_number: format!("+155500000{:02}", i),
            });
        }
        
        let resolver = Arc::new(MockResolver {
            contacts: Mutex::new(contacts),
        });
        
        let enqueuer = Arc::new(MockEnqueuer {
            jobs: Mutex::new(vec![]),
            batches: Mutex::new(vec![]),
        });
        
        let campaign = Campaign {
            id: Uuid::new_v4(),
            name: "Test Batch".into(),
            cron_expression: "* * * * *".into(),
            segment_id: Uuid::new_v4(),
            message_body: "Hello batch".into(),
            from_sender: "+10000000000".into(),
            is_active: true,
            last_run_at: None,
            throttle_rate_per_sec: Some(10), // Batch size 10
        };

        run_campaign_task(campaign, resolver, enqueuer.clone()).await.unwrap();

        let batches = enqueuer.batches.lock().unwrap().clone();
        assert_eq!(batches, vec![10, 10, 5]); // 25 contacts in batches of 10
        
        let total_jobs = enqueuer.jobs.lock().unwrap().len();
        assert_eq!(total_jobs, 25);
    }
    
    #[tokio::test]
    async fn test_tick_should_run() {
        // Just verify tick invokes updates and spawns
        let campaign_id = Uuid::new_v4();
        let store = Arc::new(MockStore {
            campaigns: Mutex::new(vec![
                Campaign {
                    id: campaign_id,
                    name: "Test Tick".into(),
                    cron_expression: "* * * * * * *".into(), // runs every second
                    segment_id: Uuid::new_v4(),
                    message_body: "Tick".into(),
                    from_sender: "+10".into(),
                    is_active: true,
                    // set last run to 2 minutes ago
                    last_run_at: Some(Utc::now() - ChronoDuration::minutes(2)),
                    throttle_rate_per_sec: None,
                }
            ]),
            updated: Mutex::new(vec![]),
        });
        
        let resolver = Arc::new(MockResolver {
            contacts: Mutex::new(vec![]),
        });
        
        let enqueuer = Arc::new(MockEnqueuer {
            jobs: Mutex::new(vec![]),
            batches: Mutex::new(vec![]),
        });
        
        let scheduler = CampaignScheduler::new(store.clone(), resolver, enqueuer);
        scheduler.tick().await.unwrap();
        
        // Wait a small amount for the spawned task
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        
        let updated = store.updated.lock().unwrap().clone();
        assert_eq!(updated.len(), 1);
        assert_eq!(updated[0].0, campaign_id);
    }
}
