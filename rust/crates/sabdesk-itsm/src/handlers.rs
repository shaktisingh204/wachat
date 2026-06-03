use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::{mock_db::SharedState, models::*};

// --- Hardware Asset Handlers ---

pub async fn create_hardware_asset(
    State(state): State<SharedState>,
    Json(payload): Json<CreateHardwareAssetReq>,
) -> (StatusCode, Json<HardwareAsset>) {
    let mut state = state.write().await;
    let asset = HardwareAsset {
        id: Uuid::new_v4(),
        name: payload.name,
        asset_tag: payload.asset_tag,
        model: payload.model,
        manufacturer: payload.manufacturer,
        status: AssetStatus::InStock,
        assigned_to: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.hardware_assets.insert(asset.id, asset.clone());
    (StatusCode::CREATED, Json(asset))
}

pub async fn get_hardware_assets(State(state): State<SharedState>) -> Json<Vec<HardwareAsset>> {
    let state = state.read().await;
    let assets: Vec<HardwareAsset> = state.hardware_assets.values().cloned().collect();
    Json(assets)
}

pub async fn get_hardware_asset(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HardwareAsset>, StatusCode> {
    let state = state.read().await;
    match state.hardware_assets.get(&id) {
        Some(asset) => Ok(Json(asset.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_hardware_asset_status(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Json(status): Json<AssetStatus>,
) -> Result<Json<HardwareAsset>, StatusCode> {
    let mut state = state.write().await;
    if let Some(asset) = state.hardware_assets.get_mut(&id) {
        asset.status = status;
        asset.updated_at = Utc::now();
        Ok(Json(asset.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Software License Handlers ---

pub async fn create_software_license(
    State(state): State<SharedState>,
    Json(payload): Json<CreateSoftwareLicenseReq>,
) -> (StatusCode, Json<SoftwareLicense>) {
    let mut state = state.write().await;
    let license = SoftwareLicense {
        id: Uuid::new_v4(),
        software_name: payload.software_name,
        license_key: payload.license_key,
        total_seats: payload.total_seats,
        used_seats: 0,
        expires_at: payload.expires_at,
    };
    state.software_licenses.insert(license.id, license.clone());
    (StatusCode::CREATED, Json(license))
}

pub async fn get_software_licenses(State(state): State<SharedState>) -> Json<Vec<SoftwareLicense>> {
    let state = state.read().await;
    let licenses: Vec<SoftwareLicense> = state.software_licenses.values().cloned().collect();
    Json(licenses)
}

pub async fn allocate_software_seat(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SoftwareLicense>, StatusCode> {
    let mut state = state.write().await;
    if let Some(license) = state.software_licenses.get_mut(&id) {
        if license.used_seats < license.total_seats {
            license.used_seats += 1;
            Ok(Json(license.clone()))
        } else {
            Err(StatusCode::CONFLICT) // No seats available
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn deallocate_software_seat(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SoftwareLicense>, StatusCode> {
    let mut state = state.write().await;
    if let Some(license) = state.software_licenses.get_mut(&id) {
        if license.used_seats > 0 {
            license.used_seats -= 1;
            Ok(Json(license.clone()))
        } else {
            Err(StatusCode::BAD_REQUEST)
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Incident Handlers ---

pub async fn create_incident(
    State(state): State<SharedState>,
    Json(payload): Json<CreateIncidentReq>,
) -> (StatusCode, Json<Incident>) {
    let mut state = state.write().await;
    let incident = Incident {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description,
        urgency: payload.urgency,
        state: IncidentState::New,
        assigned_to: None,
        related_asset: None,
        reported_by: payload.reported_by,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.incidents.insert(incident.id, incident.clone());
    (StatusCode::CREATED, Json(incident))
}

pub async fn get_incidents(State(state): State<SharedState>) -> Json<Vec<Incident>> {
    let state = state.read().await;
    let incidents: Vec<Incident> = state.incidents.values().cloned().collect();
    Json(incidents)
}

pub async fn get_incident(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Incident>, StatusCode> {
    let state = state.read().await;
    match state.incidents.get(&id) {
        Some(incident) => Ok(Json(incident.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_incident_state(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Json(new_state): Json<IncidentState>,
) -> Result<Json<Incident>, StatusCode> {
    let mut state = state.write().await;
    if let Some(incident) = state.incidents.get_mut(&id) {
        incident.state = new_state;
        incident.updated_at = Utc::now();
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn assign_incident(
    State(state): State<SharedState>,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Incident>, StatusCode> {
    let mut state = state.write().await;
    if let Some(incident) = state.incidents.get_mut(&id) {
        incident.assigned_to = Some(user_id);
        incident.updated_at = Utc::now();
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn correlate_incident_with_asset(
    State(state): State<SharedState>,
    Path((id, asset_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Incident>, StatusCode> {
    let mut state = state.write().await;
    if !state.hardware_assets.contains_key(&asset_id) {
        return Err(StatusCode::BAD_REQUEST);
    }
    if let Some(incident) = state.incidents.get_mut(&id) {
        incident.related_asset = Some(asset_id);
        incident.updated_at = Utc::now();
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Problem Handlers ---

pub async fn create_problem(
    State(state): State<SharedState>,
    Json(payload): Json<CreateProblemReq>,
) -> (StatusCode, Json<Problem>) {
    let mut state = state.write().await;
    let problem = Problem {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description,
        root_cause: None,
        workaround: None,
        state: ProblemState::Open,
        related_incidents: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.problems.insert(problem.id, problem.clone());
    (StatusCode::CREATED, Json(problem))
}

pub async fn get_problems(State(state): State<SharedState>) -> Json<Vec<Problem>> {
    let state = state.read().await;
    let problems: Vec<Problem> = state.problems.values().cloned().collect();
    Json(problems)
}

pub async fn link_incident_to_problem(
    State(state): State<SharedState>,
    Path((problem_id, incident_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Problem>, StatusCode> {
    let mut state = state.write().await;
    if !state.incidents.contains_key(&incident_id) {
        return Err(StatusCode::BAD_REQUEST);
    }
    if let Some(problem) = state.problems.get_mut(&problem_id) {
        if !problem.related_incidents.contains(&incident_id) {
            problem.related_incidents.push(incident_id);
            problem.updated_at = Utc::now();
        }
        Ok(Json(problem.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_problem_state(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Json(new_state): Json<ProblemState>,
) -> Result<Json<Problem>, StatusCode> {
    let mut state = state.write().await;
    if let Some(problem) = state.problems.get_mut(&id) {
        problem.state = new_state;
        problem.updated_at = Utc::now();
        Ok(Json(problem.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Change Request Handlers ---

pub async fn create_change_request(
    State(state): State<SharedState>,
    Json(payload): Json<CreateChangeRequestReq>,
) -> (StatusCode, Json<ChangeRequest>) {
    let mut state = state.write().await;
    let cr = ChangeRequest {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description,
        risk_level: payload.risk_level,
        state: ChangeState::Draft,
        cab_approval: None,
        scheduled_start: None,
        scheduled_end: None,
        implemented_by: None,
        created_at: Utc::now(),
    };
    state.change_requests.insert(cr.id, cr.clone());
    (StatusCode::CREATED, Json(cr))
}

pub async fn get_change_requests(State(state): State<SharedState>) -> Json<Vec<ChangeRequest>> {
    let state = state.read().await;
    let crs: Vec<ChangeRequest> = state.change_requests.values().cloned().collect();
    Json(crs)
}

#[derive(serde::Deserialize)]
pub struct CabApprovalReq {
    pub approved: bool,
    pub comments: String,
    pub approved_by: Uuid,
}

pub async fn approve_change_request(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CabApprovalReq>,
) -> Result<Json<ChangeRequest>, StatusCode> {
    let mut state = state.write().await;
    if let Some(cr) = state.change_requests.get_mut(&id) {
        cr.cab_approval = Some(CabApproval {
            approved: payload.approved,
            comments: payload.comments,
            approved_by: payload.approved_by,
            approved_at: Utc::now(),
        });
        if payload.approved {
            cr.state = ChangeState::Approved;
        } else {
            cr.state = ChangeState::Rejected;
        }
        Ok(Json(cr.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(serde::Deserialize)]
pub struct ScheduleChangeReq {
    pub start: chrono::DateTime<Utc>,
    pub end: chrono::DateTime<Utc>,
}

pub async fn schedule_change_request(
    State(state): State<SharedState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ScheduleChangeReq>,
) -> Result<Json<ChangeRequest>, StatusCode> {
    let mut state = state.write().await;
    if let Some(cr) = state.change_requests.get_mut(&id) {
        cr.scheduled_start = Some(payload.start);
        cr.scheduled_end = Some(payload.end);
        Ok(Json(cr.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
