use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use chrono::Utc;
use serde::Deserialize;

use uuid::Uuid;

use crate::{mock_db::Db, models::*};

// 1. Create a new Notary Session
pub async fn create_session(
    State(db): State<Db>,
    Json(payload): Json<CreateSessionRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let session_id = Uuid::new_v4();

    let signers: Vec<Signer> = payload
        .signers
        .into_iter()
        .map(|s| Signer {
            id: Uuid::new_v4(),
            name: s.name,
            email: s.email,
            has_passed_kba: false,
            has_passed_id_verification: false,
            joined_at: None,
        })
        .collect();

    let session = NotarySession {
        id: session_id,
        notary_id: payload.notary_id,
        signers,
        document_ids: payload.document_ids,
        status: SessionStatus::Pending,
        created_at: Utc::now(),
        scheduled_for: payload.scheduled_for,
        completed_at: None,
        recording_id: None,
        identity_check_ids: Vec::new(),
        metadata: payload.metadata.unwrap_or_default(),
    };

    let mut db_write = db.write().await;
    db_write.sessions.insert(session_id, session.clone());

    // Also initialize an empty journal for the session
    let journal_id = Uuid::new_v4();
    let journal = NotaryJournal {
        id: journal_id,
        notary_id: payload.notary_id,
        session_id,
        entries: vec![],
        fee_charged: None,
        sealed_at: None,
        is_audited: false,
    };
    db_write.journals.insert(journal_id, journal);

    Ok((StatusCode::CREATED, Json(session)))
}

// 2. Get Session by ID
pub async fn get_session(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;
    if let Some(session) = db_read.sessions.get(&id) {
        Ok(Json(session.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 3. List all sessions (with optional filtering)
#[derive(Deserialize)]
pub struct ListSessionsQuery {
    pub notary_id: Option<Uuid>,
    pub status: Option<String>,
}

pub async fn list_sessions(
    State(db): State<Db>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;

    let mut sessions: Vec<NotarySession> = db_read.sessions.values().cloned().collect();

    if let Some(notary_id) = query.notary_id {
        sessions.retain(|s| s.notary_id == notary_id);
    }

    if let Some(status_str) = query.status {
        let target_status = match status_str.as_str() {
            "Pending" => Some(SessionStatus::Pending),
            "Scheduled" => Some(SessionStatus::Scheduled),
            "InProgress" => Some(SessionStatus::InProgress),
            "Completed" => Some(SessionStatus::Completed),
            "Failed" => Some(SessionStatus::Failed),
            "Canceled" => Some(SessionStatus::Canceled),
            _ => None,
        };

        if let Some(ts) = target_status {
            sessions.retain(|s| s.status == ts);
        }
    }

    Ok(Json(sessions))
}

// 4. Update Session Status
pub async fn update_session_status(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSessionStatusRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(session) = db_write.sessions.get_mut(&id) {
        session.status = payload.status;
        Ok(Json(session.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 5. Delete Session
pub async fn delete_session(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if db_write.sessions.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 6. Add Signer to Session
pub async fn add_signer_to_session(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateSignerRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(session) = db_write.sessions.get_mut(&id) {
        let signer = Signer {
            id: Uuid::new_v4(),
            name: payload.name,
            email: payload.email,
            has_passed_kba: false,
            has_passed_id_verification: false,
            joined_at: None,
        };
        session.signers.push(signer.clone());
        Ok(Json(signer))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 7. Remove Signer from Session
pub async fn remove_signer_from_session(
    State(db): State<Db>,
    Path((session_id, signer_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(session) = db_write.sessions.get_mut(&session_id) {
        let initial_len = session.signers.len();
        session.signers.retain(|s| s.id != signer_id);
        if session.signers.len() < initial_len {
            Ok(StatusCode::NO_CONTENT)
        } else {
            Err(StatusCode::NOT_FOUND)
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 8. Start Session
pub async fn start_session(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    let mut session_clone = None;
    if let Some(session) = db_write.sessions.get_mut(&id) {
        session.status = SessionStatus::InProgress;
        session_clone = Some(session.clone());
    }

    if let Some(s) = session_clone {
        let mut target_journal_id = None;
        for (j_id, j) in db_write.journals.iter() {
            if j.session_id == id {
                target_journal_id = Some(*j_id);
                break;
            }
        }

        if let Some(j_id) = target_journal_id {
            if let Some(journal) = db_write.journals.get_mut(&j_id) {
                journal.entries.push(JournalEntry {
                    entry_id: Uuid::new_v4(),
                    timestamp: Utc::now(),
                    action_type: JournalActionType::SessionStarted,
                    description: "Session successfully started by Notary.".to_string(),
                    signer_id: None,
                    ip_address: None,
                });
            }
        }

        Ok(Json(s))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 9. Complete Session
pub async fn complete_session(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(session) = db_write.sessions.get_mut(&id) {
        session.status = SessionStatus::Completed;
        session.completed_at = Some(Utc::now());
        Ok(Json(session.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 10. Add Identity Check
pub async fn add_identity_check(
    State(db): State<Db>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<AddIdentityCheckRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    if !db_write.sessions.contains_key(&session_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let check_id = Uuid::new_v4();
    let check = IdentityCheck {
        id: check_id,
        session_id,
        signer_id: payload.signer_id,
        check_type: payload.check_type,
        provider: payload.provider,
        status: payload.status,
        score: payload.score,
        timestamp: Utc::now(),
        details: payload.details,
    };

    db_write.identity_checks.insert(check_id, check.clone());

    // Add to session's check ids
    if let Some(session) = db_write.sessions.get_mut(&session_id) {
        session.identity_check_ids.push(check_id);
    }

    Ok((StatusCode::CREATED, Json(check)))
}

// 11. Get Identity Checks for Session
pub async fn get_identity_checks_for_session(
    State(db): State<Db>,
    Path(session_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;

    if !db_read.sessions.contains_key(&session_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let checks: Vec<IdentityCheck> = db_read
        .identity_checks
        .values()
        .filter(|c| c.session_id == session_id)
        .cloned()
        .collect();

    Ok(Json(checks))
}

// 12. Get Identity Check
pub async fn get_identity_check(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;
    if let Some(check) = db_read.identity_checks.get(&id) {
        Ok(Json(check.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 13. Verify Signer
pub async fn verify_signer(
    State(db): State<Db>,
    Path((session_id, signer_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    let session = db_write
        .sessions
        .get_mut(&session_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let signer = session
        .signers
        .iter_mut()
        .find(|s| s.id == signer_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    signer.has_passed_id_verification = true;
    signer.has_passed_kba = true;

    Ok(Json(signer.clone()))
}

// 14. Add Video Recording
pub async fn add_video_recording(
    State(db): State<Db>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<AddVideoRecordingRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    let recording_id = Uuid::new_v4();
    let recording = VideoRecording {
        id: recording_id,
        session_id,
        storage_url: payload.storage_url,
        duration_seconds: payload.duration_seconds,
        file_size_bytes: payload.file_size_bytes,
        format: payload.format,
        started_at: payload.started_at,
        ended_at: payload.ended_at,
        retention_policy_days: 3650, // Default 10 years for notary journals
    };

    db_write
        .video_recordings
        .insert(recording_id, recording.clone());

    if let Some(session) = db_write.sessions.get_mut(&session_id) {
        session.recording_id = Some(recording_id);
    }

    Ok((StatusCode::CREATED, Json(recording)))
}

// 15. Get Video Recording
pub async fn get_video_recording(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;
    if let Some(recording) = db_read.video_recordings.get(&id) {
        Ok(Json(recording.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 16. List Video Recordings
pub async fn list_video_recordings(State(db): State<Db>) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;
    let recordings: Vec<VideoRecording> = db_read.video_recordings.values().cloned().collect();
    Ok(Json(recordings))
}

// 17. Get Journal by Session ID
pub async fn get_journal_by_session(
    State(db): State<Db>,
    Path(session_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;

    let journal = db_read
        .journals
        .values()
        .find(|j| j.session_id == session_id);

    if let Some(j) = journal {
        Ok(Json(j.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 18. Add Journal Entry
pub async fn add_journal_entry(
    State(db): State<Db>,
    Path(journal_id): Path<Uuid>,
    Json(payload): Json<CreateJournalEntryRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    if let Some(journal) = db_write.journals.get_mut(&journal_id) {
        let entry = JournalEntry {
            entry_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            action_type: payload.action_type,
            description: payload.description,
            signer_id: payload.signer_id,
            ip_address: payload.ip_address,
        };
        journal.entries.push(entry.clone());
        Ok(Json(entry))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 19. Get Journal
pub async fn get_journal(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;
    if let Some(journal) = db_read.journals.get(&id) {
        Ok(Json(journal.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 20. Seal Journal
pub async fn seal_journal(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SealJournalRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(journal) = db_write.journals.get_mut(&id) {
        journal.fee_charged = payload.fee_charged;
        journal.sealed_at = Some(Utc::now());
        Ok(Json(journal.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 21. Audit Journal
pub async fn audit_journal(
    State(db): State<Db>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;
    if let Some(journal) = db_write.journals.get_mut(&id) {
        journal.is_audited = true;
        Ok(Json(journal.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 22. Get Session Analytics
#[derive(serde::Serialize)]
pub struct SessionAnalytics {
    pub total_sessions: usize,
    pub completed_sessions: usize,
    pub failed_sessions: usize,
    pub total_journals_sealed: usize,
}

pub async fn get_session_analytics(State(db): State<Db>) -> Result<impl IntoResponse, StatusCode> {
    let db_read = db.read().await;

    let total_sessions = db_read.sessions.len();
    let completed_sessions = db_read
        .sessions
        .values()
        .filter(|s| s.status == SessionStatus::Completed)
        .count();
    let failed_sessions = db_read
        .sessions
        .values()
        .filter(|s| s.status == SessionStatus::Failed)
        .count();
    let total_journals_sealed = db_read
        .journals
        .values()
        .filter(|j| j.sealed_at.is_some())
        .count();

    let analytics = SessionAnalytics {
        total_sessions,
        completed_sessions,
        failed_sessions,
        total_journals_sealed,
    };

    Ok(Json(analytics))
}

// 23. Bulk Delete Sessions (for cleanup/admin)
#[derive(Deserialize)]
pub struct BulkDeleteRequest {
    pub session_ids: Vec<Uuid>,
}

pub async fn bulk_delete_sessions(
    State(db): State<Db>,
    Json(payload): Json<BulkDeleteRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut db_write = db.write().await;

    let mut deleted = 0;
    for id in payload.session_ids {
        if db_write.sessions.remove(&id).is_some() {
            deleted += 1;
        }
    }

    Ok(Json(serde_json::json!({
        "deleted_count": deleted
    })))
}
