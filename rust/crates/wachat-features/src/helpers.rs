//! Shared helpers used by every domain submodule.
//!
//! - [`doc_to_json`] / [`docs_to_json`] convert raw Mongo `Document`s
//!   into `serde_json::Value` with `ObjectId` rendered as the hex string
//!   under `"_id"` and BSON `DateTime` rendered as an ISO 8601 string —
//!   matching the legacy `JSON.parse(JSON.stringify(...))` behavior on
//!   the Node side.
//! - [`opt_oid`] parses an optional 24-char hex into `ObjectId`, mapping
//!   parse errors to `ApiError::BadRequest` so callers don't need their
//!   own error plumbing.

use bson::{Bson, Document, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use serde_json::{Map, Value};

/// Convert a single BSON [`Document`] to a JSON [`Value`], normalizing
/// `ObjectId` and `DateTime` so the wire shape matches what the Node
/// `JSON.parse(JSON.stringify(...))` round-trip would emit.
pub fn doc_to_json(doc: Document) -> Value {
    bson_to_json(Bson::Document(doc))
}

/// Convert a slice of BSON documents to a JSON array.
pub fn docs_to_json(docs: Vec<Document>) -> Value {
    Value::Array(docs.into_iter().map(doc_to_json).collect())
}

fn bson_to_json(b: Bson) -> Value {
    match b {
        Bson::Double(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Bson::String(s) => Value::String(s),
        Bson::Array(arr) => Value::Array(arr.into_iter().map(bson_to_json).collect()),
        Bson::Document(d) => {
            let mut m = Map::with_capacity(d.len());
            for (k, v) in d.into_iter() {
                m.insert(k, bson_to_json(v));
            }
            Value::Object(m)
        }
        Bson::Boolean(b) => Value::Bool(b),
        Bson::Null => Value::Null,
        Bson::Int32(i) => Value::Number(i.into()),
        Bson::Int64(i) => Value::Number(i.into()),
        Bson::ObjectId(oid) => Value::String(oid.to_hex()),
        Bson::DateTime(dt) => {
            let ch = dt.to_chrono();
            Value::String(ch.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        }
        Bson::Timestamp(ts) => Value::String(format!("{}:{}", ts.time, ts.increment)),
        Bson::Decimal128(d) => Value::String(d.to_string()),
        Bson::RegularExpression(r) => Value::String(format!("/{}/{}", r.pattern, r.options)),
        Bson::JavaScriptCode(c) => Value::String(c),
        Bson::JavaScriptCodeWithScope(j) => Value::String(j.code),
        Bson::Symbol(s) => Value::String(s),
        Bson::Binary(b) => {
            // Hex-encode the raw bytes — sufficient for our wire purposes
            // (the wachat-features collections do not store binary fields
            // today). Custom format matches the extended-JSON spirit.
            let mut s = String::with_capacity(b.bytes.len() * 2);
            for byte in b.bytes {
                s.push_str(&format!("{byte:02x}"));
            }
            Value::String(s)
        }
        Bson::Undefined => Value::Null,
        Bson::MaxKey => Value::Null,
        Bson::MinKey => Value::Null,
        Bson::DbPointer(_) => Value::Null,
    }
}

/// Parse a 24-char hex into `ObjectId`, mapping failures to
/// `ApiError::BadRequest` so handlers don't have to repeat the boilerplate.
pub fn opt_oid(hex: &str) -> Result<ObjectId> {
    ObjectId::parse_str(hex).map_err(|_| ApiError::BadRequest(format!("invalid ObjectId: {hex}")))
}
