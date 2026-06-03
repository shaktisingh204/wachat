use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::mock_db::AppState;
use crate::models::*;

// 1. Create Audit Event
pub async fn create_audit_event(
    State(state): State<AppState>,
    Json(payload): Json<CreateAuditEventReq>,
) -> Result<Json<AuditEvent>, StatusCode> {
    let event = AuditEvent {
        id: Uuid::new_v4(),
        document_id: payload.document_id,
        user_id: payload.user_id,
        event_type: payload.event_type,
        timestamp: Utc::now(),
        ip_log: payload.ip_log,
        description: payload.description,
        device_info: payload.device_info,
        location: payload.location,
    };

    state
        .db
        .write()
        .await
        .audit_events
        .insert(event.id, event.clone());
    Ok(Json(event))
}

// 2. Get Audit Event by ID
pub async fn get_audit_event_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AuditEvent>, StatusCode> {
    let db = state.db.read().await;
    if let Some(event) = db.audit_events.get(&id) {
        Ok(Json(event.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 3. List Audit Events for Document
pub async fn list_audit_events_for_document(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Json<Vec<AuditEvent>> {
    let db = state.db.read().await;
    let events = db
        .audit_events
        .values()
        .filter(|e| e.document_id == doc_id)
        .cloned()
        .collect();
    Json(events)
}

// 4. List Audit Events by User
pub async fn list_audit_events_by_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Json<Vec<AuditEvent>> {
    let db = state.db.read().await;
    let events = db
        .audit_events
        .values()
        .filter(|e| e.user_id == Some(user_id))
        .cloned()
        .collect();
    Json(events)
}

// 5. Delete Audit Event (Admin)
pub async fn delete_audit_event(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    let mut db = state.db.write().await;
    if db.audit_events.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// 6. Bulk Create Audit Events
pub async fn bulk_create_audit_events(
    State(state): State<AppState>,
    Json(payloads): Json<Vec<CreateAuditEventReq>>,
) -> Result<Json<Vec<AuditEvent>>, StatusCode> {
    let mut db = state.db.write().await;
    let mut created = Vec::new();

    for payload in payloads {
        let event = AuditEvent {
            id: Uuid::new_v4(),
            document_id: payload.document_id,
            user_id: payload.user_id,
            event_type: payload.event_type,
            timestamp: Utc::now(),
            ip_log: payload.ip_log,
            description: payload.description,
            device_info: payload.device_info,
            location: payload.location,
        };
        db.audit_events.insert(event.id, event.clone());
        created.push(event);
    }
    Ok(Json(created))
}

// 7. Record Crypto Hash
pub async fn record_crypto_hash(
    State(state): State<AppState>,
    Json(payload): Json<RecordCryptoHashReq>,
) -> Result<Json<CryptoHash>, StatusCode> {
    let hash = CryptoHash {
        id: Uuid::new_v4(),
        document_id: payload.document_id,
        hash_value: payload.hash_value,
        algorithm: payload.algorithm,
        timestamp: Utc::now(),
        verified: false,
    };
    state
        .db
        .write()
        .await
        .crypto_hashes
        .insert(hash.id, hash.clone());
    Ok(Json(hash))
}

// 8. Verify Crypto Hash
pub async fn verify_crypto_hash(
    State(state): State<AppState>,
    Json(payload): Json<VerifyHashReq>,
) -> Result<Json<bool>, StatusCode> {
    let mut db = state.db.write().await;

    // Find the hash for document
    for hash in db.crypto_hashes.values_mut() {
        if hash.document_id == payload.document_id && hash.hash_value == payload.hash_value {
            hash.verified = true;
            return Ok(Json(true));
        }
    }
    Ok(Json(false))
}

// 9. List Document Hashes
pub async fn list_document_hashes(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Json<Vec<CryptoHash>> {
    let db = state.db.read().await;
    let hashes = db
        .crypto_hashes
        .values()
        .filter(|h| h.document_id == doc_id)
        .cloned()
        .collect();
    Json(hashes)
}

// 10. Get Latest Document Hash
pub async fn get_latest_document_hash(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<CryptoHash>, StatusCode> {
    let db = state.db.read().await;
    let mut hashes: Vec<_> = db
        .crypto_hashes
        .values()
        .filter(|h| h.document_id == doc_id)
        .collect();

    hashes.sort_by_key(|h| h.timestamp);
    if let Some(latest) = hashes.last() {
        Ok(Json((*latest).clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 11. Generate Certificate of Completion
pub async fn generate_certificate(
    State(state): State<AppState>,
    Json(payload): Json<GenerateCertReq>,
) -> Result<Json<CertificateOfCompletion>, StatusCode> {
    let cert = CertificateOfCompletion {
        id: Uuid::new_v4(),
        document_id: payload.document_id,
        generated_at: Utc::now(),
        reference_number: format!(
            "CERT-{}",
            Uuid::new_v4().to_string().split('-').next().unwrap()
        ),
        total_pages: payload.total_pages,
        total_signatures: payload.total_signatures,
        summary_hash: payload.summary_hash,
        status: CertStatus::Active,
    };
    state
        .db
        .write()
        .await
        .certificates
        .insert(cert.id, cert.clone());
    Ok(Json(cert))
}

// 12. Get Certificate by ID
pub async fn get_certificate_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CertificateOfCompletion>, StatusCode> {
    let db = state.db.read().await;
    if let Some(cert) = db.certificates.get(&id) {
        Ok(Json(cert.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 13. Get Certificate for Document
pub async fn get_certificate_for_document(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<Json<CertificateOfCompletion>, StatusCode> {
    let db = state.db.read().await;
    if let Some(cert) = db.certificates.values().find(|c| c.document_id == doc_id) {
        Ok(Json(cert.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 14. List All Certificates
pub async fn list_all_certificates(
    State(state): State<AppState>,
) -> Json<Vec<CertificateOfCompletion>> {
    let db = state.db.read().await;
    Json(db.certificates.values().cloned().collect())
}

// 15. Delete Certificate
pub async fn delete_certificate(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    let mut db = state.db.write().await;
    if db.certificates.remove(&id).is_some() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// 16. Get Audit Statistics
pub async fn get_audit_statistics(State(state): State<AppState>) -> Json<AuditStatsRes> {
    let db = state.db.read().await;
    let total_events = db.audit_events.len();

    let mut events_by_type = HashMap::new();
    let mut unique_docs = std::collections::HashSet::new();
    let mut unique_users = std::collections::HashSet::new();

    for event in db.audit_events.values() {
        let type_str = format!("{:?}", event.event_type);
        *events_by_type.entry(type_str).or_insert(0) += 1;
        unique_docs.insert(event.document_id);
        if let Some(uid) = event.user_id {
            unique_users.insert(uid);
        }
    }

    Json(AuditStatsRes {
        total_events,
        events_by_type,
        unique_documents: unique_docs.len(),
        unique_users: unique_users.len(),
    })
}

// 17. Filter Audit Events
pub async fn filter_audit_events(
    State(state): State<AppState>,
    Json(filter): Json<FilterAuditReq>,
) -> Json<Vec<AuditEvent>> {
    let db = state.db.read().await;
    let events = db
        .audit_events
        .values()
        .filter(|e| {
            let mut match_doc = true;
            let mut match_user = true;
            let mut match_type = true;
            let mut match_start = true;
            let mut match_end = true;

            if let Some(doc_id) = filter.document_id {
                match_doc = e.document_id == doc_id;
            }
            if let Some(uid) = filter.user_id {
                match_user = e.user_id == Some(uid);
            }
            if let Some(ev_type) = &filter.event_type {
                match_type = e.event_type == *ev_type;
            }
            if let Some(start) = filter.start_date {
                match_start = e.timestamp >= start;
            }
            if let Some(end) = filter.end_date {
                match_end = e.timestamp <= end;
            }

            match_doc && match_user && match_type && match_start && match_end
        })
        .cloned()
        .collect();
    Json(events)
}

// 18. Export Audit Events CSV (Dummy representation)
pub async fn export_audit_events_csv(
    State(state): State<AppState>,
    Path(doc_id): Path<Uuid>,
) -> Result<String, StatusCode> {
    let db = state.db.read().await;
    let events: Vec<_> = db
        .audit_events
        .values()
        .filter(|e| e.document_id == doc_id)
        .collect();

    let mut csv = String::from("id,document_id,user_id,event_type,timestamp,ip_address\n");
    for e in events {
        csv.push_str(&format!(
            "{},{},{:?},{:?},{},{}\n",
            e.id, e.document_id, e.user_id, e.event_type, e.timestamp, e.ip_log.ip_address
        ));
    }
    Ok(csv)
}

// 19. Get IP Log Analytics
pub async fn get_ip_log_analytics(State(state): State<AppState>) -> Json<HashMap<String, usize>> {
    let db = state.db.read().await;
    let mut ip_counts = HashMap::new();

    for event in db.audit_events.values() {
        *ip_counts
            .entry(event.ip_log.ip_address.clone())
            .or_insert(0) += 1;
    }

    Json(ip_counts)
}

// 20. Update Certificate Metadata
pub async fn update_certificate_metadata(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCertMetadataReq>,
) -> Result<Json<CertificateOfCompletion>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(cert) = db.certificates.get_mut(&id) {
        cert.status = payload.status;
        if let Some(ref_num) = payload.reference_number {
            cert.reference_number = ref_num;
        }
        Ok(Json(cert.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// 21. Record System Event
pub async fn record_system_event(
    State(state): State<AppState>,
    Json(desc): Json<String>,
) -> Result<Json<AuditEvent>, StatusCode> {
    let event = AuditEvent {
        id: Uuid::new_v4(),
        document_id: Uuid::nil(),
        user_id: None,
        event_type: EventType::SystemEvent,
        timestamp: Utc::now(),
        ip_log: IpLog {
            ip_address: "127.0.0.1".into(),
            user_agent: "System".into(),
            proxy_info: None,
        },
        description: desc,
        device_info: "Server".into(),
        location: None,
    };
    state
        .db
        .write()
        .await
        .audit_events
        .insert(event.id, event.clone());
    Ok(Json(event))
}

// 22. Health Check
pub async fn health_check() -> &'static str {
    "OK"
}
