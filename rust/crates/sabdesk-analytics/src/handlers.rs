use crate::mock_db::Db;
use crate::models::*;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

// 1. Get all agent performances
pub async fn get_agent_performances(State(db): State<Db>) -> Json<Vec<AgentPerformance>> {
    let data = db.read().await;
    Json(data.agent_performances.clone())
}

// 2. Get specific agent performance
pub async fn get_agent_performance(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<Json<AgentPerformance>, StatusCode> {
    let data = db.read().await;
    if let Some(agent) = data.agent_performances.iter().find(|a| a.agent_id == id) {
        Ok(Json(agent.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 3. Add agent performance
pub async fn add_agent_performance(
    State(db): State<Db>,
    Json(mut payload): Json<AgentPerformance>,
) -> (StatusCode, Json<AgentPerformance>) {
    payload.agent_id = Uuid::new_v4();
    let mut data = db.write().await;
    data.agent_performances.push(payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 4. Update agent performance
pub async fn update_agent_performance(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AgentPerformance>,
) -> Result<Json<AgentPerformance>, StatusCode> {
    let mut data = db.write().await;
    if let Some(agent) = data.agent_performances.iter_mut().find(|a| a.agent_id == id) {
        agent.tickets_resolved = payload.tickets_resolved;
        agent.average_resolution_time_minutes = payload.average_resolution_time_minutes;
        agent.average_first_response_time_minutes = payload.average_first_response_time_minutes;
        agent.csat_average = payload.csat_average;
        Ok(Json(agent.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Delete agent performance
pub async fn delete_agent_performance(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut data = db.write().await;
    let initial_len = data.agent_performances.len();
    data.agent_performances.retain(|a| a.agent_id != id);
    if data.agent_performances.len() < initial_len {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// 6. Get top performing agents (by CSAT)
pub async fn get_top_agents(State(db): State<Db>) -> Json<Vec<AgentPerformance>> {
    let data = db.read().await;
    let mut agents = data.agent_performances.clone();
    agents.sort_by(|a, b| b.csat_average.partial_cmp(&a.csat_average).unwrap_or(std::cmp::Ordering::Equal));
    agents.truncate(5);
    Json(agents)
}

// 7. Get all CSAT scores
pub async fn get_csat_scores(State(db): State<Db>) -> Json<Vec<CsatScore>> {
    let data = db.read().await;
    Json(data.csat_scores.clone())
}

// 8. Add CSAT score
pub async fn add_csat_score(
    State(db): State<Db>,
    Json(mut payload): Json<CsatScore>,
) -> (StatusCode, Json<CsatScore>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    let mut data = db.write().await;
    data.csat_scores.push(payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 9. Get average CSAT score globally
#[derive(serde::Serialize)]
pub struct AverageCsat { pub average: f64 }
pub async fn get_global_csat(State(db): State<Db>) -> Json<AverageCsat> {
    let data = db.read().await;
    if data.csat_scores.is_empty() {
        return Json(AverageCsat { average: 0.0 });
    }
    let sum: u32 = data.csat_scores.iter().map(|s| s.score as u32).sum();
    let average = sum as f64 / data.csat_scores.len() as f64;
    Json(AverageCsat { average })
}

// 10. Get all resolution times
pub async fn get_resolution_times(State(db): State<Db>) -> Json<Vec<ResolutionTime>> {
    let data = db.read().await;
    Json(data.resolution_times.clone())
}

// 11. Add resolution time
pub async fn add_resolution_time(
    State(db): State<Db>,
    Json(payload): Json<ResolutionTime>,
) -> (StatusCode, Json<ResolutionTime>) {
    let mut data = db.write().await;
    data.resolution_times.push(payload.clone());
    (StatusCode::CREATED, Json(payload))
}

// 12. Get average resolution time globally
#[derive(serde::Serialize)]
pub struct AverageResolution { pub average_minutes: f64 }
pub async fn get_global_resolution_time(State(db): State<Db>) -> Json<AverageResolution> {
    let data = db.read().await;
    if data.resolution_times.is_empty() {
        return Json(AverageResolution { average_minutes: 0.0 });
    }
    let sum: u32 = data.resolution_times.iter().map(|r| r.time_to_resolution_minutes).sum();
    let average_minutes = sum as f64 / data.resolution_times.len() as f64;
    Json(AverageResolution { average_minutes })
}

// 13. Get all deflection rates
pub async fn get_deflection_rates(State(db): State<Db>) -> Json<Vec<DeflectionRate>> {
    let data = db.read().await;
    Json(data.deflection_rates.clone())
}

// 14. Get live dashboard widgets
pub async fn get_live_dashboard(State(db): State<Db>) -> Json<LiveDashboardWidgets> {
    let data = db.read().await;
    let agents_count = data.agent_performances.len() as u32;
    let dashboard = LiveDashboardWidgets {
        active_agents_count: agents_count,
        tickets_in_queue: 154,
        current_sla_breach_rate: 2.4,
        active_chats: 42,
        top_trending_topics: vec!["password".to_string(), "billing".to_string(), "outage".to_string()],
        timestamp: Utc::now(),
    };
    Json(dashboard)
}

// 15. Get ticket volumes
pub async fn get_ticket_volumes(State(db): State<Db>) -> Json<Vec<TicketVolume>> {
    let data = db.read().await;
    Json(data.ticket_volumes.clone())
}

// 16. Get SLA compliances
pub async fn get_sla_compliances(State(db): State<Db>) -> Json<Vec<SlaCompliance>> {
    let data = db.read().await;
    Json(data.sla_compliances.clone())
}

// 17. Get customer retentions
pub async fn get_customer_retentions(State(db): State<Db>) -> Json<Vec<CustomerRetention>> {
    let data = db.read().await;
    Json(data.customer_retentions.clone())
}

// 18. Get query trends
pub async fn get_query_trends(State(db): State<Db>) -> Json<Vec<QueryTrend>> {
    let data = db.read().await;
    Json(data.query_trends.clone())
}

// 19. Get tag usages
pub async fn get_tag_usages(State(db): State<Db>) -> Json<Vec<TagUsage>> {
    let data = db.read().await;
    Json(data.tag_usages.clone())
}

// 20. Clear all data (Admin)
pub async fn clear_all_data(State(db): State<Db>) -> StatusCode {
    let mut data = db.write().await;
    data.agent_performances.clear();
    data.csat_scores.clear();
    data.resolution_times.clear();
    data.deflection_rates.clear();
    data.ticket_volumes.clear();
    data.sla_compliances.clear();
    data.customer_retentions.clear();
    data.query_trends.clear();
    data.tag_usages.clear();
    StatusCode::NO_CONTENT
}
