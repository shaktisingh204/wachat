//! Crate-local error type for the DLQ writer.
//!
//! The crate-public surface returns `Result<_, sabnode_common::ApiError>`;
//! this enum exists so we can preserve detail (which Mongo / serde call
//! failed) before it gets folded into `ApiError::Internal(anyhow!)` for the
//! HTTP envelope.

use sabnode_common::ApiError;
use thiserror::Error;

/// DLQ-specific failure modes. Variants align with the two write paths
/// `DlqWriter::send_to_dlq` traverses: Mongo insert, then Redis enqueue.
#[derive(Debug, Error)]
pub enum DlqError {
    /// `mongodb::Collection::insert_one` returned an error. Mongo inserts
    /// are best-effort (we log and continue) but the variant is still useful
    /// for the few callers that *do* want to know — `record_processed` is
    /// strict, for example.
    #[error("mongo insert into webhook_logs failed: {0}")]
    Mongo(#[from] mongodb::error::Error),

    /// BSON serialization failed before we got to Mongo. Almost always a
    /// programmer error (we own all the inputs) — captured separately so
    /// the log line can distinguish encode bugs from connection issues.
    #[error("bson encode failed: {0}")]
    BsonEncode(#[from] bson::ser::Error),

    /// Underlying BullMQ producer rejected the enqueue. Mapped to
    /// `ApiError::Internal` because there is no caller-side fix.
    #[error("dlq enqueue failed: {0}")]
    Enqueue(#[source] anyhow::Error),
}

// `thiserror` could `#[from] sabnode_common::ApiError` directly, but we want
// the explicit `Enqueue` variant so logs say "dlq enqueue failed" instead of
// the generic ApiError text. Convert manually at the call site.
impl From<DlqError> for ApiError {
    /// All DLQ failures are server-side from the API's perspective: the
    /// caller (the webhook receiver) cannot do anything useful with detail.
    /// Collapse to `ApiError::Internal` so the central error renderer logs
    /// the chain and ships the standard 500 envelope.
    fn from(err: DlqError) -> Self {
        ApiError::Internal(anyhow::Error::new(err))
    }
}
