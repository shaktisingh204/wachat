//! Integration test for `BullProducer::add` against a real Redis instance.
//!
//! Uses `testcontainers-modules::redis` so CI is hermetic; locally you can
//! skip the test (when Docker isn't available) by setting
//! `SKIP_TESTCONTAINERS=1` — the test prints the reason and returns Ok.
//!
//! What we verify:
//!   1. `add()` returns a non-empty job id.
//!   2. The job hash exists at `bull:{queue}:{id}` and contains the
//!      BullMQ-shaped fields (`name`, `data`, `opts`, `timestamp`,
//!      `delay`, `priority`, `attemptsMade`).
//!   3. Immediate jobs land in `bull:{queue}:wait`.
//!   4. Custom-jobId dedupe is a no-op (second add returns same id, list
//!      length stays 1).
//!   5. Delayed jobs land in `bull:{queue}:delayed`.
//!   6. Prioritized jobs land in `bull:{queue}:prioritized`.

use std::collections::HashMap;

use fred::interfaces::{HashesInterface, KeysInterface, ListInterface, SortedSetsInterface};
use sabnode_db::redis::RedisHandle;
use serde::Serialize;
use testcontainers_modules::{
    redis::Redis,
    testcontainers::{ImageExt, runners::AsyncRunner},
};
use wachat_queue::{Backoff, BullProducer, JobOptions};

#[derive(Serialize)]
struct BroadcastPayload<'a> {
    #[serde(rename = "broadcastId")]
    broadcast_id: &'a str,
}

/// Returns `Some(reason)` when the test should be skipped, `None` to run.
fn skip_reason() -> Option<&'static str> {
    if std::env::var("SKIP_TESTCONTAINERS").is_ok() {
        return Some("SKIP_TESTCONTAINERS set");
    }
    None
}

/// Spin up a fresh Redis and produce a connected `RedisHandle`. We pin the
/// container so multiple test cases below can share startup, while still
/// running independently if invoked alone.
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

#[tokio::test]
async fn add_writes_bullmq_compatible_job_hash() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let producer = BullProducer::new(redis.clone());

    let queue = "broadcast-control";
    let opts = JobOptions {
        job_id: Some("bcast_abc123".into()),
        priority: Some(1_000),
        backoff: Backoff::Exponential { delay_ms: 5_000 },
        attempts: 5,
        ..Default::default()
    };

    let id = producer
        .add(
            queue,
            "process-broadcast",
            &BroadcastPayload {
                broadcast_id: "abc123",
            },
            opts,
        )
        .await
        .expect("add succeeds");
    assert_eq!(id, "bcast_abc123", "custom jobId echoed back as the id");

    // Job hash exists at the BullMQ-compatible key and carries the
    // expected fields. We do this with HGETALL to surface unexpected
    // extras, not just confirm what we asked for.
    let job_key = format!("bull:{queue}:{id}");
    let hash: HashMap<String, String> = redis
        .client
        .hgetall(&job_key)
        .await
        .expect("HGETALL job hash");

    assert_eq!(
        hash.get("name").map(String::as_str),
        Some("process-broadcast")
    );
    let data_json: serde_json::Value =
        serde_json::from_str(hash.get("data").expect("data field present")).expect("data is JSON");
    assert_eq!(data_json["broadcastId"], "abc123");

    let opts_json: serde_json::Value =
        serde_json::from_str(hash.get("opts").expect("opts field present")).expect("opts is JSON");
    assert_eq!(opts_json["attempts"], 5);
    assert_eq!(opts_json["priority"], 1_000);
    assert_eq!(opts_json["backoff"]["type"], "exponential");

    // Numeric scalars are serialized as decimal strings inside the hash —
    // BullMQ stores them this way and `Job#fromRedis` parses with Number().
    assert_eq!(hash.get("priority").map(String::as_str), Some("1000"));
    assert_eq!(hash.get("delay").map(String::as_str), Some("0"));
    assert_eq!(hash.get("attemptsMade").map(String::as_str), Some("0"));
    assert!(hash.contains_key("timestamp"));

    // Prioritized job → goes into the prioritized zset, NOT the wait list.
    // (The minimal Lua treats any priority > 0 as "prioritized" matching
    // BullMQ's branching.)
    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{queue}:wait"))
        .await
        .expect("LLEN wait");
    assert_eq!(wait_len, 0, "prioritized job must not land in wait");

    let prio_count: i64 = redis
        .client
        .zcard(format!("bull:{queue}:prioritized"))
        .await
        .expect("ZCARD prioritized");
    assert_eq!(prio_count, 1, "prioritized zset has the job");
}

#[tokio::test]
async fn dedupe_by_job_id_is_a_no_op() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let producer = BullProducer::new(redis.clone());

    let queue = "broadcast-control";
    let job_id = "bcast_dedupe_test";

    // First add lands.
    let id1 = producer
        .add(
            queue,
            "process-broadcast",
            &BroadcastPayload {
                broadcast_id: "dedupe",
            },
            JobOptions {
                job_id: Some(job_id.into()),
                ..Default::default()
            },
        )
        .await
        .expect("first add");
    assert_eq!(id1, job_id);

    // Second add with the same jobId is a no-op — same id back, queue
    // length unchanged. This is the property `enqueueBroadcastControl`
    // depends on for retry-safety in `broadcast-queue.ts`.
    let id2 = producer
        .add(
            queue,
            "process-broadcast",
            &BroadcastPayload {
                broadcast_id: "dedupe",
            },
            JobOptions {
                job_id: Some(job_id.into()),
                ..Default::default()
            },
        )
        .await
        .expect("second add");
    assert_eq!(id2, job_id);

    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{queue}:wait"))
        .await
        .expect("LLEN wait");
    assert_eq!(wait_len, 1, "duplicate add did not double-enqueue");
}

#[tokio::test]
async fn auto_generated_id_when_no_job_id_set() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let producer = BullProducer::new(redis.clone());
    let queue = "broadcast-send";

    let id = producer
        .add(
            queue,
            "send-batch",
            &BroadcastPayload {
                broadcast_id: "auto",
            },
            JobOptions::default(), // no jobId
        )
        .await
        .expect("add");

    // BullMQ ids are decimal strings sourced from INCR on `:id`.
    assert!(id.parse::<u64>().is_ok(), "auto id is numeric, got {id:?}");

    // Counter advanced.
    let counter: String = redis
        .client
        .get(format!("bull:{queue}:id"))
        .await
        .expect("GET id counter");
    assert_eq!(counter, id);

    // No priority and no delay → wait list.
    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{queue}:wait"))
        .await
        .expect("LLEN wait");
    assert_eq!(wait_len, 1);
}

#[tokio::test]
async fn delayed_job_lands_in_delayed_zset() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping integration test: {reason}");
        return;
    }

    let (redis, _container) = boot_redis().await;
    let producer = BullProducer::new(redis.clone());
    let queue = "broadcast-send";

    let _id = producer
        .add(
            queue,
            "send-batch",
            &BroadcastPayload {
                broadcast_id: "delayed",
            },
            JobOptions {
                delay_ms: Some(60_000),
                ..Default::default()
            },
        )
        .await
        .expect("add");

    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{queue}:wait"))
        .await
        .expect("LLEN wait");
    assert_eq!(wait_len, 0, "delayed job must not land in wait");

    let delayed_count: i64 = redis
        .client
        .zcard(format!("bull:{queue}:delayed"))
        .await
        .expect("ZCARD delayed");
    assert_eq!(delayed_count, 1, "delayed zset has the job");
}
