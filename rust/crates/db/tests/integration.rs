//! Integration tests for the `sabnode-db` crate.
//!
//! These tests spin up real MongoDB and Redis servers via `testcontainers`,
//! so they require a working Docker daemon. Set `SKIP_TESTCONTAINERS=1` in
//! the environment to skip them (CI without Docker, fast local loops).

use sabnode_db::{MongoHandle, RedisHandle};
use testcontainers::runners::AsyncRunner;
use testcontainers_modules::{mongo::Mongo, redis::Redis};

/// Returns true when the surrounding environment has explicitly opted out of
/// container-backed integration testing.
fn should_skip() -> bool {
    std::env::var("SKIP_TESTCONTAINERS")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

#[tokio::test(flavor = "multi_thread")]
async fn mongo_connect_and_ping() {
    if should_skip() {
        eprintln!("SKIP_TESTCONTAINERS=1 — skipping mongo_connect_and_ping");
        return;
    }

    // Start a fresh MongoDB container for this test only.
    let container = Mongo::default()
        .start()
        .await
        .expect("start mongo container");
    let host = container.get_host().await.expect("container host");
    let port = container
        .get_host_port_ipv4(27017)
        .await
        .expect("container port");
    let uri = format!("mongodb://{host}:{port}");

    let handle = MongoHandle::connect(&uri, "sabnode_test")
        .await
        .expect("connect to mongo");

    // ping() is the only liveness contract we publish, so we exercise it
    // directly rather than poking through the client.
    handle.ping().await.expect("ping should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn redis_connect_and_ping() {
    if should_skip() {
        eprintln!("SKIP_TESTCONTAINERS=1 — skipping redis_connect_and_ping");
        return;
    }

    let container = Redis::default()
        .start()
        .await
        .expect("start redis container");
    let host = container.get_host().await.expect("container host");
    let port = container
        .get_host_port_ipv4(6379)
        .await
        .expect("container port");
    let url = format!("redis://{host}:{port}");

    let handle = RedisHandle::connect(&url).await.expect("connect to redis");
    handle.ping().await.expect("ping should succeed");
}
