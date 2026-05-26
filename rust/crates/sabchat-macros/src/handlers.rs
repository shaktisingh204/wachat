//! HTTP handlers for the SabChat macros domain.
//!
//! Every handler enforces tenancy by filtering on
//! `tenantId == ObjectId::parse_str(&auth.tenant_id)`. An unparseable
//! subject yields [`ApiError::Unauthorized`]. Cross-tenant reads /
//! writes therefore surface as plain `404`s, since the tenant clause
//! never matches a foreign-tenant document.
//!
//! | Endpoint                                | Source of truth                |
//! |-----------------------------------------|--------------------------------|
//! | `POST   /v1/sabchat/macros`             | `sabchat_macros` insert        |
//! | `GET    /v1/sabchat/macros`             | `sabchat_macros` find          |
//! | `GET    /v1/sabchat/macros/{id}`        | `sabchat_macros` find_one      |
//! | `PATCH  /v1/sabchat/macros/{id}`        | `sabchat_macros` update_one    |
//! | `DELETE /v1/sabchat/macros/{id}`        | `sabchat_macros` delete_one    |
//! | `POST   /v1/sabchat/macros/{id}/run`    | [`crate::run::execute_macro`]  |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateMacroBody, DEFAULT_LIMIT, ListMacrosQuery, ListMacrosResponse, MAX_LIMIT, MacroResponse,
    MacroStep, RunMacroBody, RunMacroResponse, SuccessResponse, UpdateMacroBody,
};
use crate::run::execute_macro;
use crate::state::SabChatMacrosState;

/// Primary collection — owns macro definitions.
const MACROS_COLL: &str = "sabchat_macros";

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Parse the calling user's `tenantId` claim into an `ObjectId`. A
/// malformed claim is treated as an auth failure (the JWT was issued by
/// us, so a bad value means a tampered token or a buggy issuer).
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Parse the actor (`auth.user_id`) into an `ObjectId`. Run-time audit
/// rows carry the actor when it is parseable; we degrade gracefully for
/// non-ObjectId subjects (system tokens, e.g.).
fn actor_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

/// Encode the [`MacroStep`] list as BSON for storage. Round-trips
/// through `serde_json` so we get the same `tag = "kind"` shape the
/// API uses on the wire.
fn steps_to_bson(steps: &[MacroStep]) -> Result<Bson> {
    let json = serde_json::to_value(steps)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("steps -> json")))?;
    Bson::try_from(json)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("steps json -> bson")))
}

/// Decode a stored macro document back into `Vec<MacroStep>`. Falls
/// back to an empty list on shape errors (the run handler then has
/// nothing to do — surfacing a 500 here would mask the real cause).
fn decode_steps(macro_doc: &Document) -> Vec<MacroStep> {
    let raw = match macro_doc.get_array("steps") {
        Ok(a) => a,
        Err(_) => return Vec::new(),
    };
    let mut out: Vec<MacroStep> = Vec::with_capacity(raw.len());
    for b in raw {
        let v: Value = serde_json::to_value(b).unwrap_or(Value::Null);
        if let Ok(step) = serde_json::from_value::<MacroStep>(v) {
            out.push(step);
        }
    }
    out
}

/// Load one macro, scoped to the caller's tenant. Returns `404` when
/// no matching document exists.
async fn load_macro_scoped(
    mongo: &MongoHandle,
    tenant: ObjectId,
    macro_id_hex: &str,
) -> Result<Document> {
    let macro_oid = oid_from_str(macro_id_hex)?;
    let coll = mongo.collection::<Document>(MACROS_COLL);
    coll.find_one(doc! { "_id": macro_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.find_one(scoped)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Macro not found.".to_owned()))
}

// ===========================================================================
// POST / — create_macro
// ===========================================================================

/// `POST /v1/sabchat/macros` — create a new macro under the caller's
/// tenant.
#[instrument(skip_all, fields(name = %body.name))]
pub async fn create_macro(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Json(body): Json<CreateMacroBody>,
) -> Result<Json<MacroResponse>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::Validation("Macro name is required.".to_owned()));
    }
    let tenant = tenant_oid(&user)?;

    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let steps_bson = steps_to_bson(&body.steps)?;

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "name": body.name.trim(),
        "description": body
            .description
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| Bson::String(s.to_owned()))
            .unwrap_or(Bson::Null),
        "shortcut": body
            .shortcut
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| Bson::String(s.to_owned()))
            .unwrap_or(Bson::Null),
        "steps": steps_bson,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    let coll = state.mongo.collection::<Document>(MACROS_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.insert_one"))
    })?;

    Ok(Json(MacroResponse {
        r#macro: document_to_clean_json(new_doc),
    }))
}

// ===========================================================================
// GET / — list_macros
// ===========================================================================

/// `GET /v1/sabchat/macros` — paginated tenant-scoped macro list.
///
/// Sort order is `_id DESC` (creation time monotonic enough for
/// settings UI); the cursor is the hex `_id` of the last document
/// returned.
#[instrument(skip_all)]
pub async fn list_macros(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Query(query): Query<ListMacrosQuery>,
) -> Result<Json<ListMacrosResponse>> {
    let tenant = tenant_oid(&user)?;
    let mut filter = doc! { "tenantId": tenant };

    if let Some(q) = query.q.as_deref().filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": q, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "shortcut": regex }),
            ]),
        );
    }
    if let Some(cursor) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(cursor)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    let limit = query
        .limit
        .filter(|n| *n > 0)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(MACROS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) >= limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    } else {
        None
    };

    let macros: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListMacrosResponse { macros, next_cursor }))
}

// ===========================================================================
// GET /{id} — get_macro
// ===========================================================================

/// `GET /v1/sabchat/macros/{id}` — fetch one macro by id, tenant-scoped.
#[instrument(skip_all, fields(macro_id = %id))]
pub async fn get_macro(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Path(id): Path<String>,
) -> Result<Json<MacroResponse>> {
    let tenant = tenant_oid(&user)?;
    let doc = load_macro_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(MacroResponse {
        r#macro: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// PATCH /{id} — update_macro
// ===========================================================================

/// `PATCH /v1/sabchat/macros/{id}` — partial update of any of `name`,
/// `description`, `shortcut`, or `steps`. Only the fields explicitly
/// provided are written.
#[instrument(skip_all, fields(macro_id = %id))]
pub async fn update_macro(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateMacroBody>,
) -> Result<Json<MacroResponse>> {
    let tenant = tenant_oid(&user)?;
    let existing = load_macro_scoped(&state.mongo, tenant, &id).await?;
    let macro_oid = existing
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("macro missing _id")))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now_bson };

    if let Some(name) = body.name.as_deref() {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("Name cannot be blank.".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(desc) = body.description.as_deref() {
        let trimmed = desc.trim();
        set.insert(
            "description",
            if trimmed.is_empty() {
                Bson::Null
            } else {
                Bson::String(trimmed.to_owned())
            },
        );
    }
    if let Some(shortcut) = body.shortcut.as_deref() {
        let trimmed = shortcut.trim();
        set.insert(
            "shortcut",
            if trimmed.is_empty() {
                Bson::Null
            } else {
                Bson::String(trimmed.to_owned())
            },
        );
    }
    if let Some(steps) = body.steps.as_deref() {
        set.insert("steps", steps_to_bson(steps)?);
    }

    let coll = state.mongo.collection::<Document>(MACROS_COLL);
    coll.update_one(
        doc! { "_id": macro_oid, "tenantId": tenant },
        doc! { "$set": set },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.update_one"))
    })?;

    let fresh = load_macro_scoped(&state.mongo, tenant, &id).await?;
    Ok(Json(MacroResponse {
        r#macro: document_to_clean_json(fresh),
    }))
}

// ===========================================================================
// DELETE /{id} — delete_macro
// ===========================================================================

/// `DELETE /v1/sabchat/macros/{id}` — hard delete a macro definition.
#[instrument(skip_all, fields(macro_id = %id))]
pub async fn delete_macro(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let macro_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(MACROS_COLL);
    let res = coll
        .delete_one(doc! { "_id": macro_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_macros.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Macro not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /{id}/run — run_macro
// ===========================================================================

/// `POST /v1/sabchat/macros/{id}/run` — load the macro, decode its
/// steps, and hand them to the executor against the target
/// conversation. The executor is best-effort per step; this handler
/// always returns `200 OK` with the run report so callers can show
/// per-step state in the UI.
#[instrument(skip_all, fields(macro_id = %id, conversation_id = %body.conversation_id))]
pub async fn run_macro(
    user: AuthUser,
    State(state): State<SabChatMacrosState>,
    Path(id): Path<String>,
    Json(body): Json<RunMacroBody>,
) -> Result<Json<RunMacroResponse>> {
    if body.conversation_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "conversationId is required.".to_owned(),
        ));
    }
    let tenant = tenant_oid(&user)?;
    let macro_doc = load_macro_scoped(&state.mongo, tenant, &id).await?;
    let steps = decode_steps(&macro_doc);

    let actor = actor_oid(&user);
    let vars = body.vars.unwrap_or(Value::Null);
    let result = execute_macro(
        &state.mongo,
        tenant,
        actor,
        &body.conversation_id,
        &steps,
        vars,
    )
    .await;

    Ok(Json(RunMacroResponse {
        steps_ran: result.steps_ran,
        errors: result.errors,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decode_steps_round_trips_known_kinds() {
        // Build a doc that looks like what we'd store: `steps` is an
        // array of tagged enum bodies.
        let steps_json = json!([
            { "kind": "add_label", "label": "vip" },
            { "kind": "set_status", "status": "resolved" },
            { "kind": "resolve" },
            { "kind": "wait", "seconds": 1 },
        ]);
        let steps_bson: Bson = Bson::try_from(steps_json).unwrap();
        let doc = doc! { "steps": steps_bson };
        let parsed = decode_steps(&doc);
        assert_eq!(parsed.len(), 4);
        // Spot-check the discriminants made it through.
        match &parsed[0] {
            MacroStep::AddLabel { label } => assert_eq!(label, "vip"),
            other => panic!("unexpected variant: {other:?}"),
        }
        match parsed[2] {
            MacroStep::Resolve => {}
            ref other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn decode_steps_tolerates_missing_field() {
        let doc = doc! {};
        assert!(decode_steps(&doc).is_empty());
    }
}
