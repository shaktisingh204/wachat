use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::mock_db::Db;
use crate::models::*;

// Helper to validate token
async fn get_session(db: &Db, token: &str) -> Option<SessionToken> {
    let db = db.read().await;
    let session = db.session_tokens.get(token)?;
    if !session.is_valid || session.expires_at < Utc::now() {
        return None;
    }
    Some(session.clone())
}

pub async fn ping() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({"status": "ok"})))
}

pub async fn validate_session(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    if let Some(session) = get_session(&db, &token).await {
        (StatusCode::OK, Json(session)).into_response()
    } else {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid or expired token"})),
        )
            .into_response()
    }
}

pub async fn get_document_info(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    if let Some(doc) = db_read.documents.get(&session.document_id) {
        (StatusCode::OK, Json(json!(doc)))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Document not found"})),
        )
    }
}

pub async fn get_agreement_info(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let signer = db_read.signers.get(&session.signer_id).unwrap();
    if let Some(agr) = db_read.agreements.get(&signer.agreement_id) {
        (StatusCode::OK, Json(json!(agr)))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Agreement not found"})),
        )
    }
}

pub async fn get_signer_info(Path(token): Path<String>, State(db): State<Db>) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    if let Some(signer) = db_read.signers.get(&session.signer_id) {
        (StatusCode::OK, Json(json!(signer)))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Signer not found"})),
        )
    }
}

pub async fn list_signature_fields(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let fields: Vec<_> = db_read
        .signature_fields
        .values()
        .filter(|f| f.signer_id == session.signer_id && f.document_id == session.document_id)
        .cloned()
        .collect();

    (StatusCode::OK, Json(json!(fields)))
}

pub async fn adopt_signature(
    Path(token): Path<String>,
    State(db): State<Db>,
    Json(payload): Json<AdoptSignatureRequest>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let new_sig = AdoptedSignature {
        id: Uuid::new_v4(),
        signer_id: session.signer_id,
        signature_text: payload.signature_text,
        signature_image_url: payload.signature_image_url,
        signature_type: payload.signature_type,
        created_at: Utc::now(),
    };

    let mut db_write = db.write().await;
    db_write
        .adopted_signatures
        .insert(new_sig.id, new_sig.clone());

    (StatusCode::CREATED, Json(json!(new_sig)))
}

pub async fn get_adopted_signatures(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let sigs: Vec<_> = db_read
        .adopted_signatures
        .values()
        .filter(|s| s.signer_id == session.signer_id)
        .cloned()
        .collect();

    (StatusCode::OK, Json(json!(sigs)))
}

pub async fn delete_adopted_signature(
    Path((token, sig_id)): Path<(String, Uuid)>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    if let Some(sig) = db_write.adopted_signatures.get(&sig_id) {
        if sig.signer_id == session.signer_id {
            db_write.adopted_signatures.remove(&sig_id);
            return (StatusCode::OK, Json(json!({"status": "deleted"})));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Signature not found"})),
    )
}

pub async fn start_verification(
    Path(token): Path<String>,
    State(db): State<Db>,
    Json(payload): Json<StartVerificationRequest>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let ver = IdentityVerification {
        id: Uuid::new_v4(),
        signer_id: session.signer_id,
        method: payload.method,
        status: "pending".to_string(),
        verified_at: None,
        attempt_count: 0,
    };

    let mut db_write = db.write().await;
    db_write.identity_verifications.insert(ver.id, ver.clone());

    (StatusCode::CREATED, Json(json!(ver)))
}

pub async fn check_verification_status(
    Path((token, ver_id)): Path<(String, Uuid)>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    if let Some(ver) = db_read.identity_verifications.get(&ver_id) {
        if ver.signer_id == session.signer_id {
            return (StatusCode::OK, Json(json!(ver)));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Verification not found"})),
    )
}

pub async fn complete_verification(
    Path((token, ver_id)): Path<(String, Uuid)>,
    State(db): State<Db>,
    Json(payload): Json<CompleteVerificationRequest>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    if let Some(ver) = db_write.identity_verifications.get_mut(&ver_id) {
        if ver.signer_id == session.signer_id {
            if payload.code == "123456" {
                // mock validation
                ver.status = "verified".to_string();
                ver.verified_at = Some(Utc::now());
                return (StatusCode::OK, Json(json!(ver)));
            } else {
                ver.attempt_count += 1;
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "Invalid code"})),
                );
            }
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Verification not found"})),
    )
}

pub async fn apply_signature_to_field(
    Path(token): Path<String>,
    State(db): State<Db>,
    Json(payload): Json<ApplySignatureRequest>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;

    // verify signature belongs to signer
    if !db_write
        .adopted_signatures
        .contains_key(&payload.adopted_signature_id)
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid adopted signature"})),
        );
    }

    if let Some(field) = db_write.signature_fields.get_mut(&payload.field_id) {
        if field.signer_id == session.signer_id {
            field.is_signed = true;
            return (StatusCode::OK, Json(json!(field)));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Field not found"})),
    )
}

pub async fn remove_signature_from_field(
    Path((token, field_id)): Path<(String, Uuid)>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    if let Some(field) = db_write.signature_fields.get_mut(&field_id) {
        if field.signer_id == session.signer_id {
            field.is_signed = false;
            return (StatusCode::OK, Json(json!(field)));
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Field not found"})),
    )
}

pub async fn finalize_agreement(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    let agreement_id = {
        let signer = db_write.signers.get(&session.signer_id).unwrap();
        signer.agreement_id
    };

    // Check if all fields are signed
    let all_signed = db_write
        .signature_fields
        .values()
        .filter(|f| f.signer_id == session.signer_id)
        .all(|f| f.is_signed);

    if !all_signed {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Not all required fields are signed"})),
        );
    }

    if let Some(signer) = db_write.signers.get_mut(&session.signer_id) {
        signer.status = "signed".to_string();
    }

    // Log action
    let audit_log = AuditLog {
        id: Uuid::new_v4(),
        agreement_id,
        action: "signer_completed".to_string(),
        ip_address: Some("127.0.0.1".to_string()),
        timestamp: Utc::now(),
        description: "Signer completed the signing process".to_string(),
    };
    db_write.audit_logs.push(audit_log);

    (
        StatusCode::OK,
        Json(json!({"status": "Agreement finalized by signer"})),
    )
}

pub async fn decline_agreement(
    Path(token): Path<String>,
    State(db): State<Db>,
    Json(payload): Json<DeclineAgreementRequest>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    let agreement_id = {
        let signer = db_write.signers.get(&session.signer_id).unwrap();
        signer.agreement_id
    };

    if let Some(signer) = db_write.signers.get_mut(&session.signer_id) {
        signer.status = "declined".to_string();
    }
    if let Some(agr) = db_write.agreements.get_mut(&agreement_id) {
        agr.status = "declined".to_string();
    }

    let audit_log = AuditLog {
        id: Uuid::new_v4(),
        agreement_id,
        action: "signer_declined".to_string(),
        ip_address: None,
        timestamp: Utc::now(),
        description: format!("Signer declined: {}", payload.reason),
    };
    db_write.audit_logs.push(audit_log);

    (
        StatusCode::OK,
        Json(json!({"status": "Agreement declined"})),
    )
}

pub async fn download_document(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    if let Some(doc) = db_read.documents.get(&session.document_id) {
        (StatusCode::OK, Json(json!({"download_url": doc.file_url})))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Document not found"})),
        )
    }
}

pub async fn get_audit_logs(Path(token): Path<String>, State(db): State<Db>) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let agreement_id = db_read
        .signers
        .get(&session.signer_id)
        .unwrap()
        .agreement_id;

    let logs: Vec<_> = db_read
        .audit_logs
        .iter()
        .filter(|l| l.agreement_id == agreement_id)
        .cloned()
        .collect();

    (StatusCode::OK, Json(json!(logs)))
}

pub async fn list_other_signers(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let agreement_id = db_read
        .signers
        .get(&session.signer_id)
        .unwrap()
        .agreement_id;

    let signers: Vec<_> = db_read
        .signers
        .values()
        .filter(|s| s.agreement_id == agreement_id && s.id != session.signer_id)
        .cloned()
        .collect();

    (StatusCode::OK, Json(json!(signers)))
}

pub async fn update_signer_info(
    Path(token): Path<String>,
    State(db): State<Db>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let mut db_write = db.write().await;
    if let Some(signer) = db_write.signers.get_mut(&session.signer_id) {
        if let Some(name) = payload.get("name").and_then(|n| n.as_str()) {
            signer.name = name.to_string();
        }
        (StatusCode::OK, Json(json!(signer)))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Signer not found"})),
        )
    }
}

pub async fn get_all_fields_status(
    Path(token): Path<String>,
    State(db): State<Db>,
) -> impl IntoResponse {
    let session = match get_session(&db, &token).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Unauthorized"})),
            )
        }
    };

    let db_read = db.read().await;
    let fields: Vec<_> = db_read
        .signature_fields
        .values()
        .filter(|f| f.document_id == session.document_id)
        .cloned()
        .collect();

    let total = fields.len();
    let signed = fields.iter().filter(|f| f.is_signed).count();

    (
        StatusCode::OK,
        Json(json!({
            "total_fields": total,
            "signed_fields": signed,
            "is_complete": total == signed && total > 0
        })),
    )
}
