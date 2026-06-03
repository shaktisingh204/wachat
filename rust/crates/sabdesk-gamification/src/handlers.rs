use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    mock_db::MockDb,
    models::{AgentProfile, Badge, LeaderboardEntry, PointsLedger, Quest},
};

// 1. Create Agent Profile
#[derive(Deserialize)]
pub struct CreateAgentReq {
    pub user_id: Uuid,
}

pub async fn create_agent(
    State(db): State<MockDb>,
    Json(payload): Json<CreateAgentReq>,
) -> Result<Json<AgentProfile>, (StatusCode, String)> {
    let id = Uuid::new_v4();
    let agent = AgentProfile {
        id,
        user_id: payload.user_id,
        total_points: 0,
        current_level: 1,
        badges: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    db.agents.write().await.insert(id, agent.clone());
    Ok(Json(agent))
}

// 2. Get Agent Profile
pub async fn get_agent(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<AgentProfile>, (StatusCode, String)> {
    let agents = db.agents.read().await;
    match agents.get(&id) {
        Some(agent) => Ok(Json(agent.clone())),
        None => Err((StatusCode::NOT_FOUND, "Agent not found".to_string())),
    }
}

// 3. List Agents
pub async fn list_agents(
    State(db): State<MockDb>,
) -> Result<Json<Vec<AgentProfile>>, (StatusCode, String)> {
    let agents = db.agents.read().await;
    let list: Vec<AgentProfile> = agents.values().cloned().collect();
    Ok(Json(list))
}

// 4. Update Agent Profile (Level up / adjustments)
#[derive(Deserialize)]
pub struct UpdateAgentReq {
    pub level: Option<i32>,
}
pub async fn update_agent(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAgentReq>,
) -> Result<Json<AgentProfile>, (StatusCode, String)> {
    let mut agents = db.agents.write().await;
    if let Some(agent) = agents.get_mut(&id) {
        if let Some(lvl) = payload.level {
            agent.current_level = lvl;
        }
        agent.updated_at = Utc::now();
        Ok(Json(agent.clone()))
    } else {
        Err((StatusCode::NOT_FOUND, "Agent not found".to_string()))
    }
}

// 5. Delete Agent Profile
pub async fn delete_agent(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let mut agents = db.agents.write().await;
    if agents.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Agent not found".to_string()))
    }
}

// 6. Create Badge
#[derive(Deserialize)]
pub struct CreateBadgeReq {
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub points_required: i64,
}
pub async fn create_badge(
    State(db): State<MockDb>,
    Json(payload): Json<CreateBadgeReq>,
) -> Result<Json<Badge>, (StatusCode, String)> {
    let id = Uuid::new_v4();
    let badge = Badge {
        id,
        name: payload.name,
        description: payload.description,
        icon_url: payload.icon_url,
        points_required: payload.points_required,
    };
    db.badges.write().await.insert(id, badge.clone());
    Ok(Json(badge))
}

// 7. Get Badge
pub async fn get_badge(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Badge>, (StatusCode, String)> {
    let badges = db.badges.read().await;
    match badges.get(&id) {
        Some(b) => Ok(Json(b.clone())),
        None => Err((StatusCode::NOT_FOUND, "Badge not found".to_string())),
    }
}

// 8. List Badges
pub async fn list_badges(
    State(db): State<MockDb>,
) -> Result<Json<Vec<Badge>>, (StatusCode, String)> {
    let badges = db.badges.read().await;
    Ok(Json(badges.values().cloned().collect()))
}

// 9. Update Badge
pub async fn update_badge(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateBadgeReq>,
) -> Result<Json<Badge>, (StatusCode, String)> {
    let mut badges = db.badges.write().await;
    if let Some(b) = badges.get_mut(&id) {
        b.name = payload.name;
        b.description = payload.description;
        b.icon_url = payload.icon_url;
        b.points_required = payload.points_required;
        Ok(Json(b.clone()))
    } else {
        Err((StatusCode::NOT_FOUND, "Badge not found".to_string()))
    }
}

// 10. Delete Badge
pub async fn delete_badge(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let mut badges = db.badges.write().await;
    if badges.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Badge not found".to_string()))
    }
}

// 11. Create Quest
#[derive(Deserialize)]
pub struct CreateQuestReq {
    pub name: String,
    pub description: String,
    pub points_reward: i64,
    pub requirements: serde_json::Value,
    pub active: bool,
}
pub async fn create_quest(
    State(db): State<MockDb>,
    Json(payload): Json<CreateQuestReq>,
) -> Result<Json<Quest>, (StatusCode, String)> {
    let id = Uuid::new_v4();
    let quest = Quest {
        id,
        name: payload.name,
        description: payload.description,
        points_reward: payload.points_reward,
        requirements: payload.requirements,
        active: payload.active,
    };
    db.quests.write().await.insert(id, quest.clone());
    Ok(Json(quest))
}

// 12. Get Quest
pub async fn get_quest(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Quest>, (StatusCode, String)> {
    let quests = db.quests.read().await;
    match quests.get(&id) {
        Some(q) => Ok(Json(q.clone())),
        None => Err((StatusCode::NOT_FOUND, "Quest not found".to_string())),
    }
}

// 13. List Quests
pub async fn list_quests(
    State(db): State<MockDb>,
) -> Result<Json<Vec<Quest>>, (StatusCode, String)> {
    let quests = db.quests.read().await;
    Ok(Json(quests.values().cloned().collect()))
}

// 14. Update Quest
pub async fn update_quest(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateQuestReq>,
) -> Result<Json<Quest>, (StatusCode, String)> {
    let mut quests = db.quests.write().await;
    if let Some(q) = quests.get_mut(&id) {
        q.name = payload.name;
        q.description = payload.description;
        q.points_reward = payload.points_reward;
        q.requirements = payload.requirements.clone();
        q.active = payload.active;
        Ok(Json(q.clone()))
    } else {
        Err((StatusCode::NOT_FOUND, "Quest not found".to_string()))
    }
}

// 15. Delete Quest
pub async fn delete_quest(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let mut quests = db.quests.write().await;
    if quests.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Quest not found".to_string()))
    }
}

// 16. Award Points (Ledger entry + Profile update)
#[derive(Deserialize)]
pub struct AwardPointsReq {
    pub agent_id: Uuid,
    pub points: i64,
    pub reason: String,
    pub source_id: Option<Uuid>,
}
pub async fn award_points(
    State(db): State<MockDb>,
    Json(payload): Json<AwardPointsReq>,
) -> Result<Json<PointsLedger>, (StatusCode, String)> {
    let mut agents = db.agents.write().await;
    let agent = agents
        .get_mut(&payload.agent_id)
        .ok_or((StatusCode::NOT_FOUND, "Agent not found".to_string()))?;

    agent.total_points += payload.points;
    agent.updated_at = Utc::now();

    let entry = PointsLedger {
        id: Uuid::new_v4(),
        agent_id: payload.agent_id,
        points: payload.points,
        reason: payload.reason,
        source_id: payload.source_id,
        timestamp: Utc::now(),
    };

    let mut ledger = db.ledger.write().await;
    ledger.push(entry.clone());

    Ok(Json(entry))
}

// 17. Get Agent Ledger
pub async fn get_agent_ledger(
    State(db): State<MockDb>,
    Path(agent_id): Path<Uuid>,
) -> Result<Json<Vec<PointsLedger>>, (StatusCode, String)> {
    let ledger = db.ledger.read().await;
    let agent_ledger: Vec<PointsLedger> = ledger
        .iter()
        .filter(|l| l.agent_id == agent_id)
        .cloned()
        .collect();
    Ok(Json(agent_ledger))
}

// 18. Unlock Badge for Agent
pub async fn unlock_badge(
    State(db): State<MockDb>,
    Path((agent_id, badge_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AgentProfile>, (StatusCode, String)> {
    let badges = db.badges.read().await;
    if !badges.contains_key(&badge_id) {
        return Err((StatusCode::NOT_FOUND, "Badge not found".to_string()));
    }

    let mut agents = db.agents.write().await;
    let agent = agents
        .get_mut(&agent_id)
        .ok_or((StatusCode::NOT_FOUND, "Agent not found".to_string()))?;

    if !agent.badges.contains(&badge_id) {
        agent.badges.push(badge_id);
        agent.updated_at = Utc::now();
    }

    Ok(Json(agent.clone()))
}

// 19. Get Leaderboard
#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<usize>,
}
pub async fn get_leaderboard(
    State(db): State<MockDb>,
    Query(query): Query<LeaderboardQuery>,
) -> Result<Json<Vec<LeaderboardEntry>>, (StatusCode, String)> {
    let agents = db.agents.read().await;
    let mut list: Vec<AgentProfile> = agents.values().cloned().collect();
    list.sort_by(|a, b| b.total_points.cmp(&a.total_points));

    let limit = query.limit.unwrap_or(10);

    let leaderboard: Vec<LeaderboardEntry> = list
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(i, a)| LeaderboardEntry {
            rank: i + 1,
            agent_id: a.id,
            total_points: a.total_points,
            current_level: a.current_level,
        })
        .collect();

    Ok(Json(leaderboard))
}

// 20. Revoke Badge from Agent
pub async fn revoke_badge(
    State(db): State<MockDb>,
    Path((agent_id, badge_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AgentProfile>, (StatusCode, String)> {
    let mut agents = db.agents.write().await;
    let agent = agents
        .get_mut(&agent_id)
        .ok_or((StatusCode::NOT_FOUND, "Agent not found".to_string()))?;

    agent.badges.retain(|&id| id != badge_id);
    agent.updated_at = Utc::now();

    Ok(Json(agent.clone()))
}
