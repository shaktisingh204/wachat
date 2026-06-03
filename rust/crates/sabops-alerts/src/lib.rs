use axum::{Json, Router, extract::FromRef, routing::get};
use sabnode_auth::{AuthConfig, AuthUser};
use serde_json::{Value, json};
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/", get(list_items))
}

async fn list_items(_user: AuthUser) -> Json<Value> {
    Json(json!({ "items": [] }))
}
