use axum::{Json, extract::{Query, State}};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;
use chrono::Utc;

use crate::dto::*;

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_dashboard(
    user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Query(_q): Query<AnalyticsQuery>,
) -> Result<Json<AnalyticsDashboardResponse>> {
    // Generate some dummy data for now
    let today = Utc::now().format("%Y-%m-%d").to_string();
    
    let dashboard = AnalyticsDashboardResponse {
        total_revenue: 15430.50,
        total_orders: 142,
        revenue_over_time: vec![
            RevenueData { date: today.clone(), revenue: 150.0, orders: 3 },
            RevenueData { date: "2024-01-01".to_string(), revenue: 1200.0, orders: 12 },
        ],
        cohorts: vec![
            CohortData { month: "2024-01".to_string(), active_users: 400, retention: 0.85 },
            CohortData { month: "2024-02".to_string(), active_users: 450, retention: 0.88 },
        ],
    };

    Ok(Json(dashboard))
}
