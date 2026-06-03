//! HTTP handlers for the SabCRM object-metadata domain.
//!
//! CRUD over the `sabcrm_objects` Mongo collection, merged on top of the
//! six built-in standard objects from [`sabcrm_core`].
//!
//! | Endpoint                              | TS source (`objects.server.ts`)  |
//! |---------------------------------------|----------------------------------|
//! | `GET    /v1/sabcrm/objects`           | `listObjects`                    |
//! | `POST   /v1/sabcrm/objects`           | `createObject`                   |
//! | `GET    /v1/sabcrm/objects/{slug}`    | `getObject`                      |
//! | `PATCH  /v1/sabcrm/objects/{slug}`    | `updateObject`                   |
//! | `DELETE /v1/sabcrm/objects/{slug}`    | `deleteObject`                   |
//!
//! ## Merge semantics
//!
//! The persisted `sabcrm_objects` collection only holds fully-custom
//! objects and per-project customizations of standard objects (docs with
//! `extendsStandard: true`). The list / get endpoints start from
//! [`sabcrm_core::standard_objects`] and:
//!
//! - append any custom (non-standard-slug) docs; and
//! - for a standard slug with a persisted `extendsStandard` doc, append
//!   that doc's extra `fields` (keys not already present on the standard
//!   object) to the standard definition.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. Every handler
//! requires the [`AuthUser`](sabnode_auth::AuthUser) extractor so the
//! surface is never anonymously open, but the caller's user id is not part
//! of the filter.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use sabcrm_core::{ObjectMetadata, standard_object, standard_object_slugs, standard_objects};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    CreateObjectInput, ListResponse, ObjectResponse, OkResponse, ScopeQuery, UpdateObjectInput,
};

/// The Mongo collection backing persisted custom / override objects.
const OBJECTS_COLL: &str = "sabcrm_objects";

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

/// True when `slug` is one of the six built-in standard objects.
fn is_standard_slug(slug: &str) -> bool {
    standard_object_slugs().contains(&slug)
}

/// Deserialize a stored `sabcrm_objects` document into an
/// [`ObjectMetadata`], dropping the bookkeeping keys (`_id`, `projectId`,
/// `extendsStandard`, `createdAt`, `updatedAt`) that are not part of the
/// metadata contract.
fn doc_to_object(mut doc: Document) -> Result<ObjectMetadata> {
    doc.remove("_id");
    doc.remove("projectId");
    doc.remove("extendsStandard");
    doc.remove("createdAt");
    doc.remove("updatedAt");
    bson::from_document::<ObjectMetadata>(doc).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.from_document"))
    })
}

/// Convert an [`ObjectMetadata`] into a BSON document for persistence.
fn object_to_doc(object: &ObjectMetadata) -> Result<Document> {
    match bson::to_bson(object).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.to_bson"))
    })? {
        Bson::Document(d) => Ok(d),
        _ => Err(ApiError::Validation("`object` must be an object.".to_owned())),
    }
}

/// Append any fields from `extra` whose `key` is not already present on
/// `base` (used when a standard object is extended with custom fields).
fn merge_extra_fields(base: &mut ObjectMetadata, extra: &ObjectMetadata) {
    for f in &extra.fields {
        if !base.fields.iter().any(|b| b.key == f.key) {
            base.fields.push(f.clone());
        }
    }
}

/// Build the merged object list for a project: standard objects (with any
/// `extendsStandard` customizations applied), then appended custom objects.
async fn merged_objects(mongo: &MongoHandle, project_id: &str) -> Result<Vec<ObjectMetadata>> {
    let coll = mongo.collection::<Document>(OBJECTS_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.find")))?;

    let mut custom: Vec<ObjectMetadata> = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.cursor"))
    })? {
        custom.push(doc_to_object(d)?);
    }

    // Start from the standard objects, overlaying any extension fields.
    let mut result: Vec<ObjectMetadata> = standard_objects();
    for obj in &mut result {
        if let Some(ext) = custom.iter().find(|c| c.slug == obj.slug) {
            merge_extra_fields(obj, ext);
        }
    }

    // Append fully-custom objects (slugs that are not standard).
    for c in custom.into_iter() {
        if !is_standard_slug(&c.slug) {
            result.push(c);
        }
    }

    Ok(result)
}

// ===========================================================================
// GET / — listObjects
// ===========================================================================

/// `GET /v1/sabcrm/objects` — merged standard + custom object list for the
/// project.
#[instrument(skip_all)]
pub async fn list_objects(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let objects = merged_objects(&mongo, project_id).await?;
    Ok(Json(ListResponse { objects }))
}

// ===========================================================================
// GET /{slug} — getObject
// ===========================================================================

/// `GET /v1/sabcrm/objects/{slug}` — one merged object (404 if neither
/// standard nor custom).
#[instrument(skip_all, fields(slug = %slug))]
pub async fn get_object(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<ObjectResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(OBJECTS_COLL);
    let persisted = coll
        .find_one(doc! { "projectId": project_id, "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.find_one"))
        })?;

    let object = match (standard_object(&slug), persisted) {
        // Standard slug, optionally extended by a persisted doc.
        (Some(mut base), Some(ext_doc)) => {
            let ext = doc_to_object(ext_doc)?;
            merge_extra_fields(&mut base, &ext);
            base
        }
        (Some(base), None) => base,
        // Custom object only.
        (None, Some(custom_doc)) => doc_to_object(custom_doc)?,
        (None, None) => return Err(ApiError::NotFound("object".to_owned())),
    };

    Ok(Json(ObjectResponse { object }))
}

// ===========================================================================
// POST / — createObject
// ===========================================================================

/// `POST /v1/sabcrm/objects` — insert a custom object. `createdAt` /
/// `updatedAt` are set server-side (RFC3339). Returns 409 on duplicate
/// slug for the project.
#[instrument(skip_all)]
pub async fn create_object(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateObjectInput>,
) -> Result<Json<ObjectResponse>> {
    let project_id = require_project(&body.project_id)?;
    let slug = body.object.slug.trim().to_owned();
    if slug.is_empty() {
        return Err(ApiError::Validation("object.slug is required.".to_owned()));
    }

    let coll = mongo.collection::<Document>(OBJECTS_COLL);

    // Reject duplicate slug for the project.
    let existing = coll
        .count_documents(doc! { "projectId": project_id, "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.count"))
        })?;
    if existing > 0 {
        return Err(ApiError::Conflict(format!(
            "an object with slug `{slug}` already exists."
        )));
    }

    let now = Utc::now().to_rfc3339();
    let mut new_doc = object_to_doc(&body.object)?;
    new_doc.insert("projectId", project_id);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.insert_one"))
    })?;

    Ok(Json(ObjectResponse {
        object: body.object,
    }))
}

// ===========================================================================
// PATCH /{slug} — updateObject
// ===========================================================================

/// `PATCH /v1/sabcrm/objects/{slug}` — update a custom object (e.g. add or
/// update `fields`). Each key in `patch` is `$set` verbatim; `updatedAt`
/// is always bumped. 404 if no persisted doc matches.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn update_object(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Json(body): Json<UpdateObjectInput>,
) -> Result<Json<ObjectResponse>> {
    let project_id = require_project(&body.project_id)?;

    let patch = match bson::to_bson(&body.patch).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.patch.to_bson"))
    })? {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("`patch` must be an object.".to_owned())),
    };

    let mut set = Document::new();
    for (k, v) in patch {
        // Guard against rewriting tenancy / identity keys.
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        set.insert(k, v);
    }
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(OBJECTS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "slug": &slug },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("object".to_owned()))?;

    Ok(Json(ObjectResponse {
        object: doc_to_object(updated)?,
    }))
}

// ===========================================================================
// DELETE /{slug} — deleteObject
// ===========================================================================

/// `DELETE /v1/sabcrm/objects/{slug}` — delete a custom object. Refuses to
/// delete a standard slug (400). 404 if no persisted custom doc matches.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn delete_object(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;

    if is_standard_slug(&slug) {
        return Err(ApiError::BadRequest(
            "cannot delete a standard object.".to_owned(),
        ));
    }

    let coll = mongo.collection::<Document>(OBJECTS_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "slug": &slug })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("object".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
