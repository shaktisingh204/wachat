//! Tiny BSON helpers that bridge driver errors into our `ApiError` envelope.
//!
//! Most call sites need to turn an `&str` (typically a path parameter) into an
//! `ObjectId`. Doing that inline forces every handler to write the same map
//! from `bson::oid::Error` to `ApiError::BadRequest`; these helpers centralize
//! that mapping so handlers stay readable.

use bson::{Bson, Document, oid::ObjectId};
use sabnode_common::error::ApiError;
use serde_json::{Map, Value};

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

/// Convert a BSON value to a `serde_json::Value` shaped the way the
/// Next.js side expects after `JSON.parse(JSON.stringify(doc))`:
///
/// - `ObjectId` → plain hex string (no `{ "$oid": ... }` wrapper)
/// - `DateTime` → ISO-8601 string
/// - `Binary` / `ObjectId` / etc. degrade to strings rather than the
///   MongoDB extended-JSON shape, since the TS clients never see EJSON.
///
/// This is the canonical bridge for handlers that pass through stored
/// documents verbatim (sessions, project bundles) — typed DTOs should
/// still go through `serde` for shape stability.
pub fn bson_to_clean_json(bson: Bson) -> Value {
    match bson {
        Bson::Double(n) => serde_json::Number::from_f64(n)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(s) => Value::String(s),
        Bson::Array(arr) => Value::Array(arr.into_iter().map(bson_to_clean_json).collect()),
        Bson::Document(doc) => document_to_clean_json(doc),
        Bson::Boolean(b) => Value::Bool(b),
        Bson::Null | Bson::Undefined => Value::Null,
        Bson::Int32(i) => Value::Number(i.into()),
        Bson::Int64(i) => Value::Number(i.into()),
        Bson::Timestamp(ts) => Value::Number(ts.time.into()),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => Value::String(dt.try_to_rfc3339_string().unwrap_or_default()),
        Bson::Symbol(s) => Value::String(s),
        Bson::Binary(b) => Value::String(hex::encode(b.bytes)),
        Bson::RegularExpression(r) => Value::String(r.pattern),
        Bson::JavaScriptCode(c)
        | Bson::JavaScriptCodeWithScope(bson::JavaScriptCodeWithScope { code: c, .. }) => {
            Value::String(c)
        }
        Bson::Decimal128(d) => Value::String(d.to_string()),
        Bson::DbPointer(_) | Bson::MaxKey | Bson::MinKey => Value::Null,
    }
}

/// Convenience wrapper that converts a `Document` directly. Useful in
/// handlers that have a `Document` rather than a `Bson::Document(_)`.
pub fn document_to_clean_json(doc: Document) -> Value {
    let mut out = Map::with_capacity(doc.len());
    for (k, v) in doc {
        out.insert(k, bson_to_clean_json(v));
    }
    Value::Object(out)
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
