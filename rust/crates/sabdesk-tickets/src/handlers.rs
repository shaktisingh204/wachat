use crate::mock_db::AppState;
use crate::models::*;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bson::uuid::Uuid;
use chrono::Utc;

// --- Tickets ---

pub async fn create_ticket(
    State(state): State<AppState>,
    Json(payload): Json<CreateTicketRequest>,
) -> Result<Json<Ticket>, StatusCode> {
    let mut db = state.db.write().await;
    let id = Uuid::new();
    let now = Utc::now();
    let ticket = Ticket {
        id,
        subject: payload.subject.clone(),
        description: payload.description.clone(),
        status: TicketStatus::Open,
        priority: payload.priority,
        requester_id: payload.requester_id,
        assignee_id: None,
        cc_emails: vec![],
        tags: vec![],
        sla_policy_id: None,
        custom_fields: payload.custom_fields.unwrap_or_default(),
        created_at: now,
        updated_at: now,
        due_date: None,
    };
    db.tickets.insert(id, ticket.clone());

    // Log activity
    let log = TicketActivityLog {
        id: Uuid::new(),
        ticket_id: id,
        actor_id: payload.requester_id,
        action: "created".to_string(),
        details: serde_json::json!({ "subject": payload.subject }),
        timestamp: now,
    };
    db.logs.entry(id).or_default().push(log);

    Ok(Json(ticket))
}

pub async fn get_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Ticket>, StatusCode> {
    let db = state.db.read().await;
    if let Some(ticket) = db.tickets.get(&id) {
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn update_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTicketRequest>,
) -> Result<Json<Ticket>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(ticket) = db.tickets.get_mut(&id) {
        if let Some(subject) = payload.subject {
            ticket.subject = subject;
        }
        if let Some(desc) = payload.description {
            ticket.description = desc;
        }
        if let Some(status) = payload.status {
            ticket.status = status;
        }
        if let Some(priority) = payload.priority {
            ticket.priority = priority;
        }
        if let Some(assignee) = payload.assignee_id {
            ticket.assignee_id = Some(assignee);
        }
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_ticket(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    let mut db = state.db.write().await;
    if db.tickets.remove(&id).is_some() {
        db.messages.remove(&id);
        db.logs.remove(&id);
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn list_tickets(
    State(state): State<AppState>,
    Json(filter): Json<FilterTicketsRequest>,
) -> Json<Vec<Ticket>> {
    let db = state.db.read().await;
    let mut results: Vec<Ticket> = db.tickets.values().cloned().collect();

    if let Some(statuses) = filter.status {
        results.retain(|t| statuses.contains(&t.status));
    }
    if let Some(priorities) = filter.priority {
        results.retain(|t| priorities.contains(&t.priority));
    }
    if let Some(assignee) = filter.assignee_id {
        results.retain(|t| t.assignee_id == Some(assignee));
    }
    if let Some(requester) = filter.requester_id {
        results.retain(|t| t.requester_id == requester);
    }
    if let Some(tags) = filter.has_tags {
        results.retain(|t| {
            tags.iter()
                .all(|tag_name| t.tags.iter().any(|tg| tg.name == *tag_name))
        });
    }

    Json(results)
}

// --- Messages ---

pub async fn add_ticket_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddMessageRequest>,
) -> Result<Json<TicketMessage>, StatusCode> {
    let mut db = state.db.write().await;
    if !db.tickets.contains_key(&id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let msg = TicketMessage {
        id: Uuid::new(),
        ticket_id: id,
        sender_id: payload.sender_id,
        content: payload.content,
        created_at: Utc::now(),
        is_internal_note: payload.is_internal_note,
        attachments: vec![],
    };

    db.messages.entry(id).or_default().push(msg.clone());

    if let Some(ticket) = db.tickets.get_mut(&id) {
        ticket.updated_at = Utc::now();
    }

    Ok(Json(msg))
}

pub async fn get_ticket_messages(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Json<Vec<TicketMessage>> {
    let db = state.db.read().await;
    let msgs = db.messages.get(&id).cloned().unwrap_or_default();
    Json(msgs)
}

// --- Specific Actions ---

pub async fn assign_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AssignTicketRequest>,
) -> Result<Json<Ticket>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(ticket) = db.tickets.get_mut(&id) {
        ticket.assignee_id = Some(payload.assignee_id);
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn change_ticket_status(
    State(state): State<AppState>,
    Path((id, status_str)): Path<(Uuid, String)>,
) -> Result<Json<Ticket>, StatusCode> {
    let status = match status_str.to_lowercase().as_str() {
        "open" => TicketStatus::Open,
        "inprogress" => TicketStatus::InProgress,
        "pending" => TicketStatus::Pending,
        "resolved" => TicketStatus::Resolved,
        "closed" => TicketStatus::Closed,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let mut db = state.db.write().await;
    if let Some(ticket) = db.tickets.get_mut(&id) {
        ticket.status = status;
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Tags ---

pub async fn add_ticket_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddTagRequest>,
) -> Result<Json<Ticket>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(ticket) = db.tickets.get_mut(&id) {
        if !ticket.tags.iter().any(|t| t.id == payload.tag.id) {
            ticket.tags.push(payload.tag);
        }
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn remove_ticket_tag(
    State(state): State<AppState>,
    Path((id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Ticket>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(ticket) = db.tickets.get_mut(&id) {
        ticket.tags.retain(|t| t.id != tag_id);
        ticket.updated_at = Utc::now();
        Ok(Json(ticket.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Logs ---

pub async fn get_ticket_activity_logs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Json<Vec<TicketActivityLog>> {
    let db = state.db.read().await;
    let logs = db.logs.get(&id).cloned().unwrap_or_default();
    Json(logs)
}

// --- Bulk Operations ---

pub async fn bulk_update_tickets(
    State(state): State<AppState>,
    Json(payload): Json<BulkUpdateTicketRequest>,
) -> Json<Vec<Ticket>> {
    let mut db = state.db.write().await;
    let mut updated = Vec::new();
    let now = Utc::now();

    for id in payload.ticket_ids {
        if let Some(ticket) = db.tickets.get_mut(&id) {
            if let Some(ref st) = payload.status {
                ticket.status = st.clone();
            }
            if let Some(ref pr) = payload.priority {
                ticket.priority = pr.clone();
            }
            if let Some(assignee) = payload.assignee_id {
                ticket.assignee_id = Some(assignee);
            }
            if let Some(ref tags) = payload.add_tags {
                for t in tags {
                    if !ticket.tags.iter().any(|existing| existing.id == t.id) {
                        ticket.tags.push(t.clone());
                    }
                }
            }
            if let Some(ref remove) = payload.remove_tags {
                ticket.tags.retain(|t| !remove.contains(&t.id));
            }
            ticket.updated_at = now;
            updated.push(ticket.clone());
        }
    }
    Json(updated)
}

// --- Users ---

pub async fn create_user(State(state): State<AppState>, Json(user): Json<User>) -> Json<User> {
    let mut db = state.db.write().await;
    db.users.insert(user.id, user.clone());
    Json(user)
}

pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, StatusCode> {
    let db = state.db.read().await;
    if let Some(user) = db.users.get(&id) {
        Ok(Json(user.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_users(State(state): State<AppState>) -> Json<Vec<User>> {
    let db = state.db.read().await;
    let users = db.users.values().cloned().collect();
    Json(users)
}

// --- Views ---

pub async fn create_ticket_view(
    State(state): State<AppState>,
    Json(view): Json<TicketView>,
) -> Json<TicketView> {
    let mut db = state.db.write().await;
    db.views.insert(view.id, view.clone());
    Json(view)
}

pub async fn get_ticket_view(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketView>, StatusCode> {
    let db = state.db.read().await;
    if let Some(view) = db.views.get(&id) {
        Ok(Json(view.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn execute_ticket_view(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Ticket>>, StatusCode> {
    let db = state.db.read().await;
    if let Some(view) = db.views.get(&id) {
        // Dummy execution - in reality, evaluate `conditions` JSON against tickets
        let tickets = db.tickets.values().cloned().collect();
        Ok(Json(tickets))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Stats ---

#[derive(serde::Serialize)]
pub struct TicketStats {
    total: usize,
    open: usize,
    resolved: usize,
}

pub async fn get_ticket_statistics(State(state): State<AppState>) -> Json<TicketStats> {
    let db = state.db.read().await;
    let mut open = 0;
    let mut resolved = 0;

    for ticket in db.tickets.values() {
        if ticket.status == TicketStatus::Open {
            open += 1;
        } else if ticket.status == TicketStatus::Resolved {
            resolved += 1;
        }
    }

    Json(TicketStats {
        total: db.tickets.len(),
        open,
        resolved,
    })
}
