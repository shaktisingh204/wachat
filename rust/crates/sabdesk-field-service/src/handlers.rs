use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::mock_db::DbState;
use crate::models::*;

// Technicians
pub async fn list_technicians(State(db): State<DbState>) -> Json<Vec<Technician>> {
    let state = db.read().await;
    Json(state.technicians.values().cloned().collect())
}

pub async fn get_technician(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Technician>, StatusCode> {
    let state = db.read().await;
    state
        .technicians
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_technician(
    State(db): State<DbState>,
    Json(mut payload): Json<Technician>,
) -> Result<Json<Technician>, StatusCode> {
    payload.technician_id = Uuid::new_v4();
    let mut state = db.write().await;
    state
        .technicians
        .insert(payload.technician_id, payload.clone());
    Ok(Json(payload))
}

pub async fn update_technician_status(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(status): Json<TechnicianStatus>,
) -> Result<Json<Technician>, StatusCode> {
    let mut state = db.write().await;
    if let Some(tech) = state.technicians.get_mut(&id) {
        tech.status = status;
        return Ok(Json(tech.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

pub async fn delete_technician(State(db): State<DbState>, Path(id): Path<Uuid>) -> StatusCode {
    let mut state = db.write().await;
    if state.technicians.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// Work Orders
pub async fn list_work_orders(State(db): State<DbState>) -> Json<Vec<WorkOrder>> {
    let state = db.read().await;
    Json(state.work_orders.values().cloned().collect())
}

pub async fn create_work_order(
    State(db): State<DbState>,
    Json(mut payload): Json<WorkOrder>,
) -> Result<Json<WorkOrder>, StatusCode> {
    payload.work_order_id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.status = WorkOrderStatus::Pending;
    let mut state = db.write().await;
    state
        .work_orders
        .insert(payload.work_order_id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_work_order(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkOrder>, StatusCode> {
    let state = db.read().await;
    state
        .work_orders
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_work_order_status(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(status): Json<WorkOrderStatus>,
) -> Result<Json<WorkOrder>, StatusCode> {
    let mut state = db.write().await;
    if let Some(wo) = state.work_orders.get_mut(&id) {
        wo.status = status.clone();
        if status == WorkOrderStatus::Completed {
            wo.completed_at = Some(Utc::now());
        }
        return Ok(Json(wo.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

#[derive(serde::Deserialize)]
pub struct DispatchPayload {
    pub technician_id: Uuid,
}

pub async fn dispatch_work_order(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DispatchPayload>,
) -> Result<Json<WorkOrder>, StatusCode> {
    let mut state = db.write().await;
    if !state.technicians.contains_key(&payload.technician_id) {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(wo) = state.work_orders.get_mut(&id) {
        wo.assigned_technician_id = Some(payload.technician_id);
        wo.status = WorkOrderStatus::Dispatched;
        return Ok(Json(wo.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

#[derive(serde::Deserialize)]
pub struct BulkAssignPayload {
    pub assignments: std::collections::HashMap<Uuid, Uuid>, // WO -> Tech
}

pub async fn bulk_assign_work_orders(
    State(db): State<DbState>,
    Json(payload): Json<BulkAssignPayload>,
) -> StatusCode {
    let mut state = db.write().await;
    for (wo_id, tech_id) in payload.assignments {
        if state.technicians.contains_key(&tech_id) {
            if let Some(wo) = state.work_orders.get_mut(&wo_id) {
                wo.assigned_technician_id = Some(tech_id);
                wo.status = WorkOrderStatus::Scheduled;
            }
        }
    }
    StatusCode::OK
}

// Inventory Vans
pub async fn list_vans(State(db): State<DbState>) -> Json<Vec<InventoryVan>> {
    let state = db.read().await;
    Json(state.vans.values().cloned().collect())
}

pub async fn create_van(
    State(db): State<DbState>,
    Json(mut payload): Json<InventoryVan>,
) -> Result<Json<InventoryVan>, StatusCode> {
    payload.van_id = Uuid::new_v4();
    let mut state = db.write().await;
    state.vans.insert(payload.van_id, payload.clone());
    Ok(Json(payload))
}

pub async fn restock_van(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(items): Json<Vec<InventoryItem>>,
) -> Result<Json<InventoryVan>, StatusCode> {
    let mut state = db.write().await;
    if let Some(van) = state.vans.get_mut(&id) {
        van.items = items;
        van.last_restocked = Utc::now();
        return Ok(Json(van.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

// Routes
pub async fn list_routes(State(db): State<DbState>) -> Json<Vec<GPSRoute>> {
    let state = db.read().await;
    Json(state.routes.values().cloned().collect())
}

pub async fn create_route(
    State(db): State<DbState>,
    Json(mut payload): Json<GPSRoute>,
) -> Result<Json<GPSRoute>, StatusCode> {
    payload.route_id = Uuid::new_v4();
    let mut state = db.write().await;
    state.routes.insert(payload.route_id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_technician_route(
    State(db): State<DbState>,
    Path(tech_id): Path<Uuid>,
) -> Result<Json<GPSRoute>, StatusCode> {
    let state = db.read().await;
    let route = state
        .routes
        .values()
        .find(|r| r.technician_id == tech_id && r.is_active)
        .cloned();
    match route {
        Some(r) => Ok(Json(r)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_route_waypoints(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(waypoints): Json<Vec<GPSLocation>>,
) -> Result<Json<GPSRoute>, StatusCode> {
    let mut state = db.write().await;
    if let Some(route) = state.routes.get_mut(&id) {
        route.waypoints = waypoints;
        return Ok(Json(route.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

// Service Logs
pub async fn list_service_logs(State(db): State<DbState>) -> Json<Vec<ServiceLog>> {
    let state = db.read().await;
    Json(state.service_logs.values().cloned().collect())
}

pub async fn create_service_log(
    State(db): State<DbState>,
    Json(mut payload): Json<ServiceLog>,
) -> Result<Json<ServiceLog>, StatusCode> {
    payload.log_id = Uuid::new_v4();
    payload.timestamp = Utc::now();
    let mut state = db.write().await;
    state.service_logs.insert(payload.log_id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_work_order_logs(
    State(db): State<DbState>,
    Path(wo_id): Path<Uuid>,
) -> Json<Vec<ServiceLog>> {
    let state = db.read().await;
    let logs = state
        .service_logs
        .values()
        .filter(|l| l.work_order_id == wo_id)
        .cloned()
        .collect();
    Json(logs)
}
