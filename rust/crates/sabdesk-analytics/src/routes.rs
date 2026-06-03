use crate::handlers::*;
use crate::mock_db::init_db;
use axum::{
    routing::{get, post},
    Router,
};

pub fn app() -> Router {
    let db = init_db();

    Router::new()
        .route("/api/v1/analytics/agents", get(get_agent_performances).post(add_agent_performance))
        .route("/api/v1/analytics/agents/:id", get(get_agent_performance).put(update_agent_performance).delete(delete_agent_performance))
        .route("/api/v1/analytics/agents/top", get(get_top_agents))
        
        .route("/api/v1/analytics/csat", get(get_csat_scores).post(add_csat_score))
        .route("/api/v1/analytics/csat/global", get(get_global_csat))
        
        .route("/api/v1/analytics/resolution-times", get(get_resolution_times).post(add_resolution_time))
        .route("/api/v1/analytics/resolution-times/global", get(get_global_resolution_time))
        
        .route("/api/v1/analytics/deflection-rates", get(get_deflection_rates))
        
        .route("/api/v1/analytics/dashboard/live", get(get_live_dashboard))
        
        .route("/api/v1/analytics/ticket-volumes", get(get_ticket_volumes))
        
        .route("/api/v1/analytics/sla-compliances", get(get_sla_compliances))
        
        .route("/api/v1/analytics/customer-retentions", get(get_customer_retentions))
        
        .route("/api/v1/analytics/query-trends", get(get_query_trends))
        
        .route("/api/v1/analytics/tag-usages", get(get_tag_usages))
        
        .route("/api/v1/analytics/clear", post(clear_all_data))
        
        .with_state(db)
}
