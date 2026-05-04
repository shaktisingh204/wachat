//! Table-driven tests for `wachat-webhook-account`.
//!
//! These tests assert the **exact filter / update / array-filter shape** the
//! processor would send to Mongo for each account-webhook field. They do not
//! talk to a real Mongo instance — that's the integration-test job for the
//! parent `wachat-webhook` crate. Here we only need to lock the wire shape
//! so a refactor can't silently break the audit trail or the project-doc
//! mutations.
//!
//! `serde_json::Value` fixtures stand in for `ChangeValue` per the slice
//! contract (the typed `ChangeValue` only models the `messages` field; the
//! account fields all carry their own keys).

use bson::{Document, doc, oid::ObjectId};
use serde_json::{Value, json};
use wachat_webhook_account::build_project_update;

/// One row of the table-driven test.
struct Case {
    name: &'static str,
    field: &'static str,
    value: Value,
    /// Asserts the produced update matches expectations. Returns whether the
    /// processor produced an update at all.
    expect: fn(Option<(Document, Document, Option<Vec<Document>>)>),
}

#[test]
fn account_field_updates_match_expected_shape() {
    let pid = ObjectId::new();

    let cases = vec![
        Case {
            name: "account_alerts pushes onto accountAlerts capped to last 100",
            field: "account_alerts",
            value: json!({"alert_type": "QUALITY_DROP", "event": "WARN"}),
            expect: |out| {
                let (filter, update, af) = out.expect("account_alerts must produce an update");
                assert!(af.is_none(), "account_alerts uses no array filters");
                assert!(filter.contains_key("_id"), "filter must key on _id");

                // $push: { accountAlerts: { $each: [...], $slice: -100 } }
                let push = update.get_document("$push").expect("$push present");
                let alerts = push
                    .get_document("accountAlerts")
                    .expect("accountAlerts under $push");
                let each = alerts.get_array("$each").expect("$each is an array");
                assert_eq!(each.len(), 1, "exactly one alert in $each");
                let slice = alerts.get_i32("$slice").expect("$slice is i32");
                assert_eq!(slice, -100, "history capped to last 100");
            },
        },
        Case {
            name: "account_update sets accountStatus + appends to quality_history",
            field: "account_update",
            value: json!({"event": "DISABLED_UPDATE", "ban_info": {"waba_ban_state": "DISABLED"}}),
            expect: |out| {
                let (filter, update, af) = out.expect("account_update must produce an update");
                assert!(af.is_none());
                assert!(filter.contains_key("_id"));

                let set = update.get_document("$set").expect("$set present");
                assert_eq!(set.get_str("accountStatus").unwrap(), "DISABLED_UPDATE");
                assert_eq!(set.get_str("banState").unwrap(), "DISABLED");
                assert!(set.contains_key("accountStatusUpdatedAt"));

                let push = update.get_document("$push").expect("$push present");
                let qh = push
                    .get_document("quality_history")
                    .expect("quality_history under $push");
                assert_eq!(qh.get_i32("$slice").unwrap(), -100);
                assert_eq!(qh.get_array("$each").unwrap().len(), 1);
            },
        },
        Case {
            name: "account_review_update writes reviewStatus",
            field: "account_review_update",
            value: json!({"review_status": "APPROVED"}),
            expect: |out| {
                let (_, update, _) = out.expect("account_review_update must produce an update");
                let set = update.get_document("$set").expect("$set present");
                assert_eq!(set.get_str("reviewStatus").unwrap(), "APPROVED");

                // History row carries the reviewStatus too — that's the
                // contract for replay/audit.
                let push = update.get_document("$push").expect("$push present");
                let qh = push.get_document("quality_history").unwrap();
                let entry = qh.get_array("$each").unwrap()[0].as_document().unwrap();
                assert_eq!(entry.get_str("reviewStatus").unwrap(), "APPROVED");
            },
        },
        Case {
            name: "business_capability_update writes businessCapabilities",
            field: "business_capability_update",
            value: json!({"business_capabilities": {"max_daily_conversation_per_phone": 10000}}),
            expect: |out| {
                let (_, update, af) =
                    out.expect("business_capability_update must produce an update");
                assert!(af.is_none());
                let set = update.get_document("$set").expect("$set present");
                assert!(set.contains_key("businessCapabilities"));
                assert!(set.contains_key("businessCapabilitiesUpdatedAt"));
            },
        },
        Case {
            name: "phone_number_quality_update sets qualityRating with positional array filter",
            field: "phone_number_quality_update",
            value: json!({"phone_number_id": "1234567890", "quality_rating": "GREEN"}),
            expect: |out| {
                let (filter, update, af) =
                    out.expect("phone_number_quality_update must produce an update");
                assert!(filter.contains_key("_id"));

                let set = update.get_document("$set").expect("$set present");
                assert_eq!(
                    set.get_str("phoneNumbers.$[pn].qualityRating").unwrap(),
                    "GREEN"
                );

                let af = af.expect("array filters required for positional update");
                assert_eq!(af.len(), 1);
                assert_eq!(af[0].get_str("pn.id").unwrap(), "1234567890");
            },
        },
        Case {
            name: "phone_number_quality_update accepts legacy `event` key for quality",
            field: "phone_number_quality_update",
            value: json!({"phone_number_id": "999", "event": "RED"}),
            expect: |out| {
                let (_, update, _) = out.expect("legacy `event` quality must still produce an update");
                let set = update.get_document("$set").unwrap();
                assert_eq!(set.get_str("phoneNumbers.$[pn].qualityRating").unwrap(), "RED");
            },
        },
        Case {
            name: "phone_number_quality_update without phone_number_id is skipped",
            field: "phone_number_quality_update",
            value: json!({"quality_rating": "GREEN"}),
            expect: |out| assert!(out.is_none(), "missing phone_number_id => no update"),
        },
        Case {
            name: "phone_number_name_update sets verifiedName + nameStatus",
            field: "phone_number_name_update",
            value: json!({
                "phone_number_id": "555",
                "verified_name": "Acme Corp",
                "decision": "APPROVED"
            }),
            expect: |out| {
                let (_, update, af) = out.expect("phone_number_name_update must produce an update");
                let set = update.get_document("$set").expect("$set present");
                assert_eq!(
                    set.get_str("phoneNumbers.$[pn].verifiedName").unwrap(),
                    "Acme Corp"
                );
                assert_eq!(
                    set.get_str("phoneNumbers.$[pn].nameStatus").unwrap(),
                    "APPROVED"
                );

                let af = af.expect("array filters required");
                assert_eq!(af[0].get_str("pn.id").unwrap(), "555");
            },
        },
        Case {
            name: "phone_number_name_update with neither name nor decision is skipped",
            field: "phone_number_name_update",
            value: json!({"phone_number_id": "555"}),
            expect: |out| assert!(out.is_none(), "no name or decision => no update"),
        },
        Case {
            name: "security is audit-only, no project update",
            field: "security",
            value: json!({"display_phone_number": "+1 555-555-5555", "event": "PIN_RESET"}),
            expect: |out| assert!(out.is_none(), "security never mutates the project doc"),
        },
        Case {
            name: "unknown field is audit-only, no project update",
            field: "totally_made_up_field_v9",
            value: json!({"foo": "bar"}),
            expect: |out| assert!(out.is_none(), "unknown fields produce no project update"),
        },
    ];

    for case in cases {
        let out = build_project_update(pid, case.field, &case.value);
        // Run the case-specific assertions; panic carries the case name so
        // failures are obvious.
        std::panic::catch_unwind(|| (case.expect)(out))
            .unwrap_or_else(|_| panic!("table case failed: {}", case.name));
    }
}

#[test]
fn account_alerts_carries_alert_payload_into_history() {
    let pid = ObjectId::new();
    let value = json!({"alert_type": "QUALITY_DROP", "event": "RED"});

    let (_, update, _) = build_project_update(pid, "account_alerts", &value)
        .expect("account_alerts produces an update");

    let push = update.get_document("$push").unwrap();
    let alerts = push.get_document("accountAlerts").unwrap();
    let each = alerts.get_array("$each").unwrap();
    let entry = each[0].as_document().unwrap();

    assert_eq!(entry.get_str("alertType").unwrap(), "QUALITY_DROP");
    assert_eq!(entry.get_str("event").unwrap(), "RED");
    assert!(entry.contains_key("receivedAt"));
    assert!(entry.contains_key("raw"));
}

#[test]
fn account_update_only_sets_keys_that_are_present() {
    let pid = ObjectId::new();
    // Only `event` is present — `banState`, `violationType`, etc. must not
    // be inserted (we'd otherwise clobber them).
    let value = json!({"event": "ACCOUNT_RESTRICTION"});

    let (_, update, _) = build_project_update(pid, "account_update", &value)
        .expect("account_update produces an update");

    let set = update.get_document("$set").unwrap();
    assert_eq!(set.get_str("accountStatus").unwrap(), "ACCOUNT_RESTRICTION");
    assert!(!set.contains_key("banState"), "must not set banState when absent");
    assert!(!set.contains_key("reviewStatus"), "must not set reviewStatus when absent");
    assert!(
        !set.contains_key("violationType"),
        "must not set violationType when absent"
    );
}

#[test]
fn business_capability_update_falls_back_when_key_missing() {
    let pid = ObjectId::new();
    // Payload does not have `business_capabilities` or `capabilities` —
    // we should still write something so we don't drop the event.
    let value = json!({"foo": "bar"});

    let (_, update, _) = build_project_update(pid, "business_capability_update", &value)
        .expect("falls back to writing the whole value");

    let set = update.get_document("$set").unwrap();
    assert!(set.contains_key("businessCapabilities"));
}

/// Filter docs are stable: every project-targeting filter keys on `_id` and
/// nothing else. This is load-bearing for the `update_one` + `upsert: false`
/// guarantee — a wrong filter could silently match the wrong project.
#[test]
fn all_filters_target_id_only() {
    let pid = ObjectId::new();

    let fixtures: &[(&str, Value)] = &[
        ("account_alerts", json!({"alert_type": "X"})),
        ("account_update", json!({"event": "X"})),
        ("account_review_update", json!({"review_status": "APPROVED"})),
        (
            "business_capability_update",
            json!({"business_capabilities": {"x": 1}}),
        ),
        (
            "phone_number_quality_update",
            json!({"phone_number_id": "1", "quality_rating": "GREEN"}),
        ),
        (
            "phone_number_name_update",
            json!({"phone_number_id": "1", "verified_name": "X", "decision": "APPROVED"}),
        ),
    ];

    for (field, value) in fixtures {
        let (filter, _, _) = build_project_update(pid, field, value)
            .unwrap_or_else(|| panic!("{field} should produce an update"));
        assert_eq!(filter.len(), 1, "filter for {field} must have a single key");
        assert!(
            filter.contains_key("_id"),
            "filter for {field} must key on _id only"
        );
        let got = filter.get_object_id("_id").expect("_id is ObjectId");
        assert_eq!(got, pid);
    }

    // Sanity: the ObjectId roundtrips through bson untouched.
    let _ = doc! { "_id": pid };
}
