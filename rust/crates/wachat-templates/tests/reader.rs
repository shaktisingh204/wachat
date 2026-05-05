//! Integration tests for `TemplatesReader`.
//!
//! The pure filter-doc tests live alongside the implementation in
//! `src/reader.rs` (`#[cfg(test)] mod tests`). This file holds the **live
//! round-trip** tests that exercise the actual Mongo driver path.
//!
//! These tests are gated behind the `live-mongo` cargo feature so a plain
//! `cargo test -p wachat-templates` stays hermetic. To run them locally:
//!
//! ```bash
//! TEST_MONGODB_URI="mongodb://localhost:27017" \
//! TEST_MONGODB_DB="wachat_templates_test" \
//! cargo test -p wachat-templates --features live-mongo -- --include-ignored
//! ```
//!
//! The orchestrator wires a real `testcontainers` Mongo into CI in a later
//! slice; until then these tests are `#[ignore]` so they don't fail in
//! environments without a Mongo instance.

use bson::{doc, oid::ObjectId};
use sabnode_db::mongo::MongoHandle;
use wachat_templates::TemplatesReader;

/// Skip helper — returns `None` when the test env vars are absent so the
/// test self-skips with a clear log line instead of failing.
fn mongo_uri() -> Option<(String, String)> {
    let uri = std::env::var("TEST_MONGODB_URI").ok()?;
    let db = std::env::var("TEST_MONGODB_DB").ok()?;
    Some((uri, db))
}

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn list_returns_only_matching_project() {
    let Some((uri, db_name)) = mongo_uri() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project_a = ObjectId::new();
    let project_b = ObjectId::new();

    // Seed two rows under different projects so we can assert the filter
    // really does scope.
    let coll = mongo.collection::<bson::Document>("templates");
    coll.insert_many(vec![
        doc! {
            "projectId": project_a,
            "name": "alpha",
            "language": "en_US",
            "status": "APPROVED",
            "category": "MARKETING",
            "components": [],
            "metaId": "m_a",
        },
        doc! {
            "projectId": project_b,
            "name": "beta",
            "language": "en_US",
            "status": "APPROVED",
            "category": "MARKETING",
            "components": [],
            "metaId": "m_b",
        },
    ])
    .await
    .expect("seed inserts");

    let reader = TemplatesReader::new(mongo.clone());
    let rows = reader.list(&project_a).await.expect("list");

    assert_eq!(rows.len(), 1, "should only return project_a's row");
    assert_eq!(rows[0].project_id, project_a);
    assert_eq!(rows[0].name, "alpha");

    // Cleanup so reruns are idempotent.
    coll.delete_many(doc! { "projectId": { "$in": [project_a, project_b] } })
        .await
        .ok();
}
