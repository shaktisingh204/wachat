//! Tamper-evidence for the SabCRM audit log via per-project hash-chaining.
//!
//! Mongo is append-only **by convention**, not enforcement — a privileged
//! actor with raw DB access could still edit or delete a stored row. To make
//! such tampering *detectable*, every audit event is linked into a
//! cryptographic chain scoped to its `projectId`:
//!
//! ```text
//! prev_hash = hash of the previous event in this project's chain
//!             (the all-zero genesis sentinel for the first event)
//! hash      = sha256( canonical(event) || prev_hash )
//! ```
//!
//! Both `prevHash` and `hash` are stored on the row. Because each `hash`
//! folds in the previous `hash`, editing any historical event (or reordering
//! / deleting one) breaks the link at that point: the recomputed `hash` no
//! longer matches the stored `hash`, and every downstream `prevHash` no
//! longer matches its predecessor. The [`verify`](crate::handlers::verify_chain)
//! endpoint walks a project's chain in insertion order and reports the first
//! broken link.
//!
//! ## Canonical form
//!
//! [`canonical_event`] serializes the *content* fields of an event into a
//! stable, deterministic byte string. The chaining fields (`prevHash` /
//! `hash`) are deliberately excluded — they are derived, not content. Field
//! order is fixed (not Mongo's storage order) and absent optional fields are
//! emitted as an empty value, so the canonical form depends only on the
//! event's logical content, never on BSON layout quirks.

use bson::Document;
use sha2::{Digest, Sha256};

/// The genesis `prevHash` for the first event in a project's chain.
///
/// 64 hex chars of zero — a value no real SHA-256 digest collides with in
/// practice, and an unambiguous "no predecessor" sentinel.
pub const GENESIS_PREV_HASH: &str =
    "0000000000000000000000000000000000000000000000000000000000000000";

/// Pull a string field from a document, defaulting to `""` when absent.
///
/// Canonicalization treats a missing optional field and an empty-string field
/// identically — the append path never stores empty optionals, so the two are
/// already indistinguishable at the content level.
fn field<'a>(doc: &'a Document, key: &str) -> &'a str {
    doc.get_str(key).unwrap_or("")
}

/// Build the canonical byte string for an audit event.
///
/// The output is a newline-delimited `key=value` record over the event's
/// content fields in a **fixed** order. `meta` is folded in as its canonical
/// JSON (via [`canonical_json`]) so structured metadata is order-independent.
/// The chaining fields (`prevHash`, `hash`) and the volatile `_id` are
/// excluded: the chain protects content, and the link to the predecessor is
/// supplied separately when hashing.
pub fn canonical_event(doc: &Document) -> String {
    let meta = doc
        .get("meta")
        .map(canonical_bson)
        .unwrap_or_else(|| "null".to_owned());

    // Fixed field order — independent of BSON storage order.
    format!(
        "projectId={}\nactorId={}\naction={}\nobject={}\nrecordId={}\nsummary={}\ncreatedAt={}\nmeta={}",
        field(doc, "projectId"),
        field(doc, "actorId"),
        field(doc, "action"),
        field(doc, "object"),
        field(doc, "recordId"),
        field(doc, "summary"),
        field(doc, "createdAt"),
        meta,
    )
}

/// Compute the chained hash for an event given its predecessor's hash.
///
/// `hash = lowercase_hex( sha256( canonical(event) || prev_hash ) )`.
pub fn chain_hash(doc: &Document, prev_hash: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(canonical_event(doc).as_bytes());
    hasher.update(prev_hash.as_bytes());
    hex::encode(hasher.finalize())
}

/// Canonicalize a BSON value to a deterministic, order-stable string.
///
/// Documents have their keys sorted so that two logically-equal metadata
/// blobs with different storage order produce the same bytes. Scalars render
/// via their `Display` / debug-stable forms.
fn canonical_bson(value: &bson::Bson) -> String {
    use bson::Bson;
    match value {
        Bson::Document(d) => {
            let mut keys: Vec<&String> = d.keys().collect();
            keys.sort();
            let inner: Vec<String> = keys
                .into_iter()
                .map(|k| format!("{}:{}", canonical_str(k), canonical_bson(&d[k])))
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        Bson::Array(a) => {
            let inner: Vec<String> = a.iter().map(canonical_bson).collect();
            format!("[{}]", inner.join(","))
        }
        Bson::String(s) => canonical_str(s),
        Bson::Boolean(b) => b.to_string(),
        Bson::Int32(n) => n.to_string(),
        Bson::Int64(n) => n.to_string(),
        Bson::Double(f) => format!("{f:?}"),
        Bson::Null => "null".to_owned(),
        other => canonical_str(&other.to_string()),
    }
}

/// Quote a string for the canonical form so delimiters inside values can't be
/// confused with structural separators.
fn canonical_str(s: &str) -> String {
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    #[test]
    fn canonical_form_is_storage_order_independent() {
        let a = doc! { "projectId": "p1", "actorId": "u1", "action": "create" };
        let b = doc! { "action": "create", "actorId": "u1", "projectId": "p1" };
        assert_eq!(canonical_event(&a), canonical_event(&b));
    }

    #[test]
    fn chain_hash_changes_when_content_changes() {
        let a = doc! { "projectId": "p1", "action": "create", "createdAt": "t" };
        let b = doc! { "projectId": "p1", "action": "delete", "createdAt": "t" };
        assert_ne!(
            chain_hash(&a, GENESIS_PREV_HASH),
            chain_hash(&b, GENESIS_PREV_HASH)
        );
    }

    #[test]
    fn chain_hash_depends_on_prev_hash() {
        let e = doc! { "projectId": "p1", "action": "create" };
        assert_ne!(chain_hash(&e, GENESIS_PREV_HASH), chain_hash(&e, "deadbeef"));
    }

    #[test]
    fn meta_order_does_not_affect_hash() {
        let a = doc! { "action": "x", "meta": doc! { "a": 1, "b": 2 } };
        let b = doc! { "action": "x", "meta": doc! { "b": 2, "a": 1 } };
        assert_eq!(canonical_event(&a), canonical_event(&b));
    }
}
