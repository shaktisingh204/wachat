use crate::handlers::*;
use crate::mock_db::DbState;
use axum::{
    routing::{delete, get, post, put},
    Router,
};

pub fn app_router(db_state: DbState) -> Router {
    Router::new()
        // Technicians
        .route(
            "/technicians",
            get(list_technicians).post(create_technician),
        )
        .route(
            "/technicians/:id",
            get(get_technician).delete(delete_technician),
        )
        .route("/technicians/:id/status", put(update_technician_status))
        .route("/technicians/:id/route", get(get_technician_route))
        // Work Orders
        .route(
            "/work_orders",
            get(list_work_orders).post(create_work_order),
        )
        .route("/work_orders/:id", get(get_work_order))
        .route("/work_orders/:id/status", put(update_work_order_status))
        .route("/work_orders/:id/dispatch", post(dispatch_work_order))
        .route("/work_orders/:id/logs", get(get_work_order_logs))
        .route("/work_orders/bulk_assign", post(bulk_assign_work_orders))
        // Inventory Vans
        .route("/vans", get(list_vans).post(create_van))
        .route("/vans/:id/restock", put(restock_van))
        // Routes
        .route("/routes", get(list_routes).post(create_route))
        .route("/routes/:id/waypoints", put(update_route_waypoints))
        // Service Logs
        .route(
            "/service_logs",
            get(list_service_logs).post(create_service_log),
        )
        .with_state(db_state)
}
