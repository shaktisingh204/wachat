//! Mountable router for the POS surface. Mount under `/v1/crm/pos`.
//!
//! Routes (relative — caller nests under `/v1/crm/pos`):
//!
//! ```text
//! GET    /sessions                                  — list_sessions
//! POST   /sessions                                  — open_session
//! GET    /sessions/{sessionId}                      — get_session
//! PATCH  /sessions/{sessionId}                      — update_session
//! DELETE /sessions/{sessionId}                      — archive_session
//! POST   /sessions/{sessionId}/close                — close_session
//! POST   /sessions/{sessionId}/reconcile            — reconcile_session
//!
//! GET    /transactions                              — list_transactions
//! POST   /transactions                              — create_transaction
//! GET    /transactions/{transactionId}              — get_transaction
//! PATCH  /transactions/{transactionId}              — update_transaction
//! DELETE /transactions/{transactionId}              — delete_transaction
//! POST   /transactions/{transactionId}/void         — void_transaction
//! POST   /transactions/{transactionId}/refund       — refund_transaction
//! GET    /transactions/{transactionId}/refunds      — list_refunds_by_transaction
//!
//! GET    /holds                                     — list_holds
//! POST   /holds                                     — create_hold
//! GET    /holds/{holdId}                            — get_hold
//! PATCH  /holds/{holdId}                            — update_hold
//! DELETE /holds/{holdId}                            — void_hold
//! POST   /holds/{holdId}/recall                     — recall_hold
//!
//! GET    /refunds                                   — list_refunds
//! GET    /refunds/{refundId}                        — get_refund
//! PATCH  /refunds/{refundId}                        — update_refund
//! DELETE /refunds/{refundId}                        — delete_refund
//! ```

use std::sync::Arc;

use axum::{
    Extension, Router,
    extract::FromRef,
    routing::{get, post},
};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared POS route table (no scope attached yet).
fn pos_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Sessions
        .route(
            "/sessions",
            get(handlers::list_sessions).post(handlers::open_session),
        )
        .route(
            "/sessions/{sessionId}",
            get(handlers::get_session)
                .patch(handlers::update_session)
                .delete(handlers::archive_session),
        )
        .route(
            "/sessions/{sessionId}/close",
            post(handlers::close_session),
        )
        .route(
            "/sessions/{sessionId}/reconcile",
            post(handlers::reconcile_session),
        )
        // Transactions
        .route(
            "/transactions",
            get(handlers::list_transactions).post(handlers::create_transaction),
        )
        .route(
            "/transactions/{transactionId}",
            get(handlers::get_transaction)
                .patch(handlers::update_transaction)
                .delete(handlers::delete_transaction),
        )
        .route(
            "/transactions/{transactionId}/void",
            post(handlers::void_transaction),
        )
        .route(
            "/transactions/{transactionId}/refund",
            post(handlers::refund_transaction),
        )
        .route(
            "/transactions/{transactionId}/refunds",
            get(handlers::list_refunds_by_transaction),
        )
        // Holds
        .route(
            "/holds",
            get(handlers::list_holds).post(handlers::create_hold),
        )
        .route(
            "/holds/{holdId}",
            get(handlers::get_hold)
                .patch(handlers::update_hold)
                .delete(handlers::void_hold),
        )
        .route("/holds/{holdId}/recall", post(handlers::recall_hold))
        // Refunds
        .route("/refunds", get(handlers::list_refunds))
        .route(
            "/refunds/{refundId}",
            get(handlers::get_refund)
                .patch(handlers::update_refund)
                .delete(handlers::delete_refund),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/pos`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    pos_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Commerce `projectId`-scoped router — mount under
/// `/v1/sabcrm/commerce/pos`. Same handlers, same collections; every
/// request must carry `projectId` (query for id-addressed routes, body
/// for collection `POST`s) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    pos_routes().layer(Extension(ScopeMode::Project))
}
