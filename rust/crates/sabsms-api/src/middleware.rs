use axum::{
    extract::Request,
    http::{StatusCode, header::AUTHORIZATION},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Clone)]
pub struct RateLimiter {
    pub state: Arc<Mutex<HashMap<String, (u32, DateTime<Utc>)>>>,
    pub max_requests: u32,
    pub window_seconds: i64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_seconds: i64) -> Self {
        Self {
            state: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_seconds,
        }
    }
}

pub async fn rate_limit_middleware(
    axum::extract::State(limiter): axum::extract::State<RateLimiter>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let client_ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("127.0.0.1")
        .to_string();

    let mut state = limiter.state.lock().await;
    let now = Utc::now();
    
    let entry = state.entry(client_ip).or_insert((0, now));
    
    if now.signed_duration_since(entry.1).num_seconds() > limiter.window_seconds {
        entry.0 = 1;
        entry.1 = now;
    } else {
        if entry.0 >= limiter.max_requests {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
        entry.0 += 1;
    }
    
    drop(state);

    Ok(next.run(req).await)
}

pub async fn auth_middleware(
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req.headers().get(AUTHORIZATION);
    
    match auth_header {
        Some(header) => {
            if let Ok(token_str) = header.to_str() {
                if token_str.starts_with("Bearer ") {
                    let token = &token_str[7..];
                    if token == "valid-token" {
                        return Ok(next.run(req).await);
                    }
                }
            }
            Err(StatusCode::UNAUTHORIZED)
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}
