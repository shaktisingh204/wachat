use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TierLevel {
    Free,
    Basic,
    Pro,
    Enterprise,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscriptionTier {
    pub id: Uuid,
    pub level: TierLevel,
    pub base_price_cents: u64,
    pub max_users: u32,
    pub storage_limit_gb: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum InvoiceStatus {
    Draft,
    Open,
    Paid,
    Void,
    Uncollectible,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Invoice {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub amount_due_cents: u64,
    pub amount_paid_cents: u64,
    pub status: InvoiceStatus,
    pub due_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageRecord {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub metric_name: String,
    pub quantity: u64,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentMethod {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub method_type: String, // e.g., "credit_card", "bank_transfer"
    pub last_four: String,
    pub expiry_month: u8,
    pub expiry_year: u16,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DunningPolicy {
    pub id: Uuid,
    pub grace_period_days: u32,
    pub retry_schedule_days: Vec<u32>,
    pub action_on_failure: String, // e.g., "downgrade", "cancel"
}

// Request and Response Structs for our Handlers
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceReq {
    pub customer_id: Uuid,
    pub amount_due_cents: u64,
    pub due_date: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateLimitReq {
    pub max_users: Option<u32>,
    pub storage_limit_gb: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApplyDiscountReq {
    pub discount_percentage: u8,
}
