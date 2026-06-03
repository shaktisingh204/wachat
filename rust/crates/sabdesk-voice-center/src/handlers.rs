use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use crate::mock_db::MockDb;
use crate::models::*;

// --- Calls ---

pub async fn create_call(
    State(db): State<MockDb>,
    Json(mut payload): Json<CallSession>,
) -> (StatusCode, Json<CallSession>) {
    payload.id = Uuid::new_v4();
    payload.started_at = Utc::now();
    payload.status = CallStatus::Queued;

    let mut calls = db.calls.write().await;
    calls.insert(payload.id, payload.clone());

    (StatusCode::CREATED, Json(payload))
}

pub async fn get_call(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<CallSession>, StatusCode> {
    let calls = db.calls.read().await;
    calls
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_calls(State(db): State<MockDb>) -> Json<Vec<CallSession>> {
    let calls = db.calls.read().await;
    Json(calls.values().cloned().collect())
}

pub async fn update_call_status(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(status): Json<CallStatus>,
) -> Result<Json<CallSession>, StatusCode> {
    let mut calls = db.calls.write().await;
    if let Some(call) = calls.get_mut(&id) {
        call.status = status;
        if call.status == CallStatus::Completed
            || call.status == CallStatus::Failed
            || call.status == CallStatus::Abandoned
        {
            call.ended_at = Some(Utc::now());
        }
        Ok(Json(call.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn assign_call_to_agent(
    State(db): State<MockDb>,
    Path((call_id, agent_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<CallSession>, StatusCode> {
    let mut agents = db.agents.write().await;
    let mut calls = db.calls.write().await;

    if let Some(agent) = agents.get_mut(&agent_id) {
        if agent.status != AgentStatus::Available {
            return Err(StatusCode::CONFLICT);
        }
        if let Some(call) = calls.get_mut(&call_id) {
            call.assigned_agent_id = Some(agent_id);
            call.status = CallStatus::InProgress;

            agent.status = AgentStatus::Busy;
            agent.current_call_id = Some(call_id);

            return Ok(Json(call.clone()));
        }
    }
    Err(StatusCode::NOT_FOUND)
}

// --- IVR Nodes ---

pub async fn create_ivr_node(
    State(db): State<MockDb>,
    Json(mut payload): Json<IvrNode>,
) -> (StatusCode, Json<IvrNode>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    let mut nodes = db.ivr_nodes.write().await;
    nodes.insert(payload.id, payload.clone());

    (StatusCode::CREATED, Json(payload))
}

pub async fn get_ivr_node(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<IvrNode>, StatusCode> {
    let nodes = db.ivr_nodes.read().await;
    nodes
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_ivr_nodes(State(db): State<MockDb>) -> Json<Vec<IvrNode>> {
    let nodes = db.ivr_nodes.read().await;
    Json(nodes.values().cloned().collect())
}

pub async fn update_ivr_node(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<IvrNode>,
) -> Result<Json<IvrNode>, StatusCode> {
    let mut nodes = db.ivr_nodes.write().await;
    if let Some(node) = nodes.get_mut(&id) {
        node.name = payload.name;
        node.prompt_text = payload.prompt_text;
        node.options = payload.options;
        Ok(Json(node.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_ivr_node(State(db): State<MockDb>, Path(id): Path<Uuid>) -> StatusCode {
    let mut nodes = db.ivr_nodes.write().await;
    if nodes.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// --- Recordings ---

pub async fn create_recording(
    State(db): State<MockDb>,
    Json(mut payload): Json<Recording>,
) -> (StatusCode, Json<Recording>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    let mut recordings = db.recordings.write().await;
    recordings.insert(payload.id, payload.clone());

    (StatusCode::CREATED, Json(payload))
}

pub async fn get_recording(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Recording>, StatusCode> {
    let recordings = db.recordings.read().await;
    recordings
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_recordings_for_call(
    State(db): State<MockDb>,
    Path(call_id): Path<Uuid>,
) -> Json<Vec<Recording>> {
    let recordings = db.recordings.read().await;
    let filtered = recordings
        .values()
        .filter(|r| r.call_session_id == call_id)
        .cloned()
        .collect();
    Json(filtered)
}

// --- Transcripts ---

pub async fn create_transcript(
    State(db): State<MockDb>,
    Json(mut payload): Json<Transcript>,
) -> (StatusCode, Json<Transcript>) {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();

    let mut transcripts = db.transcripts.write().await;
    transcripts.insert(payload.id, payload.clone());

    (StatusCode::CREATED, Json(payload))
}

pub async fn get_transcript(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Transcript>, StatusCode> {
    let transcripts = db.transcripts.read().await;
    transcripts
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_transcripts_for_call(
    State(db): State<MockDb>,
    Path(call_id): Path<Uuid>,
) -> Json<Vec<Transcript>> {
    let transcripts = db.transcripts.read().await;
    let filtered = transcripts
        .values()
        .filter(|t| t.call_session_id == call_id)
        .cloned()
        .collect();
    Json(filtered)
}

// --- Agents ---

pub async fn create_agent(
    State(db): State<MockDb>,
    Json(mut payload): Json<VoiceAgent>,
) -> (StatusCode, Json<VoiceAgent>) {
    payload.id = Uuid::new_v4();
    payload.status = AgentStatus::Offline;
    payload.current_call_id = None;

    let mut agents = db.agents.write().await;
    agents.insert(payload.id, payload.clone());

    (StatusCode::CREATED, Json(payload))
}

pub async fn get_agent(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<VoiceAgent>, StatusCode> {
    let agents = db.agents.read().await;
    agents
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn list_agents(State(db): State<MockDb>) -> Json<Vec<VoiceAgent>> {
    let agents = db.agents.read().await;
    Json(agents.values().cloned().collect())
}

pub async fn update_agent_status(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(status): Json<AgentStatus>,
) -> Result<Json<VoiceAgent>, StatusCode> {
    let mut agents = db.agents.write().await;
    if let Some(agent) = agents.get_mut(&id) {
        agent.status = status;
        if agent.status != AgentStatus::Busy {
            agent.current_call_id = None;
        }
        Ok(Json(agent.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn find_available_agent(
    State(db): State<MockDb>,
) -> Result<Json<VoiceAgent>, StatusCode> {
    let agents = db.agents.read().await;
    for agent in agents.values() {
        if agent.status == AgentStatus::Available {
            return Ok(Json(agent.clone()));
        }
    }
    Err(StatusCode::NOT_FOUND)
}
