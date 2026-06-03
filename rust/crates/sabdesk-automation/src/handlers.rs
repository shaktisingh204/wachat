use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;

use crate::{
    mock_db::MockDb,
    models::{
        Action, EvaluationResult, Macro, RoutingRule, SlaBreachResult, SlaPolicy, Ticket, Trigger,
    },
};

// --- Triggers ---

pub async fn create_trigger(
    State(db): State<MockDb>,
    Json(mut trigger): Json<Trigger>,
) -> Result<Json<Trigger>, StatusCode> {
    trigger.id = Uuid::new_v4();
    trigger.created_at = Utc::now();
    trigger.updated_at = Utc::now();
    db.triggers.write().await.insert(trigger.id, trigger.clone());
    Ok(Json(trigger))
}

pub async fn get_trigger(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Trigger>, StatusCode> {
    if let Some(trigger) = db.triggers.read().await.get(&id) {
        Ok(Json(trigger.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_trigger(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(mut trigger): Json<Trigger>,
) -> Result<Json<Trigger>, StatusCode> {
    let mut triggers = db.triggers.write().await;
    if let Some(existing) = triggers.get_mut(&id) {
        trigger.id = existing.id;
        trigger.created_at = existing.created_at;
        trigger.updated_at = Utc::now();
        *existing = trigger.clone();
        Ok(Json(trigger))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_trigger(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if db.triggers.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_triggers(
    State(db): State<MockDb>,
) -> Result<Json<Vec<Trigger>>, StatusCode> {
    let triggers = db.triggers.read().await.values().cloned().collect();
    Ok(Json(triggers))
}

pub async fn bulk_delete_triggers(
    State(db): State<MockDb>,
    Json(ids): Json<Vec<Uuid>>,
) -> Result<StatusCode, StatusCode> {
    let mut triggers = db.triggers.write().await;
    for id in ids {
        triggers.remove(&id);
    }
    Ok(StatusCode::NO_CONTENT)
}

// --- Macros ---

pub async fn create_macro(
    State(db): State<MockDb>,
    Json(mut m): Json<Macro>,
) -> Result<Json<Macro>, StatusCode> {
    m.id = Uuid::new_v4();
    m.created_at = Utc::now();
    m.updated_at = Utc::now();
    db.macros.write().await.insert(m.id, m.clone());
    Ok(Json(m))
}

pub async fn get_macro(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Macro>, StatusCode> {
    if let Some(m) = db.macros.read().await.get(&id) {
        Ok(Json(m.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_macro(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(mut m): Json<Macro>,
) -> Result<Json<Macro>, StatusCode> {
    let mut macros = db.macros.write().await;
    if let Some(existing) = macros.get_mut(&id) {
        m.id = existing.id;
        m.created_at = existing.created_at;
        m.updated_at = Utc::now();
        *existing = m.clone();
        Ok(Json(m))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_macro(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if db.macros.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_macros(
    State(db): State<MockDb>,
) -> Result<Json<Vec<Macro>>, StatusCode> {
    let macros = db.macros.read().await.values().cloned().collect();
    Ok(Json(macros))
}

pub async fn apply_macro_to_ticket(
    State(db): State<MockDb>,
    Path((macro_id, ticket_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Ticket>, StatusCode> {
    let m = {
        let macros = db.macros.read().await;
        macros.get(&macro_id).cloned().ok_or(StatusCode::NOT_FOUND)?
    };

    let mut tickets = db.tickets.write().await;
    if let Some(ticket) = tickets.get_mut(&ticket_id) {
        for action in &m.actions {
            match action.field.as_str() {
                "status" => ticket.status = action.value.clone(),
                "priority" => ticket.priority = action.value.clone(),
                _ => {
                    ticket.custom_fields.insert(action.field.clone(), action.value.clone());
                }
            }
        }
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- SLA Policies ---

pub async fn create_sla_policy(
    State(db): State<MockDb>,
    Json(mut policy): Json<SlaPolicy>,
) -> Result<Json<SlaPolicy>, StatusCode> {
    policy.id = Uuid::new_v4();
    policy.created_at = Utc::now();
    policy.updated_at = Utc::now();
    db.sla_policies.write().await.insert(policy.id, policy.clone());
    Ok(Json(policy))
}

pub async fn get_sla_policy(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<SlaPolicy>, StatusCode> {
    if let Some(policy) = db.sla_policies.read().await.get(&id) {
        Ok(Json(policy.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_sla_policy(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(mut policy): Json<SlaPolicy>,
) -> Result<Json<SlaPolicy>, StatusCode> {
    let mut policies = db.sla_policies.write().await;
    if let Some(existing) = policies.get_mut(&id) {
        policy.id = existing.id;
        policy.created_at = existing.created_at;
        policy.updated_at = Utc::now();
        *existing = policy.clone();
        Ok(Json(policy))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_sla_policy(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if db.sla_policies.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_sla_policies(
    State(db): State<MockDb>,
) -> Result<Json<Vec<SlaPolicy>>, StatusCode> {
    let policies = db.sla_policies.read().await.values().cloned().collect();
    Ok(Json(policies))
}

pub async fn calculate_sla_breach(
    State(db): State<MockDb>,
    Path((policy_id, ticket_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<SlaBreachResult>, StatusCode> {
    let ticket = db.tickets.read().await.get(&ticket_id).cloned().ok_or(StatusCode::NOT_FOUND)?;
    let policy = db.sla_policies.read().await.get(&policy_id).cloned().ok_or(StatusCode::NOT_FOUND)?;

    let now = Utc::now();
    let elapsed = now.signed_duration_since(ticket.created_at).num_minutes() as i32;
    
    let first_response_breached = elapsed > policy.first_response_time_minutes as i32;
    let resolution_breached = elapsed > policy.resolution_time_minutes as i32;

    let res = SlaBreachResult {
        ticket_id,
        policy_id,
        first_response_breached,
        resolution_breached,
        remaining_time_minutes: policy.resolution_time_minutes as i32 - elapsed,
    };
    Ok(Json(res))
}

// --- Routing Rules ---

pub async fn create_routing_rule(
    State(db): State<MockDb>,
    Json(mut rule): Json<RoutingRule>,
) -> Result<Json<RoutingRule>, StatusCode> {
    rule.id = Uuid::new_v4();
    rule.created_at = Utc::now();
    rule.updated_at = Utc::now();
    db.routing_rules.write().await.insert(rule.id, rule.clone());
    Ok(Json(rule))
}

pub async fn get_routing_rule(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoutingRule>, StatusCode> {
    if let Some(rule) = db.routing_rules.read().await.get(&id) {
        Ok(Json(rule.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_routing_rule(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(mut rule): Json<RoutingRule>,
) -> Result<Json<RoutingRule>, StatusCode> {
    let mut rules = db.routing_rules.write().await;
    if let Some(existing) = rules.get_mut(&id) {
        rule.id = existing.id;
        rule.created_at = existing.created_at;
        rule.updated_at = Utc::now();
        *existing = rule.clone();
        Ok(Json(rule))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_routing_rule(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if db.routing_rules.write().await.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_routing_rules(
    State(db): State<MockDb>,
) -> Result<Json<Vec<RoutingRule>>, StatusCode> {
    let mut rules: Vec<_> = db.routing_rules.read().await.values().cloned().collect();
    rules.sort_by_key(|r| std::cmp::Reverse(r.weight));
    Ok(Json(rules))
}

// --- Logic/Evaluation ---

fn evaluate_conditions(ticket: &Ticket, conditions: &crate::models::ConditionGroup) -> bool {
    // Check ALL
    for cond in &conditions.all {
        let val_str = match cond.field.as_str() {
            "status" => ticket.status.as_str(),
            "priority" => ticket.priority.as_str(),
            _ => ticket.custom_fields.get(&cond.field).map(|s| s.as_str()).unwrap_or(""),
        };
        if val_str != cond.value.as_str() {
            return false;
        }
    }
    // Check ANY
    if !conditions.any.is_empty() {
        let mut any_match = false;
        for cond in &conditions.any {
            let val_str = match cond.field.as_str() {
                "status" => ticket.status.as_str(),
                "priority" => ticket.priority.as_str(),
                _ => ticket.custom_fields.get(&cond.field).map(|s| s.as_str()).unwrap_or(""),
            };
            if val_str == cond.value.as_str() {
                any_match = true;
                break;
            }
        }
        if !any_match {
            return false;
        }
    }
    true
}

pub async fn evaluate_ticket_rules(
    State(db): State<MockDb>,
    Path(ticket_id): Path<Uuid>,
) -> Result<Json<EvaluationResult>, StatusCode> {
    let ticket = db.tickets.read().await.get(&ticket_id).cloned().ok_or(StatusCode::NOT_FOUND)?;

    let mut result = EvaluationResult {
        ticket_id,
        matched_triggers: vec![],
        matched_routing_rules: vec![],
        matched_sla_policies: vec![],
        applied_actions: vec![],
    };

    let triggers = db.triggers.read().await;
    for trigger in triggers.values().filter(|t| t.is_active) {
        if evaluate_conditions(&ticket, &trigger.conditions) {
            result.matched_triggers.push(trigger.id);
            for action in &trigger.actions {
                result.applied_actions.push(action.clone());
            }
        }
    }

    let routing_rules = db.routing_rules.read().await;
    let mut sorted_rules: Vec<_> = routing_rules.values().filter(|r| r.is_active).collect();
    sorted_rules.sort_by_key(|r| std::cmp::Reverse(r.weight));

    for rule in sorted_rules {
        if evaluate_conditions(&ticket, &rule.conditions) {
            result.matched_routing_rules.push(rule.id);
            break; // Routing usually applies the first highest weight match
        }
    }

    let sla_policies = db.sla_policies.read().await;
    for policy in sla_policies.values().filter(|p| p.is_active) {
        if evaluate_conditions(&ticket, &policy.conditions) {
            result.matched_sla_policies.push(policy.id);
            break; // First match wins
        }
    }

    Ok(Json(result))
}

pub async fn simulate_action(
    Json(data): Json<(Ticket, Vec<Action>)>,
) -> Result<Json<Ticket>, StatusCode> {
    let (mut ticket, actions) = data;
    for action in actions {
        match action.field.as_str() {
            "status" => ticket.status = action.value,
            "priority" => ticket.priority = action.value,
            _ => {
                ticket.custom_fields.insert(action.field, action.value);
            }
        }
    }
    Ok(Json(ticket))
}

// Add a helper for tickets (since it's not strictly part of automation but needed for evaluation)
pub async fn create_ticket(
    State(db): State<MockDb>,
    Json(mut ticket): Json<Ticket>,
) -> Result<Json<Ticket>, StatusCode> {
    ticket.id = Uuid::new_v4();
    ticket.created_at = Utc::now();
    ticket.updated_at = Utc::now();
    db.tickets.write().await.insert(ticket.id, ticket.clone());
    Ok(Json(ticket))
}

pub async fn get_ticket(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Ticket>, StatusCode> {
    if let Some(ticket) = db.tickets.read().await.get(&id) {
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
