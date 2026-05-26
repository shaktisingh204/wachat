//! HTTP handlers for the Blueprint entity.
//!
//! | Method  | Path             | Function              |
//! |---------|------------------|-----------------------|
//! | `GET`   | `/`              | [`list_blueprints`]   |
//! | `GET`   | `/:blueprintId`  | [`get_blueprint`]     |
//! | `POST`  | `/`              | [`create_blueprint`]  |
//! | `PATCH` | `/:blueprintId`  | [`update_blueprint`]  |
//! | `DELETE`| `/:blueprintId`  | [`delete_blueprint`]  |
//!
//! Every handler scopes Mongo by `userId == AuthUser.user_id`.

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
    Blueprint, CreateBlueprintInput, DEFAULT_LIMIT, ListQuery, MAX_LIMIT, UpdateBlueprintInput,
};

const COLL: &str = "requests_blueprints";

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
pub async fn list_blueprints(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Blueprint>>> {
    let user_id = user_oid(&user)?;
    let mut filter = base_filter(user_id);

    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": needle, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "category": regex }),
            ]),
        );
    }
    if let Some(cat) = q.category.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", cat);
    }
    if let Some(team) = q.owner_team_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("ownerTeamId", oid_from_str(team)?);
    }
    if let Some(p) = q.published {
        filter.insert("published", p);
    }

    let limit = clamp_limit(q.limit);
    let page = q.page.unwrap_or(1).max(1) as i64;
    let skip = ((page - 1) * limit).max(0) as u64;

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .build();

    let coll = mongo.collection::<Blueprint>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.find")))?;
    let docs: Vec<Blueprint> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.collect")))?;
    Ok(Json(docs))
}

#[instrument(skip_all, fields(user_id = %user.user_id, blueprint_id = %blueprint_id))]
pub async fn get_blueprint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(blueprint_id): Path<String>,
) -> Result<Json<Blueprint>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&blueprint_id)?;
    let mut filter = base_filter(user_id);
    filter.insert("_id", oid);
    let coll = mongo.collection::<Blueprint>(COLL);
    let doc = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.find_one")))?
        .ok_or_else(|| ApiError::NotFound("blueprint".to_owned()))?;
    Ok(Json(doc))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_blueprint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBlueprintInput>,
) -> Result<Json<Blueprint>> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }
    let user_id = user_oid(&user)?;
    let project_id = match input.project_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => oid_from_str(s)?,
        None => ObjectId::new(),
    };
    let owner_team_id = match input.owner_team_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };

    let blueprint = Blueprint {
        identity: Identity {
            id: ObjectId::new(),
            project_id,
            user_id,
            tenant_id: None,
        },
        audit: Audit::new(Some(user_id)),
        assignment: Assignment::default(),
        name: input.name.trim().to_owned(),
        description: input.description,
        category: input.category,
        icon: input.icon,
        form_schema: input.form_schema.unwrap_or(serde_json::json!({})),
        stages: input.stages.unwrap_or_default(),
        routing_rules: input.routing_rules.unwrap_or_default(),
        owner_team_id,
        sla_mins: input.sla_mins,
        published: input.published.unwrap_or(false),
        archived: false,
        deleted_at: None,
    };

    let coll = mongo.collection::<Blueprint>(COLL);
    coll.insert_one(&blueprint)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.insert_one")))?;
    Ok(Json(blueprint))
}

#[instrument(skip_all, fields(user_id = %user.user_id, blueprint_id = %blueprint_id))]
pub async fn update_blueprint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(blueprint_id): Path<String>,
    Json(input): Json<UpdateBlueprintInput>,
) -> Result<Json<Blueprint>> {
    if input.is_empty() {
        return Err(ApiError::BadRequest(
            "no fields to update; supply at least one mutable field".to_owned(),
        ));
    }
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&blueprint_id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    if let Some(v) = input.name { set.insert("name", v); }
    if let Some(v) = input.description { set.insert("description", v); }
    if let Some(v) = input.category { set.insert("category", v); }
    if let Some(v) = input.icon { set.insert("icon", v); }
    if let Some(v) = input.form_schema {
        let b = bson::to_bson(&v).map_err(|e| ApiError::Validation(format!("formSchema: {e}")))?;
        set.insert("formSchema", b);
    }
    if let Some(v) = input.stages {
        let b = bson::to_bson(&v).map_err(|e| ApiError::Validation(format!("stages: {e}")))?;
        set.insert("stages", b);
    }
    if let Some(v) = input.routing_rules {
        let b = bson::to_bson(&v).map_err(|e| ApiError::Validation(format!("routingRules: {e}")))?;
        set.insert("routingRules", b);
    }
    if let Some(v) = input.owner_team_id {
        set.insert("ownerTeamId", oid_from_str(&v)?);
    }
    if let Some(v) = input.sla_mins { set.insert("slaMins", v as i64); }
    if let Some(v) = input.published { set.insert("published", v); }

    let mut filter = base_filter(user_id);
    filter.insert("_id", oid);

    let coll_doc = mongo.collection::<Document>(COLL);
    let res = coll_doc
        .update_one(filter.clone(), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("blueprint".to_owned()));
    }
    let typed = mongo.collection::<Blueprint>(COLL);
    let doc = typed
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.find_one(after-update)")))?
        .ok_or_else(|| ApiError::NotFound("blueprint".to_owned()))?;
    Ok(Json(doc))
}

/// Soft delete — sets `archived = true` + `deletedAt = now()`.
#[instrument(skip_all, fields(user_id = %user.user_id, blueprint_id = %blueprint_id))]
pub async fn delete_blueprint(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(blueprint_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&blueprint_id)?;
    let filter = doc! { "_id": oid, "userId": user_id };
    let set = doc! {
        "archived": true,
        "deletedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        "updatedBy": user_id,
    };
    let coll = mongo.collection::<Document>(COLL);
    let res = coll
        .update_one(filter, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("blueprints.soft_delete")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("blueprint".to_owned()));
    }
    Ok(Json(serde_json::json!({ "ok": true, "archived": true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limit_uses_default() {
        assert_eq!(clamp_limit(None), DEFAULT_LIMIT);
    }
    #[test]
    fn clamp_limit_caps() {
        assert_eq!(clamp_limit(Some(9_999)), MAX_LIMIT);
    }
    #[test]
    fn base_filter_excludes_archived() {
        let oid = ObjectId::new();
        let f = base_filter(oid);
        assert!(f.contains_key("userId"));
        let archived = f.get_document("archived").unwrap();
        assert!(archived.contains_key("$ne"));
    }
}
