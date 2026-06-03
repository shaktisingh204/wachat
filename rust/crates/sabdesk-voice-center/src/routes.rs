use axum::{
    routing::{get, post, put},
    Router,
};

use crate::handlers::*;
use crate::mock_db::MockDb;

pub fn create_router() -> Router {
    let db = MockDb::new();

    Router::new()
        // Calls
        .route("/calls", post(create_call).get(list_calls))
        .route("/calls/:id", get(get_call))
        .route("/calls/:id/status", put(update_call_status))
        .route(
            "/calls/:call_id/assign/:agent_id",
            post(assign_call_to_agent),
        )
        // IVR Nodes
        .route("/ivr-nodes", post(create_ivr_node).get(list_ivr_nodes))
        .route(
            "/ivr-nodes/:id",
            get(get_ivr_node)
                .put(update_ivr_node)
                .delete(delete_ivr_node),
        )
        // Recordings
        .route("/recordings", post(create_recording))
        .route("/recordings/:id", get(get_recording))
        .route("/calls/:call_id/recordings", get(list_recordings_for_call))
        // Transcripts
        .route("/transcripts", post(create_transcript))
        .route("/transcripts/:id", get(get_transcript))
        .route(
            "/calls/:call_id/transcripts",
            get(list_transcripts_for_call),
        )
        // Agents
        .route("/agents", post(create_agent).get(list_agents))
        .route("/agents/:id", get(get_agent))
        .route("/agents/:id/status", put(update_agent_status))
        .route("/agents/find-available", get(find_available_agent))
        .with_state(db)
}
