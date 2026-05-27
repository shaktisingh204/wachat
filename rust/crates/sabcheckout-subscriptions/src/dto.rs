//! Request DTOs for sabcheckout-subscriptions.

use serde::{Deserialize, Serialize};

use crate::types::SabcheckoutSubscription;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub plan_id: Option<String>,
    #[serde(default)]
    pub customer_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionInput {
    pub plan_id: String,
    pub customer_id: String,
    pub current_period_start: String,
    pub current_period_end: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub provider_subscription_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubscriptionInput {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub current_period_start: Option<String>,
    #[serde(default)]
    pub current_period_end: Option<String>,
    #[serde(default)]
    pub provider_subscription_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionResponse {
    pub id: String,
    pub entity: SabcheckoutSubscription,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelResponse {
    pub cancelled: bool,
    pub entity: SabcheckoutSubscription,
}
