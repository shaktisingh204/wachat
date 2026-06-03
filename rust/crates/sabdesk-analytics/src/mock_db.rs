use crate::models::*;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct MockDb {
    pub agent_performances: Vec<AgentPerformance>,
    pub csat_scores: Vec<CsatScore>,
    pub resolution_times: Vec<ResolutionTime>,
    pub deflection_rates: Vec<DeflectionRate>,
    pub ticket_volumes: Vec<TicketVolume>,
    pub sla_compliances: Vec<SlaCompliance>,
    pub customer_retentions: Vec<CustomerRetention>,
    pub query_trends: Vec<QueryTrend>,
    pub tag_usages: Vec<TagUsage>,
}

pub type Db = Arc<RwLock<MockDb>>;

pub fn init_db() -> Db {
    Arc::new(RwLock::new(MockDb {
        agent_performances: vec![
            AgentPerformance {
                agent_id: Uuid::new_v4(),
                agent_name: "Alice Smith".to_string(),
                tickets_resolved: 120,
                average_resolution_time_minutes: 45.5,
                average_first_response_time_minutes: 12.0,
                csat_average: 4.8,
                date_calculated: Utc::now(),
            },
            AgentPerformance {
                agent_id: Uuid::new_v4(),
                agent_name: "Bob Jones".to_string(),
                tickets_resolved: 95,
                average_resolution_time_minutes: 55.0,
                average_first_response_time_minutes: 15.5,
                csat_average: 4.2,
                date_calculated: Utc::now(),
            },
        ],
        csat_scores: vec![
            CsatScore {
                id: Uuid::new_v4(),
                ticket_id: Uuid::new_v4(),
                agent_id: Uuid::new_v4(),
                customer_id: Uuid::new_v4(),
                score: 5,
                feedback: Some("Excellent service!".to_string()),
                created_at: Utc::now(),
            },
            CsatScore {
                id: Uuid::new_v4(),
                ticket_id: Uuid::new_v4(),
                agent_id: Uuid::new_v4(),
                customer_id: Uuid::new_v4(),
                score: 3,
                feedback: Some("Average.".to_string()),
                created_at: Utc::now(),
            },
        ],
        resolution_times: vec![
            ResolutionTime {
                ticket_id: Uuid::new_v4(),
                time_to_resolution_minutes: 30,
                resolved_at: Utc::now(),
                severity: "High".to_string(),
                category: "Billing".to_string(),
            },
        ],
        deflection_rates: vec![
            DeflectionRate {
                date: "2023-10-01".to_string(),
                total_kb_views: 1500,
                total_bot_interactions: 800,
                successful_deflections: 400,
                deflection_rate_percentage: 50.0,
            },
        ],
        ticket_volumes: vec![
            TicketVolume {
                date: "2023-10-01".to_string(),
                received: 300,
                resolved: 250,
                escalated: 15,
            },
        ],
        sla_compliances: vec![
            SlaCompliance {
                period: "2023-Q3".to_string(),
                target_percentage: 95.0,
                actual_percentage: 92.5,
                total_tickets_evaluated: 5000,
                breaches_count: 375,
            },
        ],
        customer_retentions: vec![
            CustomerRetention {
                segment: "Enterprise".to_string(),
                retention_rate: 98.5,
                total_customers: 200,
                churned_customers: 3,
            },
        ],
        query_trends: vec![
            QueryTrend {
                keyword: "password reset".to_string(),
                frequency: 450,
                change_percentage_from_last_period: -5.0,
            },
            QueryTrend {
                keyword: "outage".to_string(),
                frequency: 800,
                change_percentage_from_last_period: 150.0,
            },
        ],
        tag_usages: vec![
            TagUsage {
                tag_name: "bug".to_string(),
                count: 1200,
            },
            TagUsage {
                tag_name: "feature_request".to_string(),
                count: 850,
            },
        ],
    }))
}
