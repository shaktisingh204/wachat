//! HTTP handlers for the SabCRM templates domain.
//!
//! CRUD over the `sabcrm_templates` Mongo collection.
//!
//! | Endpoint                                  | TS source            |
//! |-------------------------------------------|----------------------|
//! | `GET    /v1/sabcrm/templates`             | `listTemplates`      |
//! | `POST   /v1/sabcrm/templates`             | `createTemplate`     |
//! | `GET    /v1/sabcrm/templates/{id}`        | `getTemplate`        |
//! | `PATCH  /v1/sabcrm/templates/{id}`        | `updateTemplate`     |
//! | `DELETE /v1/sabcrm/templates/{id}`        | `deleteTemplate`     |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateTemplateInput, ListQuery, ListResponse, OkResponse, PreviewInput, RenderInput,
    RenderResponse, ScopeQuery, TemplateResponse, UpdateTemplateInput,
};
use crate::interpolate;

/// The Mongo collection backing templates.
const TEMPLATES_COLL: &str = "sabcrm_templates";

/// The Mongo collection backing CRM records — the render endpoints read a
/// record's `data` field map from here to source `{{variable}}` values.
const RECORDS_COLL: &str = "sabcrm_records";

/// Top-level key carrying resolved relation hints on an enriched record:
/// `fieldKey → { id, label, avatarUrl }`. Mirrors the records surface's
/// `?enrich=relations` output. Used to resolve dotted relation paths such as
/// `{{company.name}}` when `data.company` only holds a bare relation id.
const RELATIONS_KEY: &str = "__relations";

/// Top-level key carrying resolved ACTOR hints (e.g. `createdBy`) on an
/// enriched record, same hint shape as [`RELATIONS_KEY`]. Folded into the
/// relation-hint map so `{{createdBy.name}}` resolves.
const ACTORS_KEY: &str = "__actors";

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

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

/// Convert an incoming flattened JSON object into a BSON `Document`,
/// dropping `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

// ===========================================================================
// GET / — listTemplates
// ===========================================================================

/// `GET /v1/sabcrm/templates` — list the templates for a project, scoped by
/// `{ projectId }` and optionally filtered by `{ kind }`.
#[instrument(skip_all)]
pub async fn list_templates(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(kind) = query.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("kind", kind);
    }
    if let Some(object_type) = query
        .object_type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("objectType", object_type);
    }

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.find"))
        })?;

    let mut templates = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.cursor"))
    })? {
        templates.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { templates }))
}

// ===========================================================================
// GET /{id} — getTemplate
// ===========================================================================

/// `GET /v1/sabcrm/templates/{id}` — fetch a single template scoped by
/// `{ projectId, _id }`. Returns `404` if no template matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("template".to_owned()))?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — createTemplate
// ===========================================================================

/// `POST /v1/sabcrm/templates` — create a template. `createdAt` /
/// `updatedAt` are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateTemplateInput>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&body.project_id)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    let kind = body.kind.trim();
    if kind.is_empty() {
        return Err(ApiError::Validation("kind is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    new_doc.insert("kind", kind);
    if let Some(object_type) = body
        .object_type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        new_doc.insert("objectType", object_type);
    }
    if let Some(subject) = body.subject.as_deref() {
        new_doc.insert("subject", subject);
    }
    new_doc.insert("body", &body.body);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.insert_one"))
    })?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateTemplate
// ===========================================================================

/// `PATCH /v1/sabcrm/templates/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated template.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTemplateInput>,
) -> Result<Json<TemplateResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_templates.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("template".to_owned()))?;

    Ok(Json(TemplateResponse {
        template: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteTemplate
// ===========================================================================

/// `DELETE /v1/sabcrm/templates/{id}` — scoped delete. Returns `404` if no
/// template matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("template".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// render / preview — {{variable}} interpolation over a record
// ===========================================================================

/// Shallow-merge `overrides` (object) over `base` (object) — keys in
/// `overrides` win. Non-object inputs are ignored. Used to let an inline
/// `variables` map override individual fields of a fetched record.
fn merge_vars(base: Value, overrides: Option<Value>) -> Value {
    let mut map = match base {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Some(Value::Object(over)) = overrides {
        for (k, v) in over {
            map.insert(k, v);
        }
    }
    Value::Object(map)
}

/// Variable sources for one render: the flat / nested field map and an
/// (optionally empty) `fieldKey → hint` relation-hint map. Relation hints are
/// consulted only when a dotted path does not resolve against `vars`.
struct RenderVars {
    /// Flat / nested field map (the record's `data`, plus inline overrides).
    vars: Value,
    /// `fieldKey → { id, label, avatarUrl }` relation hints (may be empty).
    relations: Value,
}

/// Pull resolved relation hints out of an enriched record wire JSON, folding
/// the `__relations` and `__actors` maps into a single `fieldKey → hint`
/// object. Returns an empty object when neither is present.
fn extract_relation_hints(wire: &Value) -> Value {
    let mut hints = serde_json::Map::new();
    for key in [RELATIONS_KEY, ACTORS_KEY] {
        if let Some(Value::Object(map)) = wire.get(key) {
            for (k, v) in map {
                hints.insert(k.clone(), v.clone());
            }
        }
    }
    Value::Object(hints)
}

/// Build the variable sources for a render request: fetch the record's `data`
/// field (when `record_id` + `object` are supplied), capture any resolved
/// relation hints (`__relations` / `__actors`), and layer any inline
/// `variables` over the field map. With no `record_id`, the inline
/// `variables` (or an empty object) are used directly.
async fn resolve_render_vars(
    mongo: &MongoHandle,
    project_id: &str,
    object: Option<&str>,
    record_id: Option<&str>,
    variables: Option<Value>,
) -> Result<RenderVars> {
    let record_id = record_id.map(str::trim).filter(|s| !s.is_empty());

    let (base, relations) = if let Some(rid) = record_id {
        let object = object
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                ApiError::Validation("object is required when recordId is supplied.".to_owned())
            })?;
        let oid = oid_from_str(rid)?;

        let coll = mongo.collection::<Document>(RECORDS_COLL);
        let found = coll
            .find_one(doc! { "projectId": project_id, "object": object, "_id": oid })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_records.find_one"))
            })?
            .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

        // The record's user-facing fields live under `data`; fall back to the
        // whole cleaned document so top-level system fields are addressable too.
        let mut wire = record_to_wire(found);
        // Capture resolved relation hints (present when the record was stored
        // already enriched) before we narrow the wire JSON down to `data`.
        let relations = extract_relation_hints(&wire);
        let base = match wire.get_mut("data") {
            Some(Value::Object(data)) => Value::Object(std::mem::take(data)),
            _ => wire,
        };
        (base, relations)
    } else {
        (Value::Object(serde_json::Map::new()), Value::Object(serde_json::Map::new()))
    };

    Ok(RenderVars {
        vars: merge_vars(base, variables),
        relations,
    })
}

/// Render a `subject` / `body` pair against `vars` (with relation-hint
/// fallback), collecting the union of unresolved placeholder paths.
fn render_pair(subject: Option<&str>, body: &str, vars: &RenderVars) -> RenderResponse {
    let mut missing = std::collections::BTreeSet::new();

    let rendered_subject = subject.map(|s| {
        let r = interpolate::render_with_relations(s, &vars.vars, &vars.relations);
        missing.extend(r.missing);
        r.text
    });

    let rendered_body = interpolate::render_with_relations(body, &vars.vars, &vars.relations);
    missing.extend(rendered_body.missing);

    RenderResponse {
        subject: rendered_subject,
        body: rendered_body.text,
        missing_variables: missing.into_iter().collect(),
    }
}

/// Pull a `subject` / `body` string out of a stored template document.
fn template_string(doc: &Document, key: &str) -> Option<String> {
    doc.get_str(key).ok().map(str::to_owned)
}

/// `POST /v1/sabcrm/templates/{id}/render` — render a **stored** template
/// against a record (or an inline variable map), substituting `{{variable}}`
/// placeholders. Returns the interpolated subject/body and the set of
/// placeholders that did not resolve.
#[instrument(skip_all, fields(id = %id))]
pub async fn render_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<RenderInput>,
) -> Result<Json<RenderResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(TEMPLATES_COLL);
    let tmpl = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("template".to_owned()))?;

    let subject = template_string(&tmpl, "subject");
    let template_body = template_string(&tmpl, "body").unwrap_or_default();

    let vars = resolve_render_vars(
        &mongo,
        project_id,
        body.object.as_deref(),
        body.record_id.as_deref(),
        body.variables,
    )
    .await?;

    Ok(Json(render_pair(
        subject.as_deref(),
        &template_body,
        &vars,
    )))
}

/// `POST /v1/sabcrm/templates/preview` — render an **ad-hoc** (unsaved)
/// `subject` / `body` against a record or inline variable map. Same
/// substitution semantics as [`render_template`] without requiring a stored
/// template.
#[instrument(skip_all)]
pub async fn preview_template(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<PreviewInput>,
) -> Result<Json<RenderResponse>> {
    let project_id = require_project(&body.project_id)?;

    let vars = resolve_render_vars(
        &mongo,
        project_id,
        body.object.as_deref(),
        body.record_id.as_deref(),
        body.variables,
    )
    .await?;

    Ok(Json(render_pair(
        body.subject.as_deref(),
        &body.body,
        &vars,
    )))
}
