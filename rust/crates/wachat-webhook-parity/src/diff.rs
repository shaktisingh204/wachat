//! Recursive structural diff over two `serde_json::Value` snapshots.
//!
//! The diff intentionally ignores fields that are guaranteed to drift across
//! stacks (`_id`, `createdAt`, `updatedAt`, `receivedAt`) — the Node and Rust
//! receivers stamp their own ObjectIds and timestamps and parity should not
//! flag those. Anything else producing different values is a real divergence
//! and gets emitted as a `Difference`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Field names whose values are stack-specific and never compared.
pub const IGNORED_FIELDS: &[&str] = &["_id", "createdAt", "updatedAt", "receivedAt"];

/// One leaf-level disagreement between the two snapshots.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Difference {
    /// Dot/bracket path inside the snapshot, e.g.
    /// `incoming_messages.65a0...["from"]`.
    pub path: String,
    /// Value as observed in the Rust-receiver snapshot. `null` if missing.
    pub rust_value: Value,
    /// Value as observed in the Node-receiver snapshot. `null` if missing.
    pub node_value: Value,
}

/// Compare two snapshots produced by `snapshot::snapshot_collections` and
/// return every difference. An empty vec means perfect parity.
pub fn diff(rust: &Value, node: &Value) -> Vec<Difference> {
    let mut out = Vec::new();
    walk("", rust, node, &mut out);
    out
}

fn walk(path: &str, a: &Value, b: &Value, out: &mut Vec<Difference>) {
    match (a, b) {
        (Value::Object(am), Value::Object(bm)) => {
            // Union of keys, sorted for deterministic output.
            let mut keys: Vec<&String> =
                am.keys().chain(bm.keys()).collect();
            keys.sort();
            keys.dedup();

            for k in keys {
                if IGNORED_FIELDS.contains(&k.as_str()) {
                    continue;
                }
                let child = if path.is_empty() {
                    k.clone()
                } else {
                    format!("{path}.{k}")
                };
                let av = am.get(k).unwrap_or(&Value::Null);
                let bv = bm.get(k).unwrap_or(&Value::Null);
                walk(&child, av, bv, out);
            }
        }
        (Value::Array(aa), Value::Array(ba)) => {
            // Arrays: compare positionally. Snapshots key by `_id` already so
            // the only arrays we'll encounter here are inside individual docs.
            let len = aa.len().max(ba.len());
            for i in 0..len {
                let child = format!("{path}[{i}]");
                let av = aa.get(i).unwrap_or(&Value::Null);
                let bv = ba.get(i).unwrap_or(&Value::Null);
                walk(&child, av, bv, out);
            }
        }
        (lhs, rhs) => {
            if lhs != rhs {
                out.push(Difference {
                    path: path.to_string(),
                    rust_value: lhs.clone(),
                    node_value: rhs.clone(),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn identical_snapshots_have_no_diff() {
        let a = json!({ "incoming_messages": { "m1": { "from": "a", "_id": "x" } } });
        let b = a.clone();
        assert!(diff(&a, &b).is_empty());
    }

    #[test]
    fn ignored_fields_are_skipped() {
        let a = json!({ "msgs": { "m1": { "_id": "x", "createdAt": "T1" } } });
        let b = json!({ "msgs": { "m1": { "_id": "y", "createdAt": "T2" } } });
        assert!(diff(&a, &b).is_empty());
    }

    #[test]
    fn real_field_divergence_is_reported() {
        let a = json!({ "msgs": { "m1": { "body": "hi" } } });
        let b = json!({ "msgs": { "m1": { "body": "yo" } } });
        let d = diff(&a, &b);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].path, "msgs.m1.body");
    }

    #[test]
    fn missing_doc_shows_up_as_null_on_one_side() {
        let a = json!({ "msgs": { "m1": { "body": "hi" } } });
        let b = json!({ "msgs": {} });
        let d = diff(&a, &b);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].node_value, Value::Null);
    }
}
