use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;

use crate::models::*;
use crate::mock_db::DbState;

#[derive(serde::Deserialize)]
pub struct ListQuery {
    pub agent_id: Option<Uuid>,
}

// ---------------- Shifts ----------------

pub async fn create_shift(
    State(db): State<DbState>,
    Json(payload): Json<CreateAgentShiftRequest>,
) -> (StatusCode, Json<AgentShift>) {
    let mut db = db.write().await;
    let shift = AgentShift {
        id: Uuid::new_v4(),
        agent_id: payload.agent_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        shift_type: payload.shift_type,
        location: payload.location,
        notes: payload.notes,
    };
    db.shifts.insert(shift.id, shift.clone());
    (StatusCode::CREATED, Json(shift))
}

pub async fn get_shift(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AgentShift>, StatusCode> {
    let db = db.read().await;
    db.shifts.get(&id).cloned().map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_shifts(
    State(db): State<DbState>,
    Query(query): Query<ListQuery>,
) -> Json<Vec<AgentShift>> {
    let db = db.read().await;
    let mut shifts: Vec<AgentShift> = db.shifts.values().cloned().collect();
    if let Some(agent_id) = query.agent_id {
        shifts.retain(|s| s.agent_id == agent_id);
    }
    Json(shifts)
}

pub async fn update_shift(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateAgentShiftRequest>,
) -> Result<Json<AgentShift>, StatusCode> {
    let mut db = db.write().await;
    if let Some(shift) = db.shifts.get_mut(&id) {
        shift.agent_id = payload.agent_id;
        shift.start_time = payload.start_time;
        shift.end_time = payload.end_time;
        shift.shift_type = payload.shift_type;
        shift.location = payload.location;
        shift.notes = payload.notes;
        Ok(Json(shift.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_shift(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut db = db.write().await;
    if db.shifts.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// ---------------- Time Off ----------------

pub async fn create_time_off(
    State(db): State<DbState>,
    Json(payload): Json<CreateTimeOffRequest>,
) -> (StatusCode, Json<TimeOffRequest>) {
    let mut db = db.write().await;
    let req = TimeOffRequest {
        id: Uuid::new_v4(),
        agent_id: payload.agent_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
        request_type: payload.request_type,
        status: ApprovalStatus::Pending,
        reason: payload.reason,
        submitted_at: Utc::now(),
        approved_by: None,
    };
    db.time_off_requests.insert(req.id, req.clone());
    (StatusCode::CREATED, Json(req))
}

pub async fn get_time_off(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TimeOffRequest>, StatusCode> {
    let db = db.read().await;
    db.time_off_requests.get(&id).cloned().map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_time_off(
    State(db): State<DbState>,
    Query(query): Query<ListQuery>,
) -> Json<Vec<TimeOffRequest>> {
    let db = db.read().await;
    let mut reqs: Vec<TimeOffRequest> = db.time_off_requests.values().cloned().collect();
    if let Some(agent_id) = query.agent_id {
        reqs.retain(|r| r.agent_id == agent_id);
    }
    Json(reqs)
}

pub async fn update_time_off_status(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateApprovalStatusRequest>,
) -> Result<Json<TimeOffRequest>, StatusCode> {
    let mut db = db.write().await;
    if let Some(req) = db.time_off_requests.get_mut(&id) {
        req.status = payload.status;
        req.approved_by = payload.approved_by;
        Ok(Json(req.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_time_off(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut db = db.write().await;
    if db.time_off_requests.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// ---------------- Forecasting ----------------

pub async fn create_forecast(
    State(db): State<DbState>,
    Json(payload): Json<CreateForecastingModelRequest>,
) -> (StatusCode, Json<ForecastingModel>) {
    let mut db = db.write().await;
    let model = ForecastingModel {
        id: Uuid::new_v4(),
        name: payload.name,
        target_date: payload.target_date,
        expected_volume: payload.expected_volume,
        required_agents: payload.required_agents,
        accuracy_score: None,
        created_at: Utc::now(),
        metadata: payload.metadata,
    };
    db.forecasts.insert(model.id, model.clone());
    (StatusCode::CREATED, Json(model))
}

pub async fn get_forecast(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ForecastingModel>, StatusCode> {
    let db = db.read().await;
    db.forecasts.get(&id).cloned().map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_forecasts(
    State(db): State<DbState>,
) -> Json<Vec<ForecastingModel>> {
    let db = db.read().await;
    let forecasts: Vec<ForecastingModel> = db.forecasts.values().cloned().collect();
    Json(forecasts)
}

pub async fn update_forecast(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateForecastingModelRequest>,
) -> Result<Json<ForecastingModel>, StatusCode> {
    let mut db = db.write().await;
    if let Some(model) = db.forecasts.get_mut(&id) {
        model.name = payload.name;
        model.target_date = payload.target_date;
        model.expected_volume = payload.expected_volume;
        model.required_agents = payload.required_agents;
        model.metadata = payload.metadata;
        Ok(Json(model.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_forecast(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut db = db.write().await;
    if db.forecasts.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// ---------------- Attendance ----------------

pub async fn clock_in(
    State(db): State<DbState>,
    Json(payload): Json<ClockInRequest>,
) -> (StatusCode, Json<AttendanceLog>) {
    let mut db = db.write().await;
    let log = AttendanceLog {
        id: Uuid::new_v4(),
        agent_id: payload.agent_id,
        shift_id: payload.shift_id,
        clock_in: Some(payload.time),
        clock_out: None,
        total_hours: None,
        status: AttendanceStatus::OnTime, // Simplification
        notes: None,
    };
    db.attendance_logs.insert(log.id, log.clone());
    (StatusCode::CREATED, Json(log))
}

pub async fn clock_out(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ClockOutRequest>,
) -> Result<Json<AttendanceLog>, StatusCode> {
    let mut db = db.write().await;
    if let Some(log) = db.attendance_logs.get_mut(&id) {
        log.clock_out = Some(payload.time);
        log.notes = payload.notes;
        
        if let Some(start) = log.clock_in {
            let duration = payload.time.signed_duration_since(start);
            log.total_hours = Some(duration.num_minutes() as f32 / 60.0);
        }
        
        Ok(Json(log.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn get_attendance(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AttendanceLog>, StatusCode> {
    let db = db.read().await;
    db.attendance_logs.get(&id).cloned().map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_attendance(
    State(db): State<DbState>,
    Query(query): Query<ListQuery>,
) -> Json<Vec<AttendanceLog>> {
    let db = db.read().await;
    let mut logs: Vec<AttendanceLog> = db.attendance_logs.values().cloned().collect();
    if let Some(agent_id) = query.agent_id {
        logs.retain(|l| l.agent_id == agent_id);
    }
    Json(logs)
}

// ---------------- Shift Swaps ----------------

pub async fn create_shift_swap(
    State(db): State<DbState>,
    Json(payload): Json<CreateShiftSwapRequest>,
) -> (StatusCode, Json<ShiftSwapRequest>) {
    let mut db = db.write().await;
    let req = ShiftSwapRequest {
        id: Uuid::new_v4(),
        requester_id: payload.requester_id,
        target_agent_id: payload.target_agent_id,
        requester_shift_id: payload.requester_shift_id,
        target_shift_id: payload.target_shift_id,
        status: ApprovalStatus::Pending,
        requested_at: Utc::now(),
        resolved_at: None,
    };
    db.shift_swaps.insert(req.id, req.clone());
    (StatusCode::CREATED, Json(req))
}

pub async fn get_shift_swap(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ShiftSwapRequest>, StatusCode> {
    let db = db.read().await;
    db.shift_swaps.get(&id).cloned().map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_shift_swaps(
    State(db): State<DbState>,
    Query(query): Query<ListQuery>,
) -> Json<Vec<ShiftSwapRequest>> {
    let db = db.read().await;
    let mut reqs: Vec<ShiftSwapRequest> = db.shift_swaps.values().cloned().collect();
    if let Some(agent_id) = query.agent_id {
        reqs.retain(|r| r.requester_id == agent_id || r.target_agent_id == agent_id);
    }
    Json(reqs)
}

pub async fn update_shift_swap_status(
    State(db): State<DbState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateApprovalStatusRequest>,
) -> Result<Json<ShiftSwapRequest>, StatusCode> {
    let mut db = db.write().await;
    
    let swap_data = if let Some(req) = db.shift_swaps.get_mut(&id) {
        req.status = payload.status;
        req.resolved_at = Some(Utc::now());
        Some(req.clone())
    } else {
        None
    };
    
    if let Some(req) = swap_data {
        if req.status == ApprovalStatus::Approved {
            let r_shift_id = req.requester_shift_id;
            let t_shift_id = req.target_shift_id;
            let r_agent_id = req.requester_id;
            let t_agent_id = req.target_agent_id;
            
            if let Some(rs) = db.shifts.get_mut(&r_shift_id) {
                rs.agent_id = t_agent_id;
            }
            if let Some(ts) = db.shifts.get_mut(&t_shift_id) {
                ts.agent_id = r_agent_id;
            }
        }
        Ok(Json(req))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
