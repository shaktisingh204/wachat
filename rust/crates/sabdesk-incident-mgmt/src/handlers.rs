use crate::mock_db::MockDb;
use crate::models::*;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

// 1. List Incidents
pub async fn list_incidents(
    State(db): State<Arc<MockDb>>,
) -> Result<Json<Vec<MajorIncident>>, StatusCode> {
    let incidents = db.incidents.read().await;
    let list: Vec<MajorIncident> = incidents.values().cloned().collect();
    Ok(Json(list))
}

// 2. Create Incident
pub async fn create_incident(
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<(StatusCode, Json<MajorIncident>), StatusCode> {
    let mut incidents = db.incidents.write().await;
    let incident = MajorIncident {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        status: IncidentStatus::Identified,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        reporter_id: payload.reporter_id,
        commander_id: None,
    };
    incidents.insert(incident.id, incident.clone());
    Ok((StatusCode::CREATED, Json(incident)))
}

// 3. Get Incident
pub async fn get_incident(
    Path(id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<MajorIncident>, StatusCode> {
    let incidents = db.incidents.read().await;
    if let Some(incident) = incidents.get(&id) {
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 4. Update Incident Status
pub async fn update_incident_status(
    Path(id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<UpdateIncidentStatusRequest>,
) -> Result<Json<MajorIncident>, StatusCode> {
    let mut incidents = db.incidents.write().await;
    if let Some(incident) = incidents.get_mut(&id) {
        incident.status = payload.status;
        incident.updated_at = Utc::now();
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Assign Commander
pub async fn assign_commander(
    Path(id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<AssignCommanderRequest>,
) -> Result<Json<MajorIncident>, StatusCode> {
    let mut incidents = db.incidents.write().await;
    if let Some(incident) = incidents.get_mut(&id) {
        incident.commander_id = Some(payload.commander_id);
        incident.updated_at = Utc::now();
        Ok(Json(incident.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 6. Delete Incident
pub async fn delete_incident(
    Path(id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
) -> Result<StatusCode, StatusCode> {
    let mut incidents = db.incidents.write().await;
    if incidents.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 7. List War Rooms
pub async fn list_war_rooms(
    State(db): State<Arc<MockDb>>,
) -> Result<Json<Vec<WarRoom>>, StatusCode> {
    let rooms = db.war_rooms.read().await;
    let list: Vec<WarRoom> = rooms.values().cloned().collect();
    Ok(Json(list))
}

// 8. Create War Room
pub async fn create_war_room(
    Path(incident_id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<CreateWarRoomRequest>,
) -> Result<(StatusCode, Json<WarRoom>), StatusCode> {
    let mut rooms = db.war_rooms.write().await;
    let room = WarRoom {
        id: Uuid::new_v4(),
        incident_id,
        meeting_link: payload.meeting_link,
        slack_channel: payload.slack_channel,
        active: true,
        created_at: Utc::now(),
    };
    rooms.insert(room.id, room.clone());
    Ok((StatusCode::CREATED, Json(room)))
}

// 9. Get War Room
pub async fn get_war_room(
    Path((_incident_id, room_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<WarRoom>, StatusCode> {
    let rooms = db.war_rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        Ok(Json(room.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 10. Close War Room
pub async fn close_war_room(
    Path((_incident_id, room_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<WarRoom>, StatusCode> {
    let mut rooms = db.war_rooms.write().await;
    if let Some(room) = rooms.get_mut(&room_id) {
        room.active = false;
        Ok(Json(room.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 11. List Status Pages
pub async fn list_status_pages(
    State(db): State<Arc<MockDb>>,
) -> Result<Json<Vec<PublicStatusPage>>, StatusCode> {
    let pages = db.status_pages.read().await;
    let list: Vec<PublicStatusPage> = pages.values().cloned().collect();
    Ok(Json(list))
}

// 12. Create Status Page
pub async fn create_status_page(
    Path(incident_id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<UpdateStatusPageRequest>,
) -> Result<(StatusCode, Json<PublicStatusPage>), StatusCode> {
    let mut pages = db.status_pages.write().await;
    let page = PublicStatusPage {
        id: Uuid::new_v4(),
        incident_id,
        headline: payload.headline,
        public_message: payload.public_message,
        is_published: payload.is_published,
        last_updated_at: Utc::now(),
    };
    pages.insert(page.id, page.clone());
    Ok((StatusCode::CREATED, Json(page)))
}

// 13. Get Status Page
pub async fn get_status_page(
    Path((_incident_id, page_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<PublicStatusPage>, StatusCode> {
    let pages = db.status_pages.read().await;
    if let Some(page) = pages.get(&page_id) {
        Ok(Json(page.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 14. Update Status Page
pub async fn update_status_page(
    Path((_incident_id, page_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<UpdateStatusPageRequest>,
) -> Result<Json<PublicStatusPage>, StatusCode> {
    let mut pages = db.status_pages.write().await;
    if let Some(page) = pages.get_mut(&page_id) {
        page.headline = payload.headline;
        page.public_message = payload.public_message;
        page.is_published = payload.is_published;
        page.last_updated_at = Utc::now();
        Ok(Json(page.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 15. Delete Status Page
pub async fn delete_status_page(
    Path((_incident_id, page_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
) -> Result<StatusCode, StatusCode> {
    let mut pages = db.status_pages.write().await;
    if pages.remove(&page_id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 16. List Post Mortems
pub async fn list_post_mortems(
    State(db): State<Arc<MockDb>>,
) -> Result<Json<Vec<PostMortem>>, StatusCode> {
    let pms = db.post_mortems.read().await;
    let list: Vec<PostMortem> = pms.values().cloned().collect();
    Ok(Json(list))
}

// 17. Create Post Mortem
pub async fn create_post_mortem(
    Path(incident_id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<CreatePostMortemRequest>,
) -> Result<(StatusCode, Json<PostMortem>), StatusCode> {
    let mut pms = db.post_mortems.write().await;
    let pm = PostMortem {
        id: Uuid::new_v4(),
        incident_id,
        root_cause: payload.root_cause,
        resolution: payload.resolution,
        action_items: payload.action_items,
        is_draft: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    pms.insert(pm.id, pm.clone());
    Ok((StatusCode::CREATED, Json(pm)))
}

// 18. Get Post Mortem
pub async fn get_post_mortem(
    Path((_incident_id, pm_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<PostMortem>, StatusCode> {
    let pms = db.post_mortems.read().await;
    if let Some(pm) = pms.get(&pm_id) {
        Ok(Json(pm.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 19. Update Post Mortem
pub async fn update_post_mortem(
    Path((_incident_id, pm_id)): Path<(Uuid, Uuid)>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<UpdatePostMortemRequest>,
) -> Result<Json<PostMortem>, StatusCode> {
    let mut pms = db.post_mortems.write().await;
    if let Some(pm) = pms.get_mut(&pm_id) {
        if let Some(rc) = payload.root_cause {
            pm.root_cause = Some(rc);
        }
        if let Some(res) = payload.resolution {
            pm.resolution = Some(res);
        }
        if let Some(ai) = payload.action_items {
            pm.action_items = ai;
        }
        if let Some(draft) = payload.is_draft {
            pm.is_draft = draft;
        }
        pm.updated_at = Utc::now();
        Ok(Json(pm.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 20. Blast Communication
pub async fn blast_communication(
    Path(incident_id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
    Json(payload): Json<BlastCommunicationRequest>,
) -> Result<(StatusCode, Json<CommunicationLog>), StatusCode> {
    let mut comms = db.communications.write().await;
    let log = CommunicationLog {
        id: Uuid::new_v4(),
        incident_id,
        sender_id: payload.sender_id,
        message: payload.message,
        channels: payload.channels,
        sent_at: Utc::now(),
    };
    comms.insert(log.id, log.clone());
    Ok((StatusCode::CREATED, Json(log)))
}

// 21. List Communications
pub async fn list_communications(
    Path(incident_id): Path<Uuid>,
    State(db): State<Arc<MockDb>>,
) -> Result<Json<Vec<CommunicationLog>>, StatusCode> {
    let comms = db.communications.read().await;
    let list: Vec<CommunicationLog> = comms
        .values()
        .filter(|c| c.incident_id == incident_id)
        .cloned()
        .collect();
    Ok(Json(list))
}
