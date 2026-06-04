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
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabcrm_core::{standard_object, standard_object_slugs, standard_objects};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::{instrument, warn};

use crate::dto::{
    CreateObjectInput, IndexMetadata, IndexType, ListResponse, ObjectMetadata, ObjectResponse,
    OkResponse, ScopeQuery, SetIndexesInput, SyncMembersInput, SyncMembersResponse,
    UpdateObjectInput,
};

/// The Mongo collection backing persisted custom / override objects.
const OBJECTS_COLL: &str = "sabcrm_objects";

/// The Mongo collection backing CRM records (`{ projectId, object, data }`),
/// targeted best-effort by the ensure-indexes path.
const RECORDS_COLL: &str = "sabcrm_records";

/// The SabNode `projects` collection — the source of truth for a project's
/// team roster (`userId` owner + `agents[]`). Read-only here.
const PROJECTS_COLL: &str = "projects";

/// The SabNode `users` collection — profile fields (`name`, `email`, `image`)
/// joined onto the roster. Read-only here.
const USERS_COLL: &str = "users";

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
    let mut result: Vec<ObjectMetadata> = standard_objects()
        .into_iter()
        .map(ObjectMetadata::from_core)
        .collect();
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

    let object = match (standard_object(&slug).map(ObjectMetadata::from_core), persisted) {
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
// PUT /{slug}/indexes — setObjectIndexes
// ===========================================================================

/// Best-effort: create real Mongo indexes on `sabcrm_records` for one
/// object's index definitions. Records are stored as
/// `{ projectId, object, data: { <fieldKey>: value } }`, so an index over
/// field keys `[a, b]` becomes a compound index over `data.a`, `data.b`
/// (always prefixed by `projectId` + `object` so it is tenant/object
/// scoped). `GIN`-typed defs are skipped here (no Mongo equivalent — the
/// def is still persisted for parity). Failures are logged, not fatal.
async fn ensure_record_indexes(
    mongo: &MongoHandle,
    project_id: &str,
    slug: &str,
    indexes: &[IndexMetadata],
) {
    use mongodb::IndexModel;
    use mongodb::options::IndexOptions;

    let coll = mongo.collection::<Document>(RECORDS_COLL);

    for idx in indexes {
        // GIN has no Mongo analogue; persist-only.
        if matches!(idx.r#type, Some(IndexType::Gin)) {
            continue;
        }
        if idx.fields.is_empty() {
            continue;
        }

        // Always scope the physical index by tenant + object so it never
        // spans projects or other objects' records.
        let mut keys = doc! { "projectId": 1, "object": 1 };
        for key in &idx.fields {
            keys.insert(format!("data.{key}"), 1);
        }

        let name = format!("sabcrm_{slug}_{}", idx.name);
        let opts = IndexOptions::builder()
            .name(Some(name.clone()))
            .unique(idx.unique)
            .build();
        let model = IndexModel::builder().keys(keys).options(opts).build();

        if let Err(e) = coll.create_index(model).await {
            warn!(
                project_id,
                slug,
                index = %idx.name,
                error = %e,
                "sabcrm_objects.ensure_record_indexes: index create failed (non-fatal)"
            );
        }
    }
}

/// `PUT /v1/sabcrm/objects/{slug}/indexes` — replace the persisted `indexes`
/// definitions for an object and best-effort reconcile real indexes on the
/// `sabcrm_records` collection (scoped by `projectId` + object). For a
/// standard slug with no persisted doc yet, an `extendsStandard` override
/// doc is upserted to carry the index defs.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn set_object_indexes(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Json(body): Json<SetIndexesInput>,
) -> Result<Json<ObjectResponse>> {
    let project_id = require_project(&body.project_id)?;

    let indexes_bson = bson::to_bson(&body.indexes).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_objects.indexes.to_bson"))
    })?;

    let now = Utc::now().to_rfc3339();
    let coll = mongo.collection::<Document>(OBJECTS_COLL);

    // Upsert: if a custom/override doc exists, just $set indexes; otherwise
    // create the override carrier (standard slugs get extendsStandard: true).
    let on_insert = if is_standard_slug(&slug) {
        doc! { "slug": &slug, "projectId": project_id, "extendsStandard": true, "createdAt": &now }
    } else {
        doc! { "slug": &slug, "projectId": project_id, "createdAt": &now }
    };

    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "slug": &slug },
            doc! {
                "$set": { "indexes": indexes_bson, "updatedAt": &now },
                "$setOnInsert": on_insert,
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_objects.indexes.find_one_and_update"),
            )
        })?;

    // Best-effort physical index reconciliation.
    ensure_record_indexes(&mongo, project_id, &slug, &body.indexes).await;

    // Return the merged object (standard base + this override doc).
    let object = match (standard_object(&slug).map(ObjectMetadata::from_core), updated) {
        (Some(mut base), Some(ext_doc)) => {
            let ext = doc_to_object(ext_doc)?;
            merge_extra_fields(&mut base, &ext);
            base.indexes = ext.indexes;
            base
        }
        (Some(base), None) => base,
        (None, Some(custom_doc)) => doc_to_object(custom_doc)?,
        (None, None) => return Err(ApiError::NotFound("object".to_owned())),
    };

    Ok(Json(ObjectResponse { object }))
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

// ===========================================================================
// POST /{slug}/sync — seed/sync workspaceMembers records from the roster
// ===========================================================================

/// The object slug whose records are sourced from the project roster rather
/// than hand-created in the CRM. Only this slug honours the sync endpoint.
const WORKSPACE_MEMBERS_SLUG: &str = "workspaceMembers";

/// One resolved roster member: the user's ObjectId (which becomes the
/// workspaceMembers record `_id` so accountOwner / owner / assignee relation
/// values — stored as that hex id — resolve directly) plus their workspace
/// role slug.
struct RosterMember {
    user_id: ObjectId,
    role: String,
}

/// Map a SabNode project role slug onto the `workspaceMembers.role` SELECT
/// options (`OWNER` / `ADMIN` / `MEMBER` / `GUEST`). Mirrors the conservative
/// mapping in `members.server.ts` (owner/admin → elevated; everything else →
/// member), surfaced here as the CRM object's own role vocabulary.
fn member_role_option(project_role: &str) -> &'static str {
    match project_role.trim().to_ascii_lowercase().as_str() {
        "owner" => "OWNER",
        "admin" => "ADMIN",
        "guest" => "GUEST",
        _ => "MEMBER",
    }
}

/// Read the project's owner + agents roster from the `projects` collection.
/// `agents[].userId` may be stored as an `ObjectId` or a legacy hex string;
/// both are accepted. The owner is always first and deduplicated against the
/// agents list. A missing project yields `404`.
async fn load_roster(mongo: &MongoHandle, project_oid: ObjectId) -> Result<Vec<RosterMember>> {
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": project_oid })
        .projection(doc! { "userId": 1, "agents": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    let mut roster: Vec<RosterMember> = Vec::new();
    let mut seen: std::collections::HashSet<ObjectId> = std::collections::HashSet::new();

    // Owner first. `userId` is an ObjectId reference to `users._id`.
    if let Ok(owner) = project.get_object_id("userId") {
        seen.insert(owner);
        roster.push(RosterMember {
            user_id: owner,
            role: "owner".to_owned(),
        });
    }

    // Agents next, accepting ObjectId or hex-string `userId`.
    if let Ok(agents) = project.get_array("agents") {
        for a in agents {
            let Bson::Document(agent) = a else { continue };
            let uid = match agent.get("userId") {
                Some(Bson::ObjectId(o)) => Some(*o),
                Some(Bson::String(s)) => ObjectId::parse_str(s.trim()).ok(),
                _ => None,
            };
            let Some(uid) = uid else { continue };
            if !seen.insert(uid) {
                continue; // already captured (owner listed as agent)
            }
            let role = agent
                .get_str("role")
                .ok()
                .map(str::to_owned)
                .unwrap_or_else(|| "agent".to_owned());
            roster.push(RosterMember { user_id: uid, role });
        }
    }

    Ok(roster)
}

/// `POST /v1/sabcrm/objects/{slug}/sync` — seed/sync the records that back a
/// roster-sourced standard object. Only `workspaceMembers` is supported today
/// (other slugs return `400`); the records are derived from the project's
/// team (owner + agents) joined to `users` for profile fields.
///
/// Each member becomes one `sabcrm_records` document
/// `{ _id: <users._id>, projectId, object: "workspaceMembers", data: { id,
/// name, email, avatarUrl, role } }`. Using the user's `_id` as the record id
/// means relation fields that store a member id (accountOwner / opportunity
/// owner / task assignee) resolve directly against the existing enrichment
/// path (which looks members up by `_id`).
///
/// Idempotent: members are upserted by `_id`, profile fields are refreshed on
/// every call, and member records no longer on the roster are pruned. Purely
/// additive — never touches non-member records.
#[instrument(skip_all, fields(slug = %slug))]
pub async fn sync_object_records(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(slug): Path<String>,
    Json(body): Json<SyncMembersInput>,
) -> Result<Json<SyncMembersResponse>> {
    let project_id = require_project(&body.project_id)?;

    if slug != WORKSPACE_MEMBERS_SLUG {
        return Err(ApiError::BadRequest(format!(
            "sync is only supported for the `{WORKSPACE_MEMBERS_SLUG}` object, not `{slug}`."
        )));
    }

    let project_oid = ObjectId::parse_str(project_id)
        .map_err(|_| ApiError::Validation("projectId must be a valid id.".to_owned()))?;

    // Resolve the roster (owner + agents) from the project doc.
    let roster = load_roster(&mongo, project_oid).await?;

    // Join `users` for profile fields in a single query.
    let user_oids: Vec<ObjectId> = roster.iter().map(|m| m.user_id).collect();
    let mut profiles: std::collections::HashMap<ObjectId, (String, String, Option<String>)> =
        std::collections::HashMap::new();
    if !user_oids.is_empty() {
        let users = mongo.collection::<Document>(USERS_COLL);
        let mut cursor = users
            .find(doc! { "_id": { "$in": &user_oids } })
            .projection(doc! { "name": 1, "email": 1, "image": 1 })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.find")))?;
        while let Some(u) = cursor
            .try_next()
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.cursor")))?
        {
            let Ok(uid) = u.get_object_id("_id") else {
                continue;
            };
            let name = u.get_str("name").unwrap_or_default().to_owned();
            let email = u.get_str("email").unwrap_or_default().to_owned();
            let image = u
                .get_str("image")
                .ok()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned);
            profiles.insert(uid, (name, email, image));
        }
    }

    // Upsert one record per roster member, keyed by the user's ObjectId.
    let now = Utc::now().to_rfc3339();
    let records = mongo.collection::<Document>(RECORDS_COLL);
    let mut upserted: u64 = 0;
    let mut member_ids: Vec<ObjectId> = Vec::with_capacity(roster.len());

    for member in &roster {
        member_ids.push(member.user_id);
        let (name, email, avatar_url) = profiles
            .get(&member.user_id)
            .cloned()
            .unwrap_or_else(|| (String::new(), String::new(), None));

        let mut data = doc! {
            "id": member.user_id.to_hex(),
            "name": &name,
            "email": &email,
            "role": member_role_option(&member.role),
        };
        match &avatar_url {
            Some(url) => {
                data.insert("avatarUrl", url);
            }
            None => {
                data.insert("avatarUrl", Bson::Null);
            }
        }

        let res = records
            .update_one(
                doc! {
                    "_id": member.user_id,
                    "projectId": project_id,
                    "object": WORKSPACE_MEMBERS_SLUG,
                },
                doc! {
                    "$set": { "data": data, "updatedAt": &now },
                    "$setOnInsert": {
                        "projectId": project_id,
                        "object": WORKSPACE_MEMBERS_SLUG,
                        "createdAt": &now,
                    },
                },
            )
            .upsert(true)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.members.upsert"))
            })?;

        if res.upserted_id.is_some() || res.modified_count > 0 || res.matched_count > 0 {
            upserted += 1;
        }
    }

    // Prune stale member records that are no longer on the roster (left the
    // project). Never touches non-member records — scoped by object slug.
    let prune = records
        .delete_many(doc! {
            "projectId": project_id,
            "object": WORKSPACE_MEMBERS_SLUG,
            "_id": { "$nin": &member_ids },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.members.prune"))
        })?;

    Ok(Json(SyncMembersResponse {
        ok: true,
        upserted,
        removed: prune.deleted_count,
        total: roster.len() as u64,
    }))
}
