use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{DunningPolicy, Invoice, PaymentMethod, SubscriptionTier, UsageRecord};

#[derive(Clone, Default)]
pub struct MockDb {
    pub tiers: Arc<RwLock<HashMap<Uuid, SubscriptionTier>>>,
    pub invoices: Arc<RwLock<HashMap<Uuid, Invoice>>>,
    pub usages: Arc<RwLock<HashMap<Uuid, UsageRecord>>>,
    pub payment_methods: Arc<RwLock<HashMap<Uuid, PaymentMethod>>>,
    pub policies: Arc<RwLock<HashMap<Uuid, DunningPolicy>>>,
}

impl MockDb {
    pub fn new() -> Self {
        Self {
            tiers: Arc::new(RwLock::new(HashMap::new())),
            invoices: Arc::new(RwLock::new(HashMap::new())),
            usages: Arc::new(RwLock::new(HashMap::new())),
            payment_methods: Arc::new(RwLock::new(HashMap::new())),
            policies: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
