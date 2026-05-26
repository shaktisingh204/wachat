//! HTTP handlers for Request Instances.
//!
//! | Method  | Path                | Function              |
//! |---------|---------------------|-----------------------|
//! | `GET`   | `/`                 | [`list_requests`]     |
//! | `GET`   | `/:requestId`       | [`get_request`]       |
//! | `POST`  | `/`                 | [`create_request`]    |
//! | `PATCH` | `/:requestId`       | [`update_request`]    |
//! | `POST`  | `/:requestId/decision` | [`decide_request`] |
//! | `DELETE`| `/:requestId`       | [`delete_request`]    |
//!
//! `decide_request` advances `currentStageIdx` and writes a row into
//! the `requests_stage_actions` collection (append-only audit log).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Assignment, Audit, Identity};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateRequestInput, CurrentStageView, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, RequestInstance,
    RequestStatus, StageDecisionInput, UpdateRequestInput,
};

const COLL: &str = "requests_instances";
/// Sibling collection — owned by [`sabrequests-stage-actions`] but written
/// to here so the approve/reject flow stays atomic-feeling to the UI.
const ACTIONS_COLL: &str = "requests_stage_actions";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn clamp_limit(requested: Option<u32>) -> i64 {
    match requested {
        None => DEFAULT_LIMIT,
        Some(n) => (n as i64).clamp(1, MAX_LIMIT),
    }
}

fn base_filter(user: ObjectId) -> Document {
    doc! { "userId": user, "archived": { "$ne": true } }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_requests(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<RequestInstance>>> {
    let user_id = user_oid(&user)?;
    let mut filter = base_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "title": regex.clone() }),
                Bson::Document(doc! { "blueprintName": regex }),
            ]),
        );
    }
    if let Some(bp) = q.blueprint_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("blueprintId", oid_from_str(bp)?);
    }
    if let Some(status) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // validate via enum round-trip
        let _parsed: RequestStatus = serde_json::from_value(serde_json::Value::String(status.to_owned()))
            .map_err(|_| ApiError::Validation(format!("status '{status}' is not recognised")))?;
        filter.insert("status", status);
    }
    if let Some(true) = q.awaiting_me {
        // Pending + currentStage.approverId == caller. The caller IS the
        // tenant root in single-tenant mode; for shared multi-user
        // tenants the `currentStage.approverId` references an inner
        // member, and the UI must pass `awaitingMe=false` + filter on
        // its own context. (Deferred — see lib.rs TODO.)
        filter.insert("status", "pending");
        filter.insert("currentStage.approverId", user_id);
    }
    if let Some(true) = q.mine {
        filter.insert("requesterId", user_id);
    }
    if let Some(true) = q.breached {
        filter.insert("breachedAt", doc! { "$ne": null });
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();
    let coll = mongo.collection::<RequestInstance>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.find")))?;
    let docs: Vec<RequestInstance> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.collect")))?;
    Ok(Json(docs))
}

#[instrument(skip_all, fields(user_id = %user.user_id, request_id = %request_id))]
pub async fn get_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<RequestInstance>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let mut filter = base_filter(user_id);
    filter.insert("_id", oid);
    let coll = mongo.collection::<RequestInstance>(COLL);
    let doc = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.find_one")))?
        .ok_or_else(|| ApiError::NotFound("request".to_owned()))?;
    Ok(Json(doc))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRequestInput>,
) -> Result<Json<RequestInstance>> {
    if input.blueprint_id.trim().is_empty() {
        return Err(ApiError::Validation("blueprintId is required.".to_owned()));
    }
    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };
    let blueprint_id = oid_from_str(&input.blueprint_id)?;

    let inst = RequestInstance {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment::default(),
        blueprint_id,
        blueprint_name: input.blueprint_name,
        blueprint_category: input.blueprint_category,
        requester_id: user_id,
        form_data: input.form_data.unwrap_or(serde_json::json!({})),
        current_stage_idx: input.current_stage_idx.unwrap_or(0),
        current_stage: input.current_stage,
        status: RequestStatus::Pending,
        sla_deadline_at: input.sla_deadline_at,
        breached_at: None,
        decided_at: None,
        attachments: input.attachments.unwrap_or_default(),
        title: input.title,
        priority: input.priority,
        archived: false,
    };
    let coll = mongo.collection::<RequestInstance>(COLL);
    coll.insert_one(&inst)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.insert_one")))?;
    Ok(Json(inst))
}

#[instrument(skip_all, fields(user_id = %user.user_id, request_id = %request_id))]
pub async fn update_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Json(input): Json<UpdateRequestInput>,
) -> Result<Json<RequestInstance>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest("no fields to update".to_owned()));
    }
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    if let Some(t) = input.title { set.insert("title", t); }
    if let Some(p) = input.priority { set.insert("priority", p); }
    if let Some(fd) = input.form_data {
        let b = bson::to_bson(&fd).map_err(|e| ApiError::Validation(format!("formData: {e}")))?;
        set.insert("formData", b);
    }
    if let Some(att) = input.attachments {
        let b = bson::to_bson(&att).map_err(|e| ApiError::Validation(format!("attachments: {e}")))?;
        set.insert("attachments", b);
    }
    if let Some(true) = input.cancel {
        set.insert("status", "cancelled");
        set.insert("decidedAt", bson::DateTime::from_chrono(Utc::now()));
    }

    let mut filter = base_filter(user_id);
    filter.insert("_id", oid);
    let coll_doc = mongo.collection::<Document>(COLL);
    let res = coll_doc
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("request".to_owned()));
    }
    let typed = mongo.collection::<RequestInstance>(COLL);
    let doc = typed
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.find_one(after)")))?
        .ok_or_else(|| ApiError::NotFound("request".to_owned()))?;
    Ok(Json(doc))
}

/// POST `/:requestId/decision` — approver acts on the current stage.
///
/// Writes an entry into `requests_stage_actions` AND mutates the
/// instance. Both writes happen in this single handler — the stage
/// actions crate exposes a separate read-only list endpoint for the
/// timeline UI.
#[instrument(skip_all, fields(user_id = %user.user_id, request_id = %request_id))]
pub async fn decide_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
    Json(input): Json<StageDecisionInput>,
) -> Result<Json<RequestInstance>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let action = input.action.trim().to_lowercase();
    if !matches!(action.as_str(), "approve" | "reject" | "reassign" | "comment") {
        return Err(ApiError::Validation(format!(
            "action '{action}' must be one of: approve, reject, reassign, comment"
        )));
    }

    let mut filter = base_filter(user_id);
    filter.insert("_id", oid);

    // Load current state so we can mutate idx + status correctly.
    let typed = mongo.collection::<RequestInstance>(COLL);
    let inst = typed
        .find_one(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.find_one")))?
        .ok_or_else(|| ApiError::NotFound("request".to_owned()))?;

    if inst.status != RequestStatus::Pending && action != "comment" {
        return Err(ApiError::BadRequest(format!(
            "request is already {:?} — only 'comment' is allowed",
            inst.status
        )));
    }

    let now = Utc::now();
    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(now),
        "updatedBy": user_id,
    };

    match action.as_str() {
        "approve" => {
            // If caller supplied a nextStage, advance there; else mark
            // the workflow approved (final stage).
            if let Some(next) = input.next_stage.as_ref() {
                set.insert(
                    "currentStage",
                    bson::to_bson(next)
                        .map_err(|e| ApiError::Validation(format!("nextStage: {e}")))?,
                );
                set.insert(
                    "currentStageIdx",
                    input.next_stage_idx.unwrap_or(next.idx) as i64,
                );
                if let Some(dl) = input.next_sla_deadline_at {
                    set.insert("slaDeadlineAt", bson::DateTime::from_chrono(dl));
                } else {
                    set.insert("slaDeadlineAt", Bson::Null);
                }
                set.insert("breachedAt", Bson::Null);
            } else {
                set.insert("status", "approved");
                set.insert("decidedAt", bson::DateTime::from_chrono(now));
            }
        }
        "reject" => {
            set.insert("status", "rejected");
            set.insert("decidedAt", bson::DateTime::from_chrono(now));
        }
        "reassign" => {
            let to = input.reassign_to.as_deref().ok_or_else(|| {
                ApiError::Validation("reassignTo is required for action=reassign".to_owned())
            })?;
            let to_oid = oid_from_str(to)?;
            // Update the embedded current stage's approverId.
            set.insert("currentStage.approverId", to_oid);
        }
        "comment" => {
            // No-op on the instance; only the action log gets a row.
        }
        _ => unreachable!(),
    }

    let coll_doc = mongo.collection::<Document>(COLL);
    let res = coll_doc
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.decide")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("request".to_owned()));
    }

    // Append the audit row. (Sibling crate owns the canonical type;
    // we write a doc-shaped record so we don't take a circular dep.)
    let action_doc = doc! {
        "_id": ObjectId::new(),
        "userId": user_id,
        "requestId": oid,
        "stageIdx": inst.current_stage_idx as i64,
        "actorId": user_id,
        "action": action,
        "note": input.note.unwrap_or_default(),
        "ts": bson::DateTime::from_chrono(now),
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    let actions = mongo.collection::<Document>(ACTIONS_COLL);
    actions.insert_one(action_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("stage_actions.insert_one"))
    })?;

    let after = typed
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.find_one(after)")))?
        .ok_or_else(|| ApiError::NotFound("request".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, request_id = %request_id))]
pub async fn delete_request(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(request_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&request_id)?;
    let filter = doc! { "_id": oid, "userId": user_id };
    let coll = mongo.collection::<Document>(COLL);
    let set = doc! { "$set": { "archived": true, "updatedAt": bson::DateTime::from_chrono(Utc::now()) } };
    let res = coll
        .update_one(filter, set)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requests.archive")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("request".to_owned()));
    }
    Ok(Json(serde_json::json!({ "ok": true, "archived": true })))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clamp_limit_default() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }
    #[test]
    fn clamp_limit_caps() {
        assert_eq!(clamp_limit(Some(9_999)), MAX_LIMIT);
    }
}

// Touch CurrentStageView so cargo doesn't warn on unused import in tests.
#[allow(dead_code)]
fn _touch(_v: CurrentStageView) {}
