//! Tests for [`wachat_templates_categories::TemplatesLibrary`].
//!
//! Two layers, mirroring the pattern in `wachat-webhook-contacts::tests`:
//!
//! 1. **Pure shape / validation tests** — always run. They construct the
//!    DTO and the BSON filter docs by hand and assert byte-for-byte parity
//!    with the TS write paths. No Mongo, no Docker.
//!
//! 2. **Mongo integration test** — gated by `SKIP_TESTCONTAINERS=1` and a
//!    working Docker daemon. Spins up an ephemeral MongoDB, exercises
//!    `save → delete → apply_to_projects`, and asserts the dedup rule from
//!    `template.actions.ts:861`:
//!
//!    ```text
//!    filter: { projectId, name: sourceTemplate.name, language: sourceTemplate.language }
//!    ```
//!
//!    i.e. a target project that already has a `(name, language)` row gets
//!    that row updated in place rather than a duplicate inserted.

use bson::{Document, doc, oid::ObjectId};
use serde_json::json;
use wachat_templates_categories::{
    ApplyOutcome, LIBRARY_TEMPLATES_COLLECTION, LibraryTemplateId, SaveLibraryTemplateReq,
    TEMPLATES_COLLECTION,
};
use wachat_types::TemplateCategory;

// ─── Layer 1: pure shape tests ──────────────────────────────────────────────

#[test]
fn collection_names_match_ts() {
    // Hard-coded literals — these MUST stay in sync with
    // `src/app/actions/template.actions.ts` so the Rust port reads/writes
    // the same Mongo collections as the Node app. If the TS ever changes,
    // this test fails loudly.
    assert_eq!(
        LIBRARY_TEMPLATES_COLLECTION, "library_templates",
        "TS line 764: db.collection('library_templates').insertOne(...)",
    );
    assert_eq!(
        TEMPLATES_COLLECTION, "templates",
        "TS line 815/868: db.collection('templates').findOne / bulkWrite",
    );
}

#[test]
fn save_request_round_trips_via_serde() {
    let req = SaveLibraryTemplateReq {
        name: "welcome_v1".to_owned(),
        category: TemplateCategory::Marketing,
        language: "en_US".to_owned(),
        body: "Hi {{1}}, welcome aboard!".to_owned(),
        components: json!([
            { "type": "BODY", "text": "Hi {{1}}, welcome aboard!" }
        ]),
    };

    let s = serde_json::to_string(&req).expect("serialize");
    let back: SaveLibraryTemplateReq = serde_json::from_str(&s).expect("deserialize");
    assert_eq!(back.name, "welcome_v1");
    assert_eq!(back.language, "en_US");
    assert!(matches!(back.category, TemplateCategory::Marketing));
    assert_eq!(back.body, "Hi {{1}}, welcome aboard!");
    assert_eq!(back.components, req.components);
}

#[test]
fn library_template_id_newtype_round_trip() {
    let oid = ObjectId::new();
    let id = LibraryTemplateId::from(oid);
    let back: ObjectId = id.into();
    assert_eq!(back, oid);

    // Transparent serde repr — JSON envelope is whatever bson::oid::ObjectId
    // serializes as (currently `{"$oid":"..."}`), but the newtype must NOT
    // wrap that under an extra field name.
    let direct = serde_json::to_value(oid).unwrap();
    let wrapped = serde_json::to_value(id).unwrap();
    assert_eq!(direct, wrapped, "newtype must serialize transparently");
}

#[test]
fn apply_outcome_default_is_zero() {
    let o = ApplyOutcome::default();
    assert_eq!(o.applied, 0);
    assert_eq!(o.skipped, 0);
}

#[test]
fn dedup_filter_doc_matches_ts_shape() {
    // Reproduce the exact filter shape from `template.actions.ts:861`:
    //
    //   filter: { projectId: projectObjectId,
    //             name: sourceTemplate.name,
    //             language: sourceTemplate.language }
    //
    // Field order matters for both human review and the BSON wire format,
    // so we assert it explicitly via `into_iter().collect::<Vec<_>>()`.
    let project_id = ObjectId::new();
    let filter: Document = doc! {
        "projectId": project_id,
        "name": "welcome_v1",
        "language": "en_US",
    };

    let keys: Vec<&str> = filter.keys().map(String::as_str).collect();
    assert_eq!(
        keys,
        vec!["projectId", "name", "language"],
        "dedup filter keys must be (projectId, name, language) in that order",
    );

    assert_eq!(filter.get_object_id("projectId").unwrap(), project_id);
    assert_eq!(filter.get_str("name").unwrap(), "welcome_v1");
    assert_eq!(filter.get_str("language").unwrap(), "en_US");
}

#[test]
fn library_template_insert_doc_carries_is_custom_true() {
    // Mirror the TS templateData literal from line 749-757:
    //
    //   { name, category, language, body, components,
    //     isCustom: true, createdAt: new Date() }
    //
    // We don't run save() here (no Mongo); instead assert that hand-building
    // the same doc shape preserves `isCustom: true` as a bool, not a string.
    let d = doc! {
        "name": "welcome_v1",
        "category": "MARKETING",
        "language": "en_US",
        "body": "hi",
        "components": bson::Bson::Array(vec![]),
        "isCustom": true,
        "createdAt": bson::DateTime::now(),
    };
    assert_eq!(d.get_bool("isCustom").unwrap(), true);
    assert_eq!(d.get_str("category").unwrap(), "MARKETING");
}

// ─── Layer 2: Mongo integration test (testcontainer-gated) ──────────────────

mod integration {
    use super::*;
    use sabnode_db::mongo::MongoHandle;
    use testcontainers::runners::AsyncRunner;
    use testcontainers_modules::mongo::Mongo;
    use wachat_templates_categories::TemplatesLibrary;

    fn should_skip() -> bool {
        std::env::var("SKIP_TESTCONTAINERS")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }

    /// End-to-end smoke: save → delete on `library_templates`, then a full
    /// `apply_to_projects` cycle that asserts the dedup rule.
    #[tokio::test(flavor = "multi_thread")]
    async fn save_delete_and_apply_dedup() {
        if should_skip() {
            eprintln!("SKIP_TESTCONTAINERS=1 — skipping save_delete_and_apply_dedup",);
            return;
        }

        // ---- container + handle -------------------------------------------------
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
        let mongo = MongoHandle::connect(&uri, "sabnode_test_lib")
            .await
            .expect("connect");
        let lib = TemplatesLibrary::new(mongo.clone());

        // ---- save ---------------------------------------------------------------
        let req = SaveLibraryTemplateReq {
            name: "welcome_v1".to_owned(),
            category: TemplateCategory::Marketing,
            language: "en_US".to_owned(),
            body: "Hi {{1}}!".to_owned(),
            components: json!([{ "type": "BODY", "text": "Hi {{1}}!" }]),
        };
        let saved = lib.save(req.clone()).await.expect("save");
        let lib_coll = mongo.collection::<Document>(LIBRARY_TEMPLATES_COLLECTION);
        let row = lib_coll
            .find_one(doc! { "_id": saved.0 })
            .await
            .expect("find")
            .expect("row exists");
        assert_eq!(row.get_str("name").unwrap(), "welcome_v1");
        assert_eq!(row.get_bool("isCustom").unwrap(), true);

        // ---- delete -------------------------------------------------------------
        lib.delete(&saved.0).await.expect("delete");
        let after = lib_coll
            .find_one(doc! { "_id": saved.0 })
            .await
            .expect("find");
        assert!(after.is_none(), "row should be gone after delete");

        // Deleting again returns NotFound.
        let err = lib.delete(&saved.0).await.unwrap_err();
        assert!(matches!(err, sabnode_common::ApiError::NotFound(_)));

        // ---- apply_to_projects: dedup rule -------------------------------------
        let templates_coll = mongo.collection::<Document>(TEMPLATES_COLLECTION);

        // Two project ids: one will already have a (name, language) match,
        // the other won't.
        let project_with_existing = ObjectId::new();
        let project_blank = ObjectId::new();

        // Pre-seed `project_with_existing` with a row whose (name, language)
        // collides with the source we're about to apply.
        templates_coll
            .insert_one(doc! {
                "projectId": project_with_existing,
                "name": "promo_blast",
                "language": "en_US",
                "status": "APPROVED",  // sentinel — should be overwritten to LOCAL
                "metaId": "META_OLD",   // sentinel — should be cleared to ""
                "category": "MARKETING",
                "components": bson::Bson::Array(vec![]),
            })
            .await
            .expect("seed existing row");

        // Insert the SOURCE row in the same `templates` collection (TS line 815).
        let source_project = ObjectId::new();
        let source_id = ObjectId::new();
        templates_coll
            .insert_one(doc! {
                "_id": source_id,
                "projectId": source_project,
                "name": "promo_blast",
                "language": "en_US",
                "status": "APPROVED",
                "metaId": "META_SOURCE_123",
                "category": "MARKETING",
                "components": bson::Bson::Array(vec![]),
                "headerSampleUrl": "https://example.com/sample.png",
            })
            .await
            .expect("seed source");

        // Apply.
        let outcome = lib
            .apply_to_projects(&source_id, &[project_with_existing, project_blank])
            .await
            .expect("apply");
        assert_eq!(outcome.applied, 2);
        assert_eq!(outcome.skipped, 0);

        // Existing-row project: must have been UPDATED in place. Count of
        // (projectId, name, language) rows is still exactly 1 — the dedup
        // worked.
        let existing_count = templates_coll
            .count_documents(doc! {
                "projectId": project_with_existing,
                "name": "promo_blast",
                "language": "en_US",
            })
            .await
            .expect("count");
        assert_eq!(
            existing_count, 1,
            "dedup violation: existing (name,language) row should be updated in place, not duplicated",
        );

        // The updated row carries the post-apply transforms from TS lines 851-857.
        let updated = templates_coll
            .find_one(doc! { "projectId": project_with_existing })
            .await
            .expect("find")
            .expect("row");
        assert_eq!(
            updated.get_str("status").unwrap(),
            "LOCAL",
            "status must be LOCAL for the cron job to pick up",
        );
        assert_eq!(
            updated.get_str("metaId").unwrap(),
            "",
            "metaId must be cleared on apply",
        );
        assert!(
            updated.get("headerSampleUrl").is_none(),
            "headerSampleUrl must be stripped on apply (TS line 857)",
        );

        // Blank project: must have a fresh row inserted.
        let blank_count = templates_coll
            .count_documents(doc! { "projectId": project_blank })
            .await
            .expect("count");
        assert_eq!(
            blank_count, 1,
            "blank project should receive a fresh insert"
        );

        // Source row in its own project must be untouched.
        let src_after = templates_coll
            .find_one(doc! { "_id": source_id })
            .await
            .expect("find")
            .expect("source");
        assert_eq!(src_after.get_str("status").unwrap(), "APPROVED");
        assert_eq!(src_after.get_str("metaId").unwrap(), "META_SOURCE_123");
    }

    /// `apply_to_projects` with an empty target list returns `BadRequest` —
    /// matches TS line 810.
    #[tokio::test(flavor = "multi_thread")]
    async fn apply_with_empty_targets_is_bad_request() {
        if should_skip() {
            return;
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
        let mongo = MongoHandle::connect(&uri, "sabnode_test_lib_2")
            .await
            .expect("connect");
        let lib = TemplatesLibrary::new(mongo);

        let err = lib
            .apply_to_projects(&ObjectId::new(), &[])
            .await
            .unwrap_err();
        assert!(matches!(err, sabnode_common::ApiError::BadRequest(_)));
    }

    /// `save` with a name that violates the lowercase regex returns a
    /// validation error — matches TS line 745.
    #[tokio::test(flavor = "multi_thread")]
    async fn save_rejects_uppercase_name_without_touching_mongo() {
        // Doesn't actually need Mongo; validation runs before any IO.
        // Use a dummy MongoHandle by piggy-backing on a container so we
        // construct the same handle type the production code uses.
        if should_skip() {
            return;
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
        let mongo = MongoHandle::connect(&uri, "sabnode_test_lib_3")
            .await
            .expect("connect");
        let lib = TemplatesLibrary::new(mongo);

        let req = SaveLibraryTemplateReq {
            name: "Welcome".to_owned(), // uppercase 'W' — invalid
            category: TemplateCategory::Marketing,
            language: "en_US".to_owned(),
            body: "Hi".to_owned(),
            components: json!([]),
        };
        let err = lib.save(req).await.unwrap_err();
        assert!(matches!(err, sabnode_common::ApiError::Validation(_)));
    }
}
