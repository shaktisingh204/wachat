//! HTTP routes exposed by `sabflow-engine-runtime`.
//!
//! Mount as `.nest("/v1/sabflow", sabflow_engine_runtime::router::<AppState>())`.
//! `AppState` must implement `FromRef<SabflowRuntimeState>`.

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};

use crate::{engine::ExecuteFlowInput, state::SabflowRuntimeState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowRuntimeState: FromRef<S>,
{
    Router::new()
        .route("/nodes", get(list_nodes))
        .route("/nodes/{type}", get(get_node))
        .route("/internal/execute", post(execute_flow))
}

/// GET /v1/sabflow/nodes
async fn list_nodes(State(state): State<SabflowRuntimeState>) -> impl IntoResponse {
    let descriptors = state.registry.descriptors();
    Json(serde_json::json!({ "nodes": descriptors }))
}

/// GET /v1/sabflow/nodes/:type
async fn get_node(
    State(state): State<SabflowRuntimeState>,
    Path(node_type): Path<String>,
) -> impl IntoResponse {
    match state.registry.get(&node_type) {
        Some(node) => Json(node.descriptor()).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": format!("Unknown node: {node_type}") })),
        )
            .into_response(),
    }
}

/// POST /v1/sabflow/internal/execute
async fn execute_flow(
    State(state): State<SabflowRuntimeState>,
    Json(input): Json<ExecuteFlowInput>,
) -> impl IntoResponse {
    let result = state.engine.execute(input).await;
    Json(result)
}
