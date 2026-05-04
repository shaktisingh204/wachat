//! Table-driven tests for `ContactsUpserter::upsert_from_inbound`.
//!
//! Two layers, mirroring the convention established by
//! `wachat-webhook-status::tests::processor`:
//!
//! 1. **Pure DTO / mapping tests** — always run. Build `ChangeValue` JSON
//!    by hand, decode via serde, exercise the wa_id→name index logic.
//!    Does not touch Mongo.
//!
//! 2. **Mongo integration tests** — gated by Docker availability.
//!    Spins up an ephemeral MongoDB via testcontainers, runs the full
//!    upsert pipeline, and asserts the four scenarios called out in the
//!    slice spec:
//!       - brand-new contact     → upserted = 1
//!       - same contact again    → matched  = 1
//!       - profile name change   → name field updated
//!       - missing profile       → name unchanged
//!
//!    Set `SKIP_TESTCONTAINERS=1` to skip the integration layer entirely.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use serde_json::json;
use wachat_meta_dto::webhook::{ChangeValue, ContactProfile, WebhookContact};
use wachat_types::project::Project;

// ─── Helpers shared by both layers ──────────────────────────────────────────

/// Build a stub `Project` with just the field the upserter actually reads
/// (`id`). All other fields are zero-valued — the upserter never touches
/// them, so they don't need to be realistic.
fn fake_project() -> Project {
    Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "test-project".to_owned(),
        waba_id: None,
        business_id: None,
        app_id: None,
        access_token: None,
        phone_numbers: vec![],
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: Utc::now(),
    }
}

/// Build a synthetic `ChangeValue` for one inbound text message,
/// optionally with a sender profile name.
///
/// `wa_id` is the Meta-style digit-only phone (e.g. `"919876543210"`).
fn change_value_for(wa_id: &str, profile_name: Option<&str>) -> ChangeValue {
    let contacts_json: serde_json::Value = match profile_name {
        Some(n) => json!([{ "wa_id": wa_id, "profile": { "name": n } }]),
        None => json!([]),
    };
    serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        },
        "contacts": contacts_json,
        "messages": [{
            "from": wa_id,
            "id": "wamid.TEST_INBOUND",
            "timestamp": "1717000000",
            "type": "text",
            "text": { "body": "hello" },
        }],
    }))
    .expect("valid ChangeValue")
}

// ─── Pure DTO tests ─────────────────────────────────────────────────────────

#[test]
fn change_value_decodes_with_profile_and_message() {
    let cv = change_value_for("919876543210", Some("Alice"));
    let contacts = cv.contacts.as_ref().expect("contacts present");
    assert_eq!(contacts.len(), 1);
    assert_eq!(contacts[0].wa_id, "919876543210");
    assert_eq!(contacts[0].profile.name.as_deref(), Some("Alice"));

    let messages = cv.messages.as_ref().expect("messages present");
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].from, "919876543210");
}

#[test]
fn change_value_decodes_without_profile() {
    // Meta sometimes omits the contacts array on subsequent messages from
    // the same sender. The DTO must accept that without losing the
    // message-only payload.
    let cv = change_value_for("919876543210", None);
    let contacts = cv.contacts.as_ref().expect("contacts key present (empty)");
    assert!(contacts.is_empty());
    assert_eq!(cv.messages.as_ref().unwrap().len(), 1);
}

#[test]
fn missing_messages_array_means_nothing_to_upsert() {
    // Webhooks that only carry `statuses` (delivery receipts) decode
    // cleanly with `messages = None`. The upserter must early-return on
    // this shape.
    let cv: ChangeValue = serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        },
        "statuses": [],
    }))
    .unwrap();
    assert!(cv.messages.is_none());
    assert!(cv.contacts.is_none());
}

#[test]
fn webhook_contact_serializes_with_optional_name() {
    // Round-trip a profile that lacks the `name` key — Meta omits it
    // for users who haven't set a display name.
    let raw = json!({ "wa_id": "919876543210", "profile": {} });
    let wc: WebhookContact = serde_json::from_value(raw).unwrap();
    assert!(wc.profile.name.is_none());

    let with_empty_name: WebhookContact =
        serde_json::from_value(json!({ "wa_id": "x", "profile": { "name": "" } })).unwrap();
    // Empty string is `Some("")` here — the *upserter* is responsible for
    // treating that as equivalent to "no name". This test pins the DTO
    // behaviour so a future change to the JSON shape is surfaced.
    assert_eq!(with_empty_name.profile.name.as_deref(), Some(""));
}

#[test]
fn contact_profile_default_for_missing_field_via_helper() {
    // Build a `ContactProfile` manually — proves the public type is
    // constructible from another crate (it's `pub`).
    let p = ContactProfile { name: Some("Bob".to_owned()) };
    assert_eq!(p.name.as_deref(), Some("Bob"));
}

// ─── Mongo integration tests (gated) ────────────────────────────────────────

mod integration {
    use super::*;
    use sabnode_db::MongoHandle;
    use testcontainers::runners::AsyncRunner;
    use testcontainers_modules::mongo::Mongo;
    use wachat_webhook_contacts::ContactsUpserter;

    /// Returns true when the surrounding environment has explicitly opted
    /// out of container-backed integration testing — same convention as
    /// `sabnode-db::tests::integration`.
    fn should_skip() -> bool {
        std::env::var("SKIP_TESTCONTAINERS")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }

    /// Boot an ephemeral Mongo container and return a `MongoHandle` pointed
    /// at a fresh database for the calling test.
    async fn fresh_mongo(db_name: &str) -> Option<(MongoHandle, testcontainers::ContainerAsync<Mongo>)> {
        if should_skip() {
            eprintln!("SKIP_TESTCONTAINERS=1 — skipping {db_name}");
            return None;
        }
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
        let handle = MongoHandle::connect(&uri, db_name)
            .await
            .expect("connect to mongo");
        Some((handle, container))
    }

    /// Read the current contact doc for a given `(projectId, waId)` pair.
    /// Returns `None` if the doc doesn't exist.
    async fn read_contact(
        mongo: &MongoHandle,
        project_id: ObjectId,
        wa_id: &str,
    ) -> Option<Document> {
        mongo
            .collection::<Document>("contacts")
            .find_one(doc! { "projectId": project_id, "waId": wa_id })
            .await
            .expect("find_one driver call")
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn brand_new_contact_is_upserted() {
        let Some((mongo, _c)) = fresh_mongo("contacts_test_new").await else { return };
        let project = fake_project();
        let upserter = ContactsUpserter::new(mongo.clone());
        let cv = change_value_for("919876543210", Some("Alice"));

        let outcome = upserter
            .upsert_from_inbound(&project, &cv)
            .await
            .expect("upsert succeeds");

        assert_eq!(outcome.upserted, 1, "first sighting must upsert");
        assert_eq!(outcome.matched, 0);

        let doc = read_contact(&mongo, project.id, "919876543210")
            .await
            .expect("contact persisted");
        assert_eq!(doc.get_str("waId").unwrap(), "919876543210");
        assert_eq!(doc.get_str("name").unwrap(), "Alice");
        // Phone is the canonical E.164 form of the wa_id, not the raw digits.
        assert_eq!(doc.get_str("phone").unwrap(), "+919876543210");
        // lastMessageTimestamp must be a real BSON Date, not a string.
        let _: DateTime<Utc> = doc
            .get_datetime("lastMessageTimestamp")
            .expect("lastMessageTimestamp is a BSON Date")
            .to_chrono();
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn same_contact_again_is_matched() {
        let Some((mongo, _c)) = fresh_mongo("contacts_test_match").await else { return };
        let project = fake_project();
        let upserter = ContactsUpserter::new(mongo.clone());
        let cv = change_value_for("919876543210", Some("Alice"));

        let first = upserter.upsert_from_inbound(&project, &cv).await.unwrap();
        assert_eq!(first.upserted, 1);

        let second = upserter.upsert_from_inbound(&project, &cv).await.unwrap();
        assert_eq!(second.upserted, 0, "second sighting must not insert");
        assert_eq!(second.matched, 1, "second sighting must match the existing doc");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn profile_name_change_updates_name() {
        let Some((mongo, _c)) = fresh_mongo("contacts_test_rename").await else { return };
        let project = fake_project();
        let upserter = ContactsUpserter::new(mongo.clone());

        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", Some("Alice")))
            .await
            .unwrap();

        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", Some("Alice Smith")))
            .await
            .unwrap();

        let doc = read_contact(&mongo, project.id, "919876543210").await.unwrap();
        assert_eq!(
            doc.get_str("name").unwrap(),
            "Alice Smith",
            "name must reflect the latest non-empty profile name"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn missing_profile_does_not_clobber_existing_name() {
        let Some((mongo, _c)) = fresh_mongo("contacts_test_preserve").await else { return };
        let project = fake_project();
        let upserter = ContactsUpserter::new(mongo.clone());

        // First message carries a real profile name.
        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", Some("Alice")))
            .await
            .unwrap();

        // Second message has no profile (Meta dropped the contacts array).
        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", None))
            .await
            .unwrap();

        let doc = read_contact(&mongo, project.id, "919876543210").await.unwrap();
        assert_eq!(
            doc.get_str("name").unwrap(),
            "Alice",
            "missing profile must not clobber the previously-known name"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn empty_profile_name_does_not_clobber_existing_name() {
        // Meta has been observed to send `profile.name = ""` on edge events
        // — same intent as a missing profile, must not blank out the field.
        let Some((mongo, _c)) = fresh_mongo("contacts_test_empty_name").await else { return };
        let project = fake_project();
        let upserter = ContactsUpserter::new(mongo.clone());

        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", Some("Alice")))
            .await
            .unwrap();

        upserter
            .upsert_from_inbound(&project, &change_value_for("919876543210", Some("")))
            .await
            .unwrap();

        let doc = read_contact(&mongo, project.id, "919876543210").await.unwrap();
        assert_eq!(doc.get_str("name").unwrap(), "Alice");
    }
}
