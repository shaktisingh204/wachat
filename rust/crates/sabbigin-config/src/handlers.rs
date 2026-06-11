//! HTTP handlers for the SabBigin per-tenant configuration entity.
//!
//! Every handler scopes its Mongo query by `userId == AuthUser.user_id`
//! and writes a best-effort audit row to `crm_audit_log`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateSabbiginConfigInput, CreateSabbiginConfigResponse, DeleteSabbiginConfigResponse,
    ListQuery, UpdateSabbiginConfigInput,
};
use crate::types::SabbiginConfig;

const COLL: &str = "sabbigin_configs";
const ENTITY_KIND: &str = "sabbigin_config";

/// The default `pipelineLimit` for a fresh SabBigin tenant. `0` means "no
/// admin override" — the effective pipeline cap is derived from the plan tier
/// in the TS layer (unlimited while the SKU is unpriced).
const DEFAULT_PIPELINE_LIMIT: u32 = 0;

// ─── Filter helpers ──────────────────────────────────────────────────────

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

// ─── Mapping helpers ────────────────────────────────────────────────────

fn config_from_create(
    input: CreateSabbiginConfigInput,
    user_id: ObjectId,
) -> Result<SabbiginConfig> {
    let pipeline_oid = match input.pipeline_id.as_deref() {
        Some(s) if !s.trim().is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let allowed_features = input
        .allowed_features
        .unwrap_or_else(SabbiginConfig::default_features);
    let pipeline_limit = input.pipeline_limit.unwrap_or(DEFAULT_PIPELINE_LIMIT);

    Ok(SabbiginConfig {
        id: None,
        user_id,
        enabled: input.enabled.unwrap_or(true),
        pipeline_id: pipeline_oid,
        pipeline_limit,
        allowed_features,
        default_currency: input.default_currency,
        multi_currency: input.multi_currency.unwrap_or(false),
        email_in_enabled: input.email_in_enabled.unwrap_or(false),
        public_branding: None,
        onboarding: None,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSabbiginConfigInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.enabled {
        set.insert("enabled", v);
    }
    if let Some(v) = patch.pipeline_id {
        if v.trim().is_empty() {
            set.insert("pipelineId", Bson::Null);
        } else {
            set.insert("pipelineId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.pipeline_limit {
        set.insert("pipelineLimit", v as i64);
    }
    if let Some(v) = patch.allowed_features {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("allowedFeatures", arr);
    }
    if let Some(v) = patch.default_currency {
        set.insert("defaultCurrency", v);
    }
    if let Some(v) = patch.multi_currency {
        set.insert("multiCurrency", v);
    }
    if let Some(v) = patch.email_in_enabled {
        set.insert("emailInEnabled", v);
    }
    if let Some(v) = patch.public_branding {
        set.insert(
            "publicBranding",
            bson::to_bson(&v).unwrap_or(Bson::Null),
        );
    }
    if let Some(v) = patch.onboarding {
        set.insert("onboarding", bson::to_bson(&v).unwrap_or(Bson::Null));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SabbiginConfig) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

// ─── List response ───────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabbiginConfig>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_configs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let filter = list_filter(user_id, q.status.as_deref());

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabbiginConfig>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.find"))
        })?;
    let mut rows: Vec<SabbiginConfig> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.collect"))
    })?;

    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

// ─── GET /current ────────────────────────────────────────────────────────

/// Convenience endpoint. Returns the most-recently-updated **active** config
/// for the tenant, or `404` when none exists. The SabBigin home page calls this
/// instead of `list` + `[0]`.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_current_config(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<SabbiginConfig>> {
    let user_id = user_oid(&user)?;
    let coll = mongo.collection::<SabbiginConfig>(COLL);
    let row = coll
        .find_one(doc! { "userId": user_id, "status": { "$ne": "archived" } })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.find_current"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_config".to_owned()))?;
    Ok(Json(row))
}

// ─── GET /:id ────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %config_id))]
pub async fn get_config(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(config_id): Path<String>,
) -> Result<Json<SabbiginConfig>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&config_id)?;
    let coll = mongo.collection::<SabbiginConfig>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_config".to_owned()))?;
    Ok(Json(row))
}

// ─── POST / ──────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_config(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSabbiginConfigInput>,
) -> Result<Json<CreateSabbiginConfigResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = config_from_create(input, user_id)?;
    let coll = mongo.collection::<SabbiginConfig>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateSabbiginConfigResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

// ─── PATCH /:id ──────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %config_id))]
pub async fn update_config(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(config_id): Path<String>,
    Json(patch): Json<UpdateSabbiginConfigInput>,
) -> Result<Json<SabbiginConfig>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&config_id)?;
    let coll = mongo.collection::<SabbiginConfig>(COLL);

    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabbigin_config".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbigin_config".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sabbigin_config".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

// ─── DELETE /:id (soft) ──────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, id = %config_id))]
pub async fn delete_config(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(config_id): Path<String>,
) -> Result<Json<DeleteSabbiginConfigResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&config_id)?;
    let coll = mongo.collection::<SabbiginConfig>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "enabled": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbigin_configs.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabbigin_config".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteSabbiginConfigResponse { deleted: true }))
}

// ─── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_defaults_to_active() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_all_strips_status_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"));
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn list_filter_archived_matches_archived() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("archived"));
        assert_eq!(f.get_str("status").unwrap(), "archived");
    }

    #[test]
    fn config_from_create_defaults() {
        let user_id = ObjectId::new();
        let c = config_from_create(CreateSabbiginConfigInput::default(), user_id).unwrap();
        assert!(c.enabled);
        assert_eq!(c.pipeline_limit, DEFAULT_PIPELINE_LIMIT);
        assert_eq!(c.status, "active");
        assert!(!c.allowed_features.is_empty());
        assert!(c.pipeline_id.is_none());
        assert_eq!(c.user_id, user_id);
    }

    #[test]
    fn config_from_create_parses_pipeline_oid() {
        let user_id = ObjectId::new();
        let pipe = ObjectId::new();
        let input = CreateSabbiginConfigInput {
            pipeline_id: Some(pipe.to_hex()),
            pipeline_limit: Some(2),
            allowed_features: Some(vec!["contacts".into()]),
            enabled: Some(false),
            ..Default::default()
        };
        let c = config_from_create(input, user_id).unwrap();
        assert_eq!(c.pipeline_id, Some(pipe));
        assert_eq!(c.pipeline_limit, 2);
        assert!(!c.enabled);
        assert_eq!(c.allowed_features, vec!["contacts".to_owned()]);
    }

    #[test]
    fn config_from_create_passes_pipeline_limit_through() {
        let user_id = ObjectId::new();
        // `0` is a legitimate value now — it means "no admin override".
        let input = CreateSabbiginConfigInput {
            pipeline_limit: Some(0),
            ..Default::default()
        };
        let c = config_from_create(input, user_id).unwrap();
        assert_eq!(c.pipeline_limit, 0);
    }

    #[test]
    fn build_update_doc_clears_pipeline_on_empty_string() {
        let patch = UpdateSabbiginConfigInput {
            pipeline_id: Some(String::new()),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        assert!(set.contains_key("pipelineId"));
        assert_eq!(set.get("pipelineId").unwrap(), &Bson::Null);
    }

    #[test]
    fn build_update_doc_writes_features_array() {
        let patch = UpdateSabbiginConfigInput {
            allowed_features: Some(vec!["contacts".into(), "products".into()]),
            ..Default::default()
        };
        let d = build_update_doc(patch).unwrap();
        let set = d.get_document("$set").unwrap();
        let arr = set.get_array("allowedFeatures").unwrap();
        assert_eq!(arr.len(), 2);
    }
}
