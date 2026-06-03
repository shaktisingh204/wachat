use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::*;

#[derive(Debug, Default, Clone)]
pub struct MockDatabase {
    pub session_tokens: HashMap<String, SessionToken>, // Key is the token string
    pub adopted_signatures: HashMap<Uuid, AdoptedSignature>,
    pub identity_verifications: HashMap<Uuid, IdentityVerification>,
    pub documents: HashMap<Uuid, Document>,
    pub agreements: HashMap<Uuid, Agreement>,
    pub signers: HashMap<Uuid, Signer>,
    pub signature_fields: HashMap<Uuid, SignatureField>,
    pub audit_logs: Vec<AuditLog>,
}

pub type Db = Arc<RwLock<MockDatabase>>;

pub fn new_db() -> Db {
    let mut db = MockDatabase::default();

    // Add some dummy data to the mock db to start with
    let doc_id = Uuid::new_v4();
    let agr_id = Uuid::new_v4();
    let signer_id = Uuid::new_v4();

    db.documents.insert(
        doc_id,
        Document {
            id: doc_id,
            title: "NDA.pdf".to_string(),
            file_url: "https://storage.example.com/nda.pdf".to_string(),
            created_at: chrono::Utc::now(),
            total_pages: 5,
        },
    );

    db.agreements.insert(
        agr_id,
        Agreement {
            id: agr_id,
            document_id: doc_id,
            status: "out_for_signature".to_string(),
            created_at: chrono::Utc::now(),
            completed_at: None,
        },
    );

    db.signers.insert(
        signer_id,
        Signer {
            id: signer_id,
            agreement_id: agr_id,
            email: "signer@example.com".to_string(),
            name: "John Doe".to_string(),
            routing_order: 1,
            status: "pending".to_string(),
        },
    );

    let token = "dummy-secure-token-123".to_string();
    db.session_tokens.insert(
        token.clone(),
        SessionToken {
            id: Uuid::new_v4(),
            token: token,
            document_id: doc_id,
            signer_id: signer_id,
            expires_at: chrono::Utc::now() + chrono::Duration::days(1),
            is_valid: true,
        },
    );

    Arc::new(RwLock::new(db))
}
