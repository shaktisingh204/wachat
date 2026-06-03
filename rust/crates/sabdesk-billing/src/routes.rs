use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::handlers::*;
use crate::mock_db::MockDb;

pub fn create_router(db: MockDb) -> Router {
    Router::new()
        // Subscription Tiers
        .route("/tiers", get(list_tiers).post(create_tier))
        .route("/tiers/:id", get(get_tier).delete(delete_tier))
        .route("/tiers/:id/limits", patch(update_tier_limits))
        // Invoices
        .route("/invoices", get(list_invoices).post(create_invoice))
        .route("/invoices/:id", get(get_invoice).delete(delete_invoice))
        .route("/invoices/:id/pay", post(pay_invoice))
        .route("/invoices/:id/void", post(void_invoice))
        .route("/invoices/:id/discount", post(apply_invoice_discount))
        // Usage Records
        .route("/usages", get(list_usages).post(record_usage))
        .route("/usages/summary/:customer_id", get(get_usage_summary))
        // Payment Methods
        .route(
            "/payment-methods/customer/:customer_id",
            get(list_payment_methods),
        )
        .route("/payment-methods", post(add_payment_method))
        .route(
            "/payment-methods/:customer_id/:method_id/default",
            post(set_default_payment_method),
        )
        // Dunning Policies
        .route(
            "/dunning-policies/:id",
            get(get_dunning_policy).put(update_dunning_policy),
        )
        .with_state(db)
}
