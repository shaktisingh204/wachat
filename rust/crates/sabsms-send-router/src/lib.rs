use chrono::Utc;
use sabsms_types::{SabsmsMessage, SabsmsMessageStatus, SendRequest};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum RouterError {
    #[error("No sender available in the pool")]
    NoSenderAvailable,
    #[error("No route available for destination")]
    NoRouteAvailable,
    #[error("Insufficient credits. Required: {required}, Available: {available}")]
    InsufficientCredits { required: f64, available: f64 },
    #[error("Database error: {0}")]
    DatabaseError(String),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Route {
    pub provider_name: String,
    pub cost: f64,
    pub priority: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutingStrategy {
    LeastCost,
    Priority,
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

#[async_trait::async_trait]
pub trait RouteResolver {
    /// Resolves available routes for a given destination
    async fn resolve_routes(&self, to: &str) -> Result<Vec<Route>, RouterError>;
}

pub struct SendRouter<P, C, M, R> {
    pool: P,
    credits: C,
    store: M,
    resolver: R,
    strategy: RoutingStrategy,
    cost_per_segment: f64,
}

impl<P, C, M, R> SendRouter<P, C, M, R>
where
    P: SenderPool + Send + Sync,
    C: CreditManager + Send + Sync,
    M: MessageStore + Send + Sync,
    R: RouteResolver + Send + Sync,
{
    pub fn new(
        pool: P,
        credits: C,
        store: M,
        resolver: R,
        strategy: RoutingStrategy,
        cost_per_segment: f64,
    ) -> Self {
        Self {
            pool,
            credits,
            store,
            resolver,
            strategy,
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

        // 2. Resolve and Select Route
        let mut routes = self.resolver.resolve_routes(&request.to).await?;
        if routes.is_empty() {
            return Err(RouterError::NoRouteAvailable);
        }

        match self.strategy {
            RoutingStrategy::LeastCost => {
                // Sort by cost ascending, then priority descending
                routes.sort_by(|a, b| {
                    a.cost
                        .partial_cmp(&b.cost)
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then_with(|| b.priority.cmp(&a.priority))
                });
            }
            RoutingStrategy::Priority => {
                // Sort by priority descending, then cost ascending
                routes.sort_by(|a, b| {
                    b.priority.cmp(&a.priority).then_with(|| {
                        a.cost
                            .partial_cmp(&b.cost)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                });
            }
        }
        let selected_route = routes.first().unwrap().clone();

        // 3. Estimate Segments & Cost
        let segments = estimate_segments(&request.body);
        // User is charged `cost_per_segment` but provider routing is based on `selected_route.cost`
        let user_cost = (segments as f64) * self.cost_per_segment;

        // 4. Check and Deduct Credits
        let available = self.credits.get_credits(user_id).await?;
        if available < user_cost {
            return Err(RouterError::InsufficientCredits {
                required: user_cost,
                available,
            });
        }
        self.credits.deduct_credits(user_id, user_cost).await?;

        // 5. Create Queued Message
        let now = Utc::now();
        let message = SabsmsMessage {
            id: Uuid::new_v4(),
            to: request.to,
            from,
            body: request.body,
            status: SabsmsMessageStatus::Pending,
            provider: Some(selected_route.provider_name),
            created_at: now,
            updated_at: now,
        };

        // 6. Write to DB
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    struct MockPool;
    #[async_trait::async_trait]
    impl SenderPool for MockPool {
        async fn resolve_sender(&self, _to: &str) -> Result<String, RouterError> {
            Ok("+1234567890".to_string())
        }
    }

    struct MockCredits;
    #[async_trait::async_trait]
    impl CreditManager for MockCredits {
        async fn get_credits(&self, _user_id: &str) -> Result<f64, RouterError> {
            Ok(100.0)
        }
        async fn deduct_credits(&self, _user_id: &str, _amount: f64) -> Result<(), RouterError> {
            Ok(())
        }
    }

    #[derive(Clone)]
    struct MockStore {
        saved: Arc<Mutex<Vec<SabsmsMessage>>>,
    }
    #[async_trait::async_trait]
    impl MessageStore for MockStore {
        async fn save_message(&self, message: &SabsmsMessage) -> Result<(), RouterError> {
            self.saved.lock().await.push(message.clone());
            Ok(())
        }
    }

    struct MockResolver;
    #[async_trait::async_trait]
    impl RouteResolver for MockResolver {
        async fn resolve_routes(&self, _to: &str) -> Result<Vec<Route>, RouterError> {
            Ok(vec![
                Route {
                    provider_name: "twilio".to_string(),
                    cost: 0.0075,
                    priority: 10,
                },
                Route {
                    provider_name: "bandwidth".to_string(),
                    cost: 0.0050,
                    priority: 5,
                },
                Route {
                    provider_name: "messagebird".to_string(),
                    cost: 0.0050,
                    priority: 8,
                },
            ])
        }
    }

    #[tokio::test]
    async fn test_least_cost_routing() {
        let store = MockStore {
            saved: Arc::new(Mutex::new(Vec::new())),
        };
        let router = SendRouter::new(
            MockPool,
            MockCredits,
            store.clone(),
            MockResolver,
            RoutingStrategy::LeastCost,
            0.01,
        );

        let req = SendRequest {
            to: "+0987654321".to_string(),
            from: "".to_string(),
            body: "Hello world".to_string(),
        };

        let msg = router.route_message("user_1", req).await.unwrap();
        assert_eq!(msg.provider.unwrap(), "messagebird"); // cost 0.0050, priority 8 vs bandwidth's priority 5

        let saved = store.saved.lock().await;
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].provider.as_deref(), Some("messagebird"));
    }

    #[tokio::test]
    async fn test_priority_routing() {
        let store = MockStore {
            saved: Arc::new(Mutex::new(Vec::new())),
        };
        let router = SendRouter::new(
            MockPool,
            MockCredits,
            store.clone(),
            MockResolver,
            RoutingStrategy::Priority,
            0.01,
        );

        let req = SendRequest {
            to: "+0987654321".to_string(),
            from: "".to_string(),
            body: "Hello world".to_string(),
        };

        let msg = router.route_message("user_1", req).await.unwrap();
        assert_eq!(msg.provider.unwrap(), "twilio"); // priority 10 is the highest

        let saved = store.saved.lock().await;
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].provider.as_deref(), Some("twilio"));
    }
}
