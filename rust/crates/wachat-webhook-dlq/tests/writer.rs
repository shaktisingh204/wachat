//! Integration tests for [`wachat_webhook_dlq::DlqWriter`].
//!
//! Spins up real MongoDB and Redis containers via `testcontainers` so the
//! Mongo insert and BullMQ enqueue can be observed end-to-end. CI without
//! Docker can opt out via `SKIP_TESTCONTAINERS=1`.
//!
//! What we verify:
//!   1. `send_to_dlq` returns a non-empty `DlqId`.
//!   2. The Mongo `webhook_logs` row carries every field the slice contract
//!      mandates (`status`, `field`, `payload`, `reason`, `error`,
//!      `projectId`, `receivedAt`, `attemptedAt`, `processed`, `createdAt`).
//!   3. The BullMQ job exists at `bull:wachat-webhook-dlq:dlq_<logId>` with
//!      the expected `{ logId, field, projectId }` payload.
//!   4. `record_processed` writes a `status: "processed"` row but does NOT
//!      touch Redis (DLQ is failure-only).

use std::collections::HashMap;

use bson::{Document, doc, oid::ObjectId};
use fred::interfaces::{HashesInterface, ListInterface};
use sabnode_db::{MongoHandle, RedisHandle};
use serde_json::json;
use testcontainers_modules::{
    mongo::Mongo,
    redis::Redis,
    testcontainers::{ImageExt, runners::AsyncRunner},
};
use wachat_queue::BullProducer;
use wachat_webhook_dlq::{DlqWriter, WEBHOOK_DLQ_QUEUE, WEBHOOK_LOGS_COLLECTION};

/// Centralised opt-out so the eight assertions below all share one source of
/// truth. Returning `Some(reason)` from `skip_reason` keeps the skipped run
/// observable in `cargo test` output.
fn skip_reason() -> Option<&'static str> {
    if std::env::var("SKIP_TESTCONTAINERS").is_ok() {
        return Some("SKIP_TESTCONTAINERS set");
    }
    None
}

/// Boot a Mongo container and connect a `MongoHandle` to it. Returns the
/// container so the caller can keep it alive for the lifetime of the test
/// (dropping the handle tears the container down).
async fn boot_mongo() -> (
    MongoHandle,
    testcontainers_modules::testcontainers::ContainerAsync<Mongo>,
) {
    let container = Mongo::default()
        .start()
        .await
        .expect("start mongo container");
    let host = container
        .get_host()
        .await
        .expect("mongo host")
        .to_string();
    let port = container
        .get_host_port_ipv4(27017)
        .await
        .expect("mongo port");
    let uri = format!("mongodb://{host}:{port}");
    let handle = MongoHandle::connect(&uri, "wachat_webhook_dlq_test")
        .await
        .expect("connect mongo");
    (handle, container)
}

/// Same dance for Redis. We pin to `7-alpine` to match the queue crate's
/// integration test so the two never disagree on BullMQ Lua semantics.
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
        .expect("redis host")
        .to_string();
    let port = container
        .get_host_port_ipv4(6379)
        .await
        .expect("redis port");
    let url = format!("redis://{host}:{port}");
    let handle = RedisHandle::connect(&url).await.expect("connect redis");
    (handle, container)
}

#[tokio::test(flavor = "multi_thread")]
async fn send_to_dlq_writes_mongo_doc_and_enqueues_redis_job() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping: {reason}");
        return;
    }

    let (mongo, _mongo_c) = boot_mongo().await;
    let (redis, _redis_c) = boot_redis().await;
    let producer = BullProducer::new(redis.clone());
    let writer = DlqWriter::new(mongo.clone(), producer);

    // Use a real-looking project id and Meta payload so the test surfaces
    // any BSON conversion regressions for nested arrays / objects.
    let project_id = ObjectId::new().to_hex();
    let payload = json!({
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "WABA_TEST_123",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": { "phone_number_id": "PN_1" },
                    "messages": [{ "id": "wamid.abc", "from": "15555550100" }]
                }
            }]
        }]
    });

    let dlq_id = writer
        .send_to_dlq(
            Some(&project_id),
            "messages",
            &payload,
            "processor_panic",
            Some("InternalProcessorError: division by zero"),
        )
        .await
        .expect("send_to_dlq");

    assert_eq!(dlq_id.as_ref().len(), 24, "DlqId should be a 24-char hex");

    // 1) Mongo doc — assert every field the slice contract mandates.
    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);
    let oid = ObjectId::parse_str(dlq_id.as_ref()).expect("dlq id is hex");
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .expect("find_one")
        .expect("row exists");

    assert_eq!(row.get_str("status").expect("status"), "failed");
    assert_eq!(row.get_str("field").expect("field"), "messages");
    assert_eq!(row.get_str("reason").expect("reason"), "processor_panic");
    assert_eq!(
        row.get_str("error").expect("error"),
        "InternalProcessorError: division by zero",
    );
    assert!(!row.get_bool("processed").expect("processed"));
    assert!(row.get_datetime("receivedAt").is_ok());
    assert!(row.get_datetime("attemptedAt").is_ok());
    assert!(
        row.get_datetime("createdAt").is_ok(),
        "createdAt is required for the TS reader's sort",
    );
    let stored_project = row
        .get_object_id("projectId")
        .expect("projectId stored as ObjectId");
    assert_eq!(stored_project.to_hex(), project_id);

    // Payload round-trips as a nested doc, not a serialized string.
    let payload_doc = row.get_document("payload").expect("payload is document");
    assert_eq!(
        payload_doc.get_str("object").expect("object"),
        "whatsapp_business_account",
    );

    // 2) BullMQ job — under the BullMQ key layout, the job hash lives at
    //    `bull:<queue>:<jobId>`. We use a deterministic jobId of
    //    `dlq_<logId>` so the lookup is free.
    let job_key = format!("bull:{WEBHOOK_DLQ_QUEUE}:dlq_{}", dlq_id.as_ref());
    let hash: HashMap<String, String> = redis
        .client
        .hgetall(&job_key)
        .await
        .expect("HGETALL job hash");

    assert_eq!(
        hash.get("name").map(String::as_str),
        Some("replay-failed-webhook"),
    );
    let data_json: serde_json::Value =
        serde_json::from_str(hash.get("data").expect("data field")).expect("data parses");
    assert_eq!(data_json["logId"], dlq_id.as_ref());
    assert_eq!(data_json["field"], "messages");
    assert_eq!(data_json["projectId"], project_id);

    // Job should land in the wait list (no priority, no delay set).
    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{WEBHOOK_DLQ_QUEUE}:wait"))
        .await
        .expect("LLEN wait");
    assert_eq!(wait_len, 1, "exactly one DLQ job should be waiting");
}

#[tokio::test(flavor = "multi_thread")]
async fn send_to_dlq_with_no_project_id_stores_null() {
    // Mirrors the TS path that writes `projectId: null` for unresolvable
    // webhooks — the receiver still wants the audit row + replay job.
    if let Some(reason) = skip_reason() {
        eprintln!("skipping: {reason}");
        return;
    }
    let (mongo, _mongo_c) = boot_mongo().await;
    let (redis, _redis_c) = boot_redis().await;
    let writer = DlqWriter::new(mongo.clone(), BullProducer::new(redis));

    let dlq_id = writer
        .send_to_dlq(
            None,
            "unknown",
            &json!({ "object": "page", "entry": [] }),
            "no_project_resolved",
            None,
        )
        .await
        .expect("send_to_dlq");

    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);
    let oid = ObjectId::parse_str(dlq_id.as_ref()).expect("dlq id is hex");
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .expect("find_one")
        .expect("row exists");

    // BSON null, not "field absent" — the TS reader uses `projectId: null`
    // for the same case so we mirror it exactly.
    assert!(matches!(row.get("projectId"), Some(bson::Bson::Null)));
    // Optional `error` should not be set when caller passed `None`.
    assert!(row.get("error").is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn record_processed_writes_status_processed_and_skips_redis() {
    if let Some(reason) = skip_reason() {
        eprintln!("skipping: {reason}");
        return;
    }
    let (mongo, _mongo_c) = boot_mongo().await;
    let (redis, _redis_c) = boot_redis().await;
    let writer = DlqWriter::new(mongo.clone(), BullProducer::new(redis.clone()));

    let project_id = ObjectId::new().to_hex();
    writer
        .record_processed(
            Some(&project_id),
            "account_review_update",
            &json!({ "object": "whatsapp_business_account", "entry": [] }),
        )
        .await
        .expect("record_processed");

    // The collection should have exactly one `processed: true` row.
    let coll = mongo.collection::<Document>(WEBHOOK_LOGS_COLLECTION);
    let row = coll
        .find_one(doc! { "status": "processed" })
        .await
        .expect("find_one")
        .expect("row exists");

    assert!(row.get_bool("processed").expect("processed flag"));
    assert_eq!(
        row.get_str("field").expect("field"),
        "account_review_update",
    );

    // Critically — no DLQ job was enqueued. A `KEYS bull:<queue>:*` would be
    // overkill; the wait list is the natural assertion since `record_processed`
    // does not touch Redis at all.
    let wait_len: i64 = redis
        .client
        .llen(format!("bull:{WEBHOOK_DLQ_QUEUE}:wait"))
        .await
        .unwrap_or(0);
    assert_eq!(
        wait_len, 0,
        "record_processed must not enqueue a DLQ replay job",
    );
}
