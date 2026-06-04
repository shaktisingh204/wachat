//! HTTP handlers for the SabCRM settings domain.
//!
//! Read / merge-upsert over the `sabcrm_settings` Mongo collection — one
//! free-form key/value document per project.
//!
//! | Endpoint                          | Purpose                          |
//! |-----------------------------------|----------------------------------|
//! | `GET /v1/sabcrm/settings`         | read the project's `data` (or {}) |
//! | `PUT /v1/sabcrm/settings`         | `$set` each `data.<k>`, upsert     |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The `projectId` is
//! unique on the collection, so there is at most one document per project.
//! The [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};
use tracing::instrument;

use crate::dto::{
    AppearanceSettings, GeneralSettings, GetQuery, LabSettings, LocalizationSettings,
    NotificationSettings, SecuritySettings, SectionQuery, SettingsResponse, UpdateQuery,
    UpdateSettingsInput,
};

/// The Mongo collection backing per-project settings.
const SETTINGS_COLL: &str = "sabcrm_settings";

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Pull the `data` sub-document out of a stored settings document and clean it
/// into a JSON map. Missing/non-object `data` yields an empty map.
fn data_to_wire(doc: Option<Document>) -> Map<String, Value> {
    let Some(mut doc) = doc else {
        return Map::new();
    };
    let data = doc.remove("data");
    match data {
        Some(Bson::Document(inner)) => match document_to_clean_json(inner) {
            Value::Object(map) => map,
            _ => Map::new(),
        },
        _ => Map::new(),
    }
}

// ===========================================================================
// GET / — read settings
// ===========================================================================

/// `GET /v1/sabcrm/settings` — return the project's settings `data`, or `{}`
/// when the project has no settings document yet.
#[instrument(skip_all)]
pub async fn get_settings(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<GetQuery>,
) -> Result<Json<SettingsResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_settings.find_one"))
        })?;

    Ok(Json(SettingsResponse {
        data: data_to_wire(found),
    }))
}

// ===========================================================================
// PUT / — merge-upsert settings
// ===========================================================================

/// `PUT /v1/sabcrm/settings` — merge the supplied `data` patch into the
/// project's settings document (`$set` each `data.<k>`), bumping `updatedAt`.
/// The document is created on first write (`$setOnInsert` of `_id` +
/// `projectId`). Returns the full merged `data` map.
#[instrument(skip_all)]
pub async fn update_settings(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<UpdateQuery>,
    Json(body): Json<UpdateSettingsInput>,
) -> Result<Json<SettingsResponse>> {
    // Prefer the body projectId; fall back to the query for parity with the
    // favorites surface. Both must be present and agree when both are set.
    let project_id = require_project(&body.project_id)?;
    let query_project = query.project_id.trim();
    if !query_project.is_empty() && query_project != project_id {
        return Err(ApiError::Validation(
            "projectId in query and body must match.".to_owned(),
        ));
    }

    // Build the `$set` patch: `updatedAt`, plus one `data.<k>` per supplied key.
    let mut set = doc! { "updatedAt": Utc::now().to_rfc3339() };
    for (k, v) in body.data.into_iter() {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_settings.to_bson"))
        })?;
        set.insert(format!("data.{k}"), bson);
    }

    let update = doc! {
        "$set": set,
        "$setOnInsert": {
            "_id": ObjectId::new(),
            "projectId": project_id,
        },
    };

    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let merged = coll
        .find_one_and_update(doc! { "projectId": project_id }, update)
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_settings.find_one_and_update(upsert)"),
            )
        })?;

    Ok(Json(SettingsResponse {
        data: data_to_wire(merged),
    }))
}

// ===========================================================================
// Typed per-domain sections (`data.<section>`)
// ===========================================================================
//
// Each typed section is one named slice of the SAME per-project settings
// document. `read_section` pulls `data.<section>` out; `merge_section` `$set`s
// `data.<section>.<k>` for each supplied key (PATCH semantics, upsert). The
// typed handlers below validate the body, persist, and echo the stored slice
// back — so a section endpoint is a strongly-typed, validated view over the
// same storage the free-form blob uses.

/// Serialize a typed section into a JSON map (dropping `None` fields, which
/// serde already skips via `skip_serializing_if`). Non-object shapes are
/// impossible for our structs but degrade to an empty map rather than panic.
fn section_to_map<T: Serialize>(value: &T) -> Result<Map<String, Value>> {
    let json = serde_json::to_value(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_settings.section_to_map"))
    })?;
    match json {
        Value::Object(map) => Ok(map),
        _ => Ok(Map::new()),
    }
}

/// Parse a stored section map back into its typed struct, falling back to the
/// type's `Default` when the slice is absent / malformed.
fn map_to_section<T: DeserializeOwned + Default>(map: Map<String, Value>) -> T {
    serde_json::from_value(Value::Object(map)).unwrap_or_default()
}

/// Read `data.<section>` for a project as a JSON map (`{}` when absent).
async fn read_section(
    mongo: &MongoHandle,
    project_id: &str,
    section: &str,
) -> Result<Map<String, Value>> {
    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_settings.read_section.find_one"),
            )
        })?;
    let mut data = data_to_wire(found);
    match data.remove(section) {
        Some(Value::Object(inner)) => Ok(inner),
        _ => Ok(Map::new()),
    }
}

/// Merge a validated patch into `data.<section>` (upsert), returning the
/// stored slice afterwards. Only the supplied keys are `$set`.
async fn merge_section(
    mongo: &MongoHandle,
    project_id: &str,
    section: &str,
    patch: Map<String, Value>,
) -> Result<Map<String, Value>> {
    let mut set = doc! { "updatedAt": Utc::now().to_rfc3339() };
    for (k, v) in patch.into_iter() {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_settings.merge_section.to_bson"),
            )
        })?;
        set.insert(format!("data.{section}.{k}"), bson);
    }

    let update = doc! {
        "$set": set,
        "$setOnInsert": {
            "_id": ObjectId::new(),
            "projectId": project_id,
        },
    };

    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let merged = coll
        .find_one_and_update(doc! { "projectId": project_id }, update)
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e)
                    .context("sabcrm_settings.merge_section.find_one_and_update(upsert)"),
            )
        })?;

    let mut data = data_to_wire(merged);
    match data.remove(section) {
        Some(Value::Object(inner)) => Ok(inner),
        _ => Ok(Map::new()),
    }
}

/// Macro: emit a typed `GET`/`PUT` handler pair for one section. Keeps the six
/// sections from being six copies of the same six lines.
macro_rules! section_handlers {
    ($section:literal, $ty:ty, $get_fn:ident, $put_fn:ident) => {
        #[doc = concat!("`GET /v1/sabcrm/settings/", $section, "` — read the typed section.")]
        #[instrument(skip_all)]
        pub async fn $get_fn(
            _user: AuthUser,
            State(mongo): State<MongoHandle>,
            Query(query): Query<SectionQuery>,
        ) -> Result<Json<$ty>> {
            let project_id = require_project(&query.project_id)?;
            let map = read_section(&mongo, project_id, $section).await?;
            Ok(Json(map_to_section::<$ty>(map)))
        }

        #[doc = concat!("`PUT /v1/sabcrm/settings/", $section, "` — validate + merge the typed section.")]
        #[instrument(skip_all)]
        pub async fn $put_fn(
            _user: AuthUser,
            State(mongo): State<MongoHandle>,
            Query(query): Query<SectionQuery>,
            Json(body): Json<$ty>,
        ) -> Result<Json<$ty>> {
            let project_id = require_project(&query.project_id)?;
            body.validate().map_err(ApiError::Validation)?;
            let patch = section_to_map(&body)?;
            let merged = merge_section(&mongo, project_id, $section, patch).await?;
            Ok(Json(map_to_section::<$ty>(merged)))
        }
    };
}

section_handlers!("general", GeneralSettings, get_general, put_general);
section_handlers!("appearance", AppearanceSettings, get_appearance, put_appearance);
section_handlers!(
    "notifications",
    NotificationSettings,
    get_notifications,
    put_notifications
);
section_handlers!(
    "localization",
    LocalizationSettings,
    get_localization,
    put_localization
);
section_handlers!("lab", LabSettings, get_lab, put_lab);
section_handlers!("security", SecuritySettings, get_security, put_security);
