use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsQuery {
    pub storefront_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RevenueData {
    pub date: String,
    pub revenue: f64,
    pub orders: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CohortData {
    pub month: String,
    pub active_users: u32,
    pub retention: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsDashboardResponse {
    pub total_revenue: f64,
    pub total_orders: u32,
    pub revenue_over_time: Vec<RevenueData>,
    pub cohorts: Vec<CohortData>,
}
