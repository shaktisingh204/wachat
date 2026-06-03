use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use chrono::Utc;
use sabnode_auth::AuthUser;
use uuid::Uuid;
use wachat_queue::JobOptions;

use crate::{
    dto::{
        ActivateFlowResponse, ExecutionRecord, TriggerExecutionRequest, TriggerExecutionResponse,
    },
    queue::{ExecutionJobPayload, SABFLOW_QUEUE},
    state::SabflowEngineState,
    store::ExecutionStore,
};

/// POST /v1/sabflow/flows/:flowId/execute
#[tracing::instrument(skip(state, body), fields(flow_id = %flow_id))]
pub async fn trigger_execution(
    State(state): State<SabflowEngineState>,
    auth: AuthUser,
    Path(flow_id): Path<String>,
    Json(body): Json<TriggerExecutionRequest>,
) -> impl IntoResponse {
    let project_id = auth.tenant_id.clone();
    let store = ExecutionStore::new(state.mongo.clone());

    let flow_snapshot = match store.fetch_flow_snapshot(&flow_id, &project_id).await {
        Ok(Some(snap)) => snap,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Flow not found" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch flow snapshot");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        }
    };

    let execution_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let record = ExecutionRecord {
        id: None,
        execution_id: execution_id.clone(),
        flow_id: flow_id.clone(),
        project_id: project_id.clone(),
        status: "queued".to_string(),
        trigger_mode: body.trigger_mode.clone(),
        started_at: now,
        finished_at: None,
        duration_ms: None,
        node_results: vec![],
        error: None,
    };

    if let Err(e) = store.insert(&record).await {
        tracing::error!(error = %e, "failed to insert execution record");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed to create execution record" })),
        )
            .into_response();
    }

    let payload = ExecutionJobPayload {
        execution_id: execution_id.clone(),
        flow_id,
        project_id,
        flow_snapshot,
        trigger_mode: body.trigger_mode,
        trigger_data: body.trigger_data,
        variables: body.initial_variables.unwrap_or_default(),
    };

    if let Err(e) = state
        .bull
        .add(SABFLOW_QUEUE, "execute", &payload, JobOptions::default())
        .await
    {
        tracing::error!(error = %e, execution_id = %execution_id, "failed to enqueue execution job");
        // Don't fail the request — log it and let the record sit as "queued"
    }

    (
        StatusCode::ACCEPTED,
        Json(TriggerExecutionResponse {
            execution_id,
            status: "queued".to_string(),
            started_at: now,
        }),
    )
        .into_response()
}

/// POST /v1/sabflow/flows/:flowId/activate
#[tracing::instrument(skip(state), fields(flow_id = %flow_id))]
pub async fn activate_flow(
    State(state): State<SabflowEngineState>,
    auth: AuthUser,
    Path(flow_id): Path<String>,
) -> impl IntoResponse {
    let project_id = auth.tenant_id.clone();
    let store = ExecutionStore::new(state.mongo.clone());

    match store.set_flow_active(&flow_id, &project_id, true).await {
        Ok(()) => Json(ActivateFlowResponse {
            flow_id,
            status: "active".to_string(),
            message: "Flow activated successfully".to_string(),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to activate flow");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to activate flow" })),
            )
                .into_response()
        }
    }
}

/// POST /v1/sabflow/flows/:flowId/deactivate
#[tracing::instrument(skip(state), fields(flow_id = %flow_id))]
pub async fn deactivate_flow(
    State(state): State<SabflowEngineState>,
    auth: AuthUser,
    Path(flow_id): Path<String>,
) -> impl IntoResponse {
    let project_id = auth.tenant_id.clone();
    let store = ExecutionStore::new(state.mongo.clone());

    match store.set_flow_active(&flow_id, &project_id, false).await {
        Ok(()) => Json(ActivateFlowResponse {
            flow_id,
            status: "deactivated".to_string(),
            message: "Flow deactivated".to_string(),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to deactivate flow");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to deactivate flow" })),
            )
                .into_response()
        }
    }
}

/// GET /v1/sabflow/executions/:executionId
#[tracing::instrument(skip(state), fields(execution_id = %execution_id))]
pub async fn get_execution(
    State(state): State<SabflowEngineState>,
    _auth: AuthUser,
    Path(execution_id): Path<String>,
) -> impl IntoResponse {
    let store = ExecutionStore::new(state.mongo.clone());

    match store.find_by_execution_id(&execution_id).await {
        Ok(Some(record)) => Json(record).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Execution not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch execution");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

/// DELETE /v1/sabflow/executions/:executionId
#[tracing::instrument(skip(state), fields(execution_id = %execution_id))]
pub async fn cancel_execution(
    State(state): State<SabflowEngineState>,
    _auth: AuthUser,
    Path(execution_id): Path<String>,
) -> impl IntoResponse {
    let store = ExecutionStore::new(state.mongo.clone());

    match store.update_status(&execution_id, "cancelled").await {
        Ok(()) => Json(serde_json::json!({
            "message": "Execution cancelled",
            "executionId": execution_id
        }))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "failed to cancel execution");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to cancel execution" })),
            )
                .into_response()
        }
    }
}
