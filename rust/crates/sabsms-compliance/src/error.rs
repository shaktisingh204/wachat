use thiserror::Error;

#[derive(Error, Debug)]
pub enum ComplianceError {
    #[error("Message violates 10DLC rules: {0}")]
    TenDlcViolation(String),

    #[error("Message violates DLT rules: {0}")]
    DltViolation(String),

    #[error("Message violates TCPA/GDPR rules: {0}")]
    TcpaGdprViolation(String),

    #[error("Recipient has opted out (Suppression list)")]
    OptedOut,

    #[error("Internal compliance error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, ComplianceError>;
