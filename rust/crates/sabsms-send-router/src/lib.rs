use chrono::Utc;
use sabsms_types::{SabsmsMessage, SabsmsMessageStatus, SendRequest};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum RouterError {
    #[error("No sender available in the pool")]
    NoSenderAvailable,
    #[error("Insufficient credits. Required: {required}, Available: {available}")]
    InsufficientCredits { required: f64, available: f64 },
    #[error("Database error: {0}")]
    DatabaseError(String),
}

#[async_trait::async_trait]
pub trait SenderPool {
    /// Resolves the sender ID (from) based on pool settings or sticky sender
    async fn resolve_sender(&self, to: &str) -> Result<String, RouterError>;
}

#[async_trait::async_trait]
pub trait CreditManager {
    /// Gets the available credits for the user
    async fn get_credits(&self, user_id: &str) -> Result<f64, RouterError>;
    /// Deducts credits from the user's account
    async fn deduct_credits(&self, user_id: &str, amount: f64) -> Result<(), RouterError>;
}

#[async_trait::async_trait]
pub trait MessageStore {
    /// Writes the queued message to the database
    async fn save_message(&self, message: &SabsmsMessage) -> Result<(), RouterError>;
}

pub struct SendRouter<P, C, M> {
    pool: P,
    credits: C,
    store: M,
    cost_per_segment: f64,
}

impl<P, C, M> SendRouter<P, C, M>
where
    P: SenderPool + Send + Sync,
    C: CreditManager + Send + Sync,
    M: MessageStore + Send + Sync,
{
    pub fn new(pool: P, credits: C, store: M, cost_per_segment: f64) -> Self {
        Self {
            pool,
            credits,
            store,
            cost_per_segment,
        }
    }

    pub async fn route_message(
        &self,
        user_id: &str,
        request: SendRequest,
    ) -> Result<SabsmsMessage, RouterError> {
        // 1. Resolve Sender
        let from = if request.from.is_empty() {
            self.pool.resolve_sender(&request.to).await?
        } else {
            request.from.clone()
        };

        // 2. Estimate Segments & Cost
        let segments = estimate_segments(&request.body);
        let cost = (segments as f64) * self.cost_per_segment;

        // 3. Check and Deduct Credits
        let available = self.credits.get_credits(user_id).await?;
        if available < cost {
            return Err(RouterError::InsufficientCredits {
                required: cost,
                available,
            });
        }
        self.credits.deduct_credits(user_id, cost).await?;

        // 4. Create Queued Message
        let now = Utc::now();
        let message = SabsmsMessage {
            id: Uuid::new_v4(),
            to: request.to,
            from,
            body: request.body,
            status: SabsmsMessageStatus::Pending,
            created_at: now,
            updated_at: now,
        };

        // 5. Write to DB
        self.store.save_message(&message).await?;

        Ok(message)
    }
}

/// Simple segment estimator. 
/// In real scenarios, needs GSM-7 / UCS-2 detection.
pub fn estimate_segments(body: &str) -> usize {
    let chars = body.chars().count();
    if chars == 0 {
        return 1;
    }
    // Assuming GSM-7 basic estimation
    if chars <= 160 {
        1
    } else {
        (chars as f64 / 153.0).ceil() as usize
    }
}
