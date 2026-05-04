//! Tiny BSON helpers that bridge driver errors into our `ApiError` envelope.
//!
//! Most call sites need to turn an `&str` (typically a path parameter) into an
//! `ObjectId`. Doing that inline forces every handler to write the same map
//! from `bson::oid::Error` to `ApiError::BadRequest`; these helpers centralize
//! that mapping so handlers stay readable.

use bson::oid::ObjectId;
use sabnode_common::error::ApiError;

/// Parse a 24-character hex string into a Mongo `ObjectId`. A parse failure
/// becomes `ApiError::BadRequest("invalid object id: ...")`, which renders as
/// HTTP 400 with our standard JSON envelope.
pub fn oid_from_str(s: &str) -> Result<ObjectId, ApiError> {
    ObjectId::parse_str(s).map_err(|e| ApiError::BadRequest(format!("invalid object id: {e}")))
}

/// Render an `ObjectId` as its canonical 24-character hex string. Provided as
/// a free function so callers do not need to remember the inherent method
/// name and to keep symmetry with `oid_from_str`.
pub fn oid_to_str(oid: &ObjectId) -> String {
    oid.to_hex()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_hex() {
        let raw = "507f1f77bcf86cd799439011";
        let oid = oid_from_str(raw).expect("valid hex");
        assert_eq!(oid_to_str(&oid), raw);
    }

    #[test]
    fn rejects_garbage() {
        let err = oid_from_str("not-an-oid").expect_err("must fail");
        assert!(matches!(err, ApiError::BadRequest(_)));
    }
}
