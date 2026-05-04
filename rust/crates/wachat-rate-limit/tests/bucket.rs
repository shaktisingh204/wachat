//! Integration tests for `TokenBucket` against a real Redis instance.
//!
//! Uses `testcontainers-modules::redis` so CI is hermetic; locally you can
//! skip the test (when Docker isn't available) by setting
//! `SKIP_TESTCONTAINERS=1` — the test prints the reason and returns Ok.
//!
//! What we verify:
//!   1. With capacity=10 and refill=10/s, the first 10 acquires succeed.
//!   2. The 11th immediate acquire is denied with a non-zero retry_after.
//!   3. After sleeping `retry_after`, an acquire succeeds again (refill
//!      put at least one token back).

use std::time::Duration;

use sabnode_db::redis::RedisHandle;
use testcontainers_modules::{
    redis::Redis,
    testcontainers::{ImageExt, runners::AsyncRunner},
};
use wachat_rate_limit::{AcquireResult, TokenBucket};

/// Returns `Some(reason)` when the test should be skipped, `None` to run.
fn skip_reason() -> Option<&'static str> {
    if std::env::var("SKIP_TESTCONTAINERS").is_ok() {
        return Some("SKIP_TESTCONTAINERS set");
    }
    None
}

/// Spin up a fresh Redis and produce a connected `RedisHandle`. We pin the
/// container tag so test runs are reproducible.
async fn boot_redis() -> (
    RedisHandle,
    testcontainers_modules::testcontainers::ContainerAsync<Redis>,
) {
    let container = Redis::default()
        .with_tag("7-alpine")
        .start()
        .await
        .expect("start redis container");

    let host = container
        .get_host()
        .await
        .expect("container host")
        .to_string();
    let port = container
        .get_host_port_ipv4(6379)
        .await
        .expect("container port");

    let url = format!("redis://{host}:{port}");
    let handle = RedisHandle::connect(&url)
        .await
        .expect("RedisHandle::connect");
    (handle, container)
}

#[tokio::test(flavor = "multi_thread")]
async fn token_bucket_grants_then_denies_then_refills() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let bucket = TokenBucket::new(redis);

    // Use a unique bucket key per run so re-runs against a long-lived
    // Redis (if any) don't collide. The container is per-test, but the
    // suffix keeps debugging tractable.
    let bucket_key = "bcast:tb:integration_test";
    let capacity: u32 = 10;
    let refill_per_sec: u32 = 10;

    // 1. First 10 acquires succeed against an empty bucket (it cold-starts
    //    at full capacity per `acquire.lua`).
    for i in 0..capacity {
        let result = bucket
            .try_acquire(bucket_key, capacity, refill_per_sec, 1)
            .await
            .expect("acquire should not error");
        assert_eq!(
            result,
            AcquireResult::Granted,
            "acquire #{i} should be granted at capacity={capacity}"
        );
    }

    // 2. 11th acquire is denied — bucket is empty and barely any time
    //    has elapsed since the last refill.
    let denied = bucket
        .try_acquire(bucket_key, capacity, refill_per_sec, 1)
        .await
        .expect("acquire should not error");
    let retry_after = match denied {
        AcquireResult::Denied { retry_after_ms } => retry_after_ms,
        AcquireResult::Granted => panic!("11th acquire should be denied"),
    };
    assert!(
        retry_after > 0,
        "denied retry_after_ms must be > 0, got {retry_after}"
    );
    // Sanity: at refill=10/s, the wait for 1 token can be at most ~100ms
    // when the bucket is fresh-empty. Anything wildly outside that range
    // points at a bug in the script's math.
    assert!(
        retry_after <= 200,
        "denied retry_after_ms unexpectedly large: {retry_after} > 200"
    );

    // 3. Sleep just past the server-quoted retry, then try again.
    //    A small grace margin absorbs scheduler / clock granularity.
    tokio::time::sleep(Duration::from_millis(retry_after + 50)).await;

    let granted_again = bucket
        .try_acquire(bucket_key, capacity, refill_per_sec, 1)
        .await
        .expect("acquire after sleep should not error");
    assert_eq!(
        granted_again,
        AcquireResult::Granted,
        "acquire after refill must succeed; got {granted_again:?}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn token_bucket_validation_rejects_bad_inputs() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let bucket = TokenBucket::new(redis);

    // capacity=0 is an obvious config bug — the script would never grant.
    let err = bucket
        .try_acquire("bcast:tb:bad", 0, 10, 1)
        .await
        .expect_err("capacity=0 must be rejected");
    assert_eq!(err.code(), "VALIDATION_ERROR");

    // cost > capacity is unsatisfiable; reject early instead of letting
    // the caller spin forever waiting for an impossible refill.
    let err = bucket
        .try_acquire("bcast:tb:bad", 5, 5, 10)
        .await
        .expect_err("cost > capacity must be rejected");
    assert_eq!(err.code(), "VALIDATION_ERROR");
}
