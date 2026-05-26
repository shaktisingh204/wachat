use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sabsms_types::{SabsmsMessage, SabsmsMessageStatus, SendRequest};
use uuid::Uuid;
use chrono::Utc;

pub mod middleware;

pub fn router() -> Router {
    let limiter = middleware::RateLimiter::new(2, 60); // 2 requests per 60 seconds for easy testing

    Router::new()
        .route("/v1/messages", post(send_message))
        .route("/v1/messages/{id}", get(get_message))
        .route("/v1/campaigns", get(list_campaigns).post(create_campaign))
        .route_layer(axum::middleware::from_fn(middleware::auth_middleware))
        .route_layer(axum::middleware::from_fn_with_state(limiter.clone(), middleware::rate_limit_middleware))
        .with_state(limiter)
}

async fn send_message(
    Json(payload): Json<SendRequest>,
) -> impl IntoResponse {
    let msg = SabsmsMessage {
        id: Uuid::new_v4(),
        to: payload.to,
        from: payload.from,
        body: payload.body,
        status: SabsmsMessageStatus::Pending,
        provider: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    (StatusCode::CREATED, Json(msg))
}

async fn get_message(
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let msg = SabsmsMessage {
        id,
        to: "+1234567890".to_string(),
        from: "SABNODE".to_string(),
        body: "Mock message".to_string(),
        status: SabsmsMessageStatus::Sent,
        provider: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    (StatusCode::OK, Json(msg))
}

#[derive(Serialize, Deserialize)]
pub struct Campaign {
    pub id: Uuid,
    pub name: String,
    pub status: String,
}

#[derive(Deserialize)]
pub struct CreateCampaignRequest {
    pub name: String,
}

async fn list_campaigns() -> impl IntoResponse {
    let campaigns: Vec<Campaign> = vec![];
    (StatusCode::OK, Json(campaigns))
}

async fn create_campaign(
    Json(payload): Json<CreateCampaignRequest>,
) -> impl IntoResponse {
    let _campaign = Campaign {
        id: Uuid::new_v4(),
        name: payload.name,
        status: "Draft".to_string(),
    };
    (StatusCode::CREATED, Json(_campaign))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode, header},
    };
    use tower::{Service, ServiceExt}; // for `call`, `oneshot`, and `ready`

    #[tokio::test]
    async fn test_auth_middleware() {
        let app = router();

        // No auth header
        let response = app.clone()
            .oneshot(Request::builder().uri("/v1/campaigns").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        // Invalid token
        let response = app.clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/campaigns")
                    .header(header::AUTHORIZATION, "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        // Valid token
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/campaigns")
                    .header(header::AUTHORIZATION, "Bearer valid-token")
                    .header("x-forwarded-for", "10.0.0.1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_rate_limit_middleware() {
        let mut app = router().into_service();

        // Request 1
        let req1 = Request::builder()
            .uri("/v1/campaigns")
            .header(header::AUTHORIZATION, "Bearer valid-token")
            .header("x-forwarded-for", "192.168.1.1")
            .body(Body::empty())
            .unwrap();
        let response1 = app.ready().await.unwrap().call(req1).await.unwrap();
        assert_eq!(response1.status(), StatusCode::OK);

        // Request 2
        let req2 = Request::builder()
            .uri("/v1/campaigns")
            .header(header::AUTHORIZATION, "Bearer valid-token")
            .header("x-forwarded-for", "192.168.1.1")
            .body(Body::empty())
            .unwrap();
        let response2 = app.ready().await.unwrap().call(req2).await.unwrap();
        assert_eq!(response2.status(), StatusCode::OK);

        // Request 3 (Should be rate limited)
        let req3 = Request::builder()
            .uri("/v1/campaigns")
            .header(header::AUTHORIZATION, "Bearer valid-token")
            .header("x-forwarded-for", "192.168.1.1")
            .body(Body::empty())
            .unwrap();
        let response3 = app.ready().await.unwrap().call(req3).await.unwrap();
        assert_eq!(response3.status(), StatusCode::TOO_MANY_REQUESTS);

        // Request 4 (Different IP, should be OK)
        let req4 = Request::builder()
            .uri("/v1/campaigns")
            .header(header::AUTHORIZATION, "Bearer valid-token")
            .header("x-forwarded-for", "192.168.1.2")
            .body(Body::empty())
            .unwrap();
        let response4 = app.ready().await.unwrap().call(req4).await.unwrap();
        assert_eq!(response4.status(), StatusCode::OK);
    }
}
