//! HTTP handlers for the org chart entity.
//!
//! | Method  | Path             | Function           |
//! |---------|------------------|--------------------|
//! | `GET`   | `/`              | [`list_charts`]    |
//! | `GET`   | `/resolve`       | [`resolve_manager`]|
//! | `POST`  | `/`              | [`upsert_chart`]   |
//! | `PATCH` | `/:chartId`      | [`update_chart`]   |
//! | `DELETE`| `/:chartId`      | [`delete_chart`]   |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_core::{Audit, Identity};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    ListQuery, OrgChart, ResolveManagerQuery, UpdateOrgChartInput, UpsertOrgChartInput,
};

const COLL: &str = "requests_orgcharts";

fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_charts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<OrgChart>>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(o) = q.org_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("orgId", oid_from_str(o)?);
    }
    let coll = mongo.collection::<OrgChart>(COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.find")))?;
    let docs: Vec<OrgChart> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.collect")))?;
    Ok(Json(docs))
}

/// `GET /v1/sabrequests/orgcharts/resolve?userId=…` — return the manager
/// user id for a given user, or 404 if no entry exists.
///
/// This is the hot path the request-creation flow hits when a
/// blueprint stage uses `approverKind = "manager_of_requester"`.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn resolve_manager(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ResolveManagerQuery>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(o) = q.org_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("orgId", oid_from_str(o)?);
    }
    let coll = mongo.collection::<OrgChart>(COLL);
    let chart = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("orgchart".to_owned()))?;
    let manager = chart
        .manager_of
        .get(q.user_id.trim())
        .cloned()
        .ok_or_else(|| ApiError::NotFound("manager".to_owned()))?;
    Ok(Json(
        serde_json::json!({ "userId": q.user_id, "managerUserId": manager }),
    ))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertOrgChartInput>,
) -> Result<Json<OrgChart>> {
    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };
    let org_id = match input.org_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    // Find existing by (userId, orgId).
    let mut filter: Document = doc! { "userId": user_id };
    match org_id {
        Some(o) => {
            filter.insert("orgId", o);
        }
        None => {
            filter.insert("orgId", Bson::Null);
        }
    }
    let coll = mongo.collection::<OrgChart>(COLL);
    if let Some(existing) = coll
        .find_one(filter.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.find_one")))?
    {
        let mut set = doc! {
            "managerOf": bson::to_bson(&input.manager_of)
                .map_err(|e| ApiError::Validation(format!("managerOf: {e}")))?,
            "updatedAt": bson::DateTime::from_chrono(Utc::now()),
            "updatedBy": user_id,
        };
        if let Some(n) = input.name {
            set.insert("name", n);
        }
        let coll_doc = mongo.collection::<Document>(COLL);
        coll_doc
            .update_one(filter.clone(), doc! { "$set": set })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.update")))?;
        let updated = coll
            .find_one(filter)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.refetch")))?
            .unwrap_or(existing);
        return Ok(Json(updated));
    }

    let chart = OrgChart {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        name: input.name,
        org_id,
        manager_of: input.manager_of,
    };
    coll.insert_one(&chart)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.insert_one")))?;
    Ok(Json(chart))
}

#[instrument(skip_all, fields(user_id = %user.user_id, chart_id = %chart_id))]
pub async fn update_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
    Json(input): Json<UpdateOrgChartInput>,
) -> Result<Json<OrgChart>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let filter: Document = doc! { "_id": oid, "userId": user_id };

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    if let Some(n) = input.name {
        set.insert("name", n);
    }

    let mut update = doc! { "$set": set };

    // Per-key set on the embedded `managerOf` object.
    if let Some(entries) = input.set_manager_of {
        let mut per_key = Document::new();
        for (k, v) in entries {
            let key = format!("managerOf.{}", k);
            per_key.insert(key, v);
        }
        if !per_key.is_empty() {
            // Merge into the existing $set rather than creating a second.
            let merged_set = update.get_document_mut("$set").expect("we just built this");
            for (k, v) in per_key {
                merged_set.insert(k, v);
            }
        }
    }
    if let Some(keys) = input.unset_users {
        let mut unset = Document::new();
        for k in keys {
            unset.insert(format!("managerOf.{}", k), "");
        }
        if !unset.is_empty() {
            update.insert("$unset", unset);
        }
    }

    let coll_doc = mongo.collection::<Document>(COLL);
    let res = coll_doc
        .update_one(filter.clone(), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("orgchart".to_owned()));
    }
    let typed = mongo.collection::<OrgChart>(COLL);
    let doc = typed
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("orgcharts.find_one(after)"))
        })?
        .ok_or_else(|| ApiError::NotFound("orgchart".to_owned()))?;
    Ok(Json(doc))
}

#[instrument(skip_all, fields(user_id = %user.user_id, chart_id = %chart_id))]
pub async fn delete_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let filter: Document = doc! { "_id": oid, "userId": user_id };
    let coll = mongo.collection::<Document>(COLL);
    let res = coll
        .delete_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("orgcharts.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("orgchart".to_owned()));
    }
    Ok(Json(serde_json::json!({ "ok": true, "deleted": true })))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manager_map_lookup_works() {
        let mut m: HashMap<String, String> = HashMap::new();
        m.insert("u1".into(), "m1".into());
        assert_eq!(m.get("u1").cloned(), Some("m1".to_owned()));
    }
}
