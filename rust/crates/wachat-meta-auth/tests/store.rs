//! Integration tests for [`wachat_meta_auth::TokenStore`].
//!
//! These tests require a running MongoDB. Skip them when the environment
//! variable `SKIP_TESTCONTAINERS=1` is set, or when `MONGODB_TEST_URI` is
//! absent (CI without a local Mongo).
//!
//! Run locally with:
//! ```bash
//! MONGODB_TEST_URI=mongodb://localhost:27017 cargo test -p wachat-meta-auth
//! ```

use chrono::Utc;
use wachat_meta_auth::{TokenRecord, TokenStore, TokenType};

fn skip() -> bool {
    std::env::var("SKIP_TESTCONTAINERS").is_ok() || std::env::var("MONGODB_TEST_URI").is_err()
}

async fn make_store() -> TokenStore {
    let uri = std::env::var("MONGODB_TEST_URI").expect("MONGODB_TEST_URI must be set");
    let db_name = format!("wachat_meta_auth_test_{}", uuid_like(),);
    let mongo = sabnode_db::mongo::MongoHandle::connect(&uri, &db_name)
        .await
        .expect("connect to mongo");
    // Use a dedicated collection so we don't touch any real `projects` data
    // even if this points at a shared DB.
    TokenStore::with_collection(mongo, "wachat_meta_auth_test_projects")
}

/// Tiny unique-ish suffix without pulling the `uuid` crate.
fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos}")
}

#[tokio::test]
async fn upsert_then_get_roundtrip() {
    if skip() {
        eprintln!("skipping store_roundtrip (SKIP_TESTCONTAINERS or no MONGODB_TEST_URI)");
        return;
    }

    let store = make_store().await;
    let now = Utc::now();
    let record = TokenRecord {
        waba_id: "WABA_TEST_123".to_owned(),
        phone_number_ids: vec!["PN_1".to_owned(), "PN_2".to_owned()],
        access_token: "EAAGm0PX4ZCpsBO_LIVETOKEN_abcd".to_owned(),
        token_type: TokenType::SystemUser,
        expires_at: None,
        created_at: now,
        updated_at: now,
    };

    store.upsert(&record).await.expect("upsert");

    let fetched = store
        .get_for_waba("WABA_TEST_123")
        .await
        .expect("get")
        .expect("record present");

    assert_eq!(fetched.waba_id, "WABA_TEST_123");
    assert_eq!(fetched.access_token, record.access_token);
    assert_eq!(fetched.token_type, TokenType::SystemUser);
    assert_eq!(fetched.phone_number_ids.len(), 2);

    // Phone-number lookup must hit the same document.
    let by_phone = store
        .get_for_phone_number("PN_1")
        .await
        .expect("get_for_phone_number")
        .expect("record present via phone");
    assert_eq!(by_phone.waba_id, "WABA_TEST_123");

    // Invalidate clears the access token but leaves the document in place.
    store.invalidate("WABA_TEST_123").await.expect("invalidate");
    let after = store
        .get_for_waba("WABA_TEST_123")
        .await
        .expect("get after invalidate")
        .expect("doc still exists");
    assert!(
        after.access_token.is_empty(),
        "access token should be cleared after invalidate"
    );
}

#[tokio::test]
async fn get_for_unknown_waba_returns_none() {
    if skip() {
        return;
    }
    let store = make_store().await;
    let fetched = store
        .get_for_waba("DOES_NOT_EXIST")
        .await
        .expect("get returns Ok(None) for missing");
    assert!(fetched.is_none());
}
