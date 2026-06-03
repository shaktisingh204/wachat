use axum::{
    routing::{get, post},
    Router,
};

use crate::{handlers::*, mock_db::MockDb};

pub fn create_router(db: MockDb) -> Router {
    Router::new()
        // Agents
        .route("/agents", post(create_agent).get(list_agents))
        .route(
            "/agents/:id",
            get(get_agent).put(update_agent).delete(delete_agent),
        )
        // Badges
        .route("/badges", post(create_badge).get(list_badges))
        .route(
            "/badges/:id",
            get(get_badge).put(update_badge).delete(delete_badge),
        )
        // Quests
        .route("/quests", post(create_quest).get(list_quests))
        .route(
            "/quests/:id",
            get(get_quest).put(update_quest).delete(delete_quest),
        )
        // Gamification logic
        .route("/points/award", post(award_points))
        .route("/agents/:id/ledger", get(get_agent_ledger))
        .route(
            "/agents/:id/badges/:badge_id",
            post(unlock_badge).delete(revoke_badge),
        )
        .route("/leaderboard", get(get_leaderboard))
        .with_state(db)
}
