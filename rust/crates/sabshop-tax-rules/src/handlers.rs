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

use crate::dto::*;
use crate::types::SabshopTaxRule;

const COLL: &str = "sabshop_tax_rules";
const ENTITY_KIND: &str = "sabshop_tax_rule";

fn ownership(uid: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": uid }
}

fn ids_to_bson(ids: Vec<String>) -> Vec<Bson> {
    ids.into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok().map(Bson::ObjectId))
        .collect()
}

fn entity_from_create(input: CreateTaxRuleInput, uid: ObjectId) -> Result<SabshopTaxRule> {
    let sf = ObjectId::parse_str(&input.storefront_id)
        .map_err(|_| ApiError::Validation("storefrontId invalid".into()))?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    if input.region.trim().is_empty() {
        return Err(ApiError::Validation("region is required".into()));
    }
    if input.rate < 0.0 || input.rate > 1.5 {
        return Err(ApiError::Validation(
            "rate must be between 0 and 1.5".into(),
        ));
    }
    Ok(SabshopTaxRule {
        id: None,
        user_id: uid,
        storefront_id: sf,
        name: input.name.trim().into(),
        region: input.region.trim().to_uppercase(),
        rate: input.rate,
        inclusive: input.inclusive.unwrap_or(false),
        product_category_ids: input
            .product_category_ids
            .into_iter()
            .filter_map(|s| ObjectId::parse_str(&s).ok())
            .collect(),
        active: input.active.unwrap_or(true),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(p: UpdateTaxRuleInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = p.name {
        set.insert("name", v);
    }
    if let Some(v) = p.region {
        set.insert("region", v.trim().to_uppercase());
    }
    if let Some(v) = p.rate {
        set.insert("rate", v);
    }
    if let Some(v) = p.inclusive {
        set.insert("inclusive", v);
    }
    if let Some(v) = p.product_category_ids {
        set.insert("productCategoryIds", ids_to_bson(v));
    }
    if let Some(v) = p.active {
        set.insert("active", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopTaxRule) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopTaxRule>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rules(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let uid = user_oid(&user)?;
    let mut filter = doc! { "userId": uid };
    if let Some(sf) = q
        .storefront_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("storefrontId", sf);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabshopTaxRule>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.find"))
        })?;
    let mut rows: Vec<SabshopTaxRule> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabshopTaxRule>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopTaxRule>(COLL);
    let row = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("tax rule".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTaxRuleInput>,
) -> Result<Json<CreateTaxRuleResponse>> {
    let uid = user_oid(&user)?;
    let mut entity = entity_from_create(input, uid)?;
    let coll = mongo.collection::<SabshopTaxRule>(COLL);
    let ins = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.insert"))
    })?;
    let nid = ins
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(nid);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, nid, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateTaxRuleResponse {
        id: nid.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateTaxRuleInput>,
) -> Result<Json<SabshopTaxRule>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopTaxRule>(COLL);
    let before = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("tax rule".into()))?;
    let upd = build_update_doc(patch);
    let r = coll
        .update_one(ownership(uid, oid), upd)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.update"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("tax rule".into()));
    }
    let after = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("tax rule".into()))?;
    if let Some(ev) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteTaxRuleResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopTaxRule>(COLL);
    let r = coll.delete_one(ownership(uid, oid)).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_tax_rules.delete"))
    })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("tax rule".into()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteTaxRuleResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_bad_rate() {
        let u = ObjectId::new();
        let sf = ObjectId::new().to_hex();
        assert!(
            entity_from_create(
                CreateTaxRuleInput {
                    storefront_id: sf,
                    name: "GST".into(),
                    region: "IN".into(),
                    rate: 2.0,
                    ..Default::default()
                },
                u
            )
            .is_err()
        );
    }
}
