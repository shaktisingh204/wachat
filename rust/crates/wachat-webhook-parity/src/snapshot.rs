//! Snapshot of the four collections any webhook can mutate.
//!
//! Parity testing works by snapshotting Mongo before a fixture replay and
//! again after, on each stack independently, then diffing the two
//! after-snapshots. Because Mongo collections are unordered, we key documents
//! by `_id` so the diff is stable across replays.
//!
//! We deliberately scope every snapshot to a single `projectId` — the replay
//! workflow allocates a fresh project per run so the two stacks can write to
//! disjoint document sets without interfering with each other.

use anyhow::{Context, Result};
use bson::Document;
use mongodb::Client;
use serde_json::{Map, Value};

/// Collections we sweep on every snapshot. Order matters only for log
/// readability — the diff is keyed by collection name regardless.
pub const SNAPSHOT_COLLECTIONS: &[&str] = &[
    "incoming_messages",
    "outgoing_messages",
    "wa_contacts",
    "conversations",
];

/// Dump every doc matching `{ projectId: <project_id> }` from each tracked
/// collection into a JSON object shaped like:
///
/// ```json
/// {
///   "incoming_messages": { "<doc_id>": { ...doc... }, ... },
///   "outgoing_messages": { ... },
///   ...
/// }
/// ```
///
/// `project_id` is treated as a plain string because some legacy docs store
/// it as a string and others as an `ObjectId`. We try both shapes.
pub async fn snapshot_collections(
    mongo: &Client,
    db: &str,
    project_id: &str,
) -> Result<Value> {
    let database = mongo.database(db);
    let mut out = Map::new();

    for &name in SNAPSHOT_COLLECTIONS {
        let coll = database.collection::<Document>(name);

        // Build an `$or` filter so we catch projectId stored as either string
        // or ObjectId. Using a Document literal here keeps us off the BSON
        // macro which is overkill for a 2-clause filter.
        let mut or_clauses: Vec<Document> = Vec::with_capacity(2);
        or_clauses.push(bson::doc! { "projectId": project_id });
        if let Ok(oid) = bson::oid::ObjectId::parse_str(project_id) {
            or_clauses.push(bson::doc! { "projectId": oid });
        }
        let filter = bson::doc! { "$or": or_clauses };

        let mut cursor = coll
            .find(filter)
            .await
            .with_context(|| format!("find on {name}"))?;

        let mut bucket = Map::new();
        // mongodb 3.x cursors expose an inherent `advance()` /
        // `deserialize_current()` pair so we don't need the `futures`
        // StreamExt traits.
        while cursor
            .advance()
            .await
            .with_context(|| format!("cursor advance on {name}"))?
        {
            let doc = cursor
                .deserialize_current()
                .with_context(|| format!("deserialize on {name}"))?;

            // Use `_id` as the JSON key. Fallback to a synthetic counter only
            // if `_id` is somehow missing (shouldn't happen on real data).
            let key = doc
                .get("_id")
                .map(|b| match b {
                    bson::Bson::ObjectId(oid) => oid.to_hex(),
                    bson::Bson::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .unwrap_or_else(|| format!("__missing_id_{}", bucket.len()));

            // BSON → serde_json via the standard convert path. ObjectIds
            // become `{"$oid": "..."}` strings — diff.rs ignores `_id` so
            // this asymmetry doesn't bite.
            let value: Value = bson::Bson::Document(doc).into_relaxed_extjson();
            bucket.insert(key, value);
        }
        out.insert(name.to_string(), Value::Object(bucket));
    }

    Ok(Value::Object(out))
}
