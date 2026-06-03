use axum::{
    routing::{get, post, put, delete},
    Router,
};
use crate::mock_db::MockDb;
use crate::handlers::*;

pub fn create_router(db: MockDb) -> Router {
    Router::new()
        // Triggers
        .route("/api/triggers", post(create_trigger).get(list_triggers))
        .route("/api/triggers/bulk-delete", post(bulk_delete_triggers))
        .route("/api/triggers/:id", get(get_trigger).put(update_trigger).delete(delete_trigger))
        
        // Macros
        .route("/api/macros", post(create_macro).get(list_macros))
        .route("/api/macros/:id", get(get_macro).put(update_macro).delete(delete_macro))
        .route("/api/macros/:macro_id/apply/:ticket_id", post(apply_macro_to_ticket))
        
        // SLA Policies
        .route("/api/sla-policies", post(create_sla_policy).get(list_sla_policies))
        .route("/api/sla-policies/:id", get(get_sla_policy).put(update_sla_policy).delete(delete_sla_policy))
        .route("/api/sla-policies/:policy_id/breach/:ticket_id", get(calculate_sla_breach)) // ticket_id and policy_id

        // Routing Rules
        .route("/api/routing-rules", post(create_routing_rule).get(list_routing_rules))
        .route("/api/routing-rules/:id", get(get_routing_rule).put(update_routing_rule).delete(delete_routing_rule))
        
        // Evaluation & Logic
        .route("/api/evaluate/:ticket_id", post(evaluate_ticket_rules))
        .route("/api/simulate-action", post(simulate_action))
        
        // Tickets helper
        .route("/api/tickets", post(create_ticket))
        .route("/api/tickets/:id", get(get_ticket))

        .with_state(db)
}
