use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabshopCollection;

const COLL: &str = "sabshop_collections";
const ENTITY_KIND: &str = "sabshop_collection";

fn ownership(uid: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": uid }
}

fn ids_to_bson(ids: Vec<String>) -> Vec<Bson> {
    ids.into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok().map(Bson::ObjectId))
        .collect()
}

fn entity_from_create(input: CreateCollectionInput, uid: ObjectId) -> Result<SabshopCollection> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".into()));
    }
    let sf = ObjectId::parse_str(&input.storefront_id)
        .map_err(|_| ApiError::Validation("storefrontId invalid".into()))?;
    Ok(SabshopCollection {
        id: None,
        user_id: uid,
        storefront_id: sf,
        name: input.name.trim().into(),
        slug: input.slug.trim().to_lowercase(),
        description: input.description,
        image_url: input.image_url,
        product_ids: input
            .product_ids
            .into_iter()
            .filter_map(|s| ObjectId::parse_str(&s).ok())
            .collect(),
        rules: input.rules.and_then(|v| bson::to_bson(&v).ok()),
        published: input.published.unwrap_or(false),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(p: UpdateCollectionInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = p.name {
        set.insert("name", v);
    }
    if let Some(v) = p.slug {
        set.insert("slug", v.trim().to_lowercase());
    }
    if let Some(v) = p.description {
        set.insert("description", v);
    }
    if let Some(v) = p.image_url {
        set.insert("imageUrl", v);
    }
    if let Some(v) = p.product_ids {
        set.insert("productIds", ids_to_bson(v));
    }
    if let Some(v) = p.rules {
        if let Ok(b) = bson::to_bson(&v) {
            set.insert("rules", b);
        }
    }
    if let Some(v) = p.published {
        set.insert("published", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(e: &SabshopCollection) -> Document {
    bson::to_document(e).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabshopCollection>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_collections(
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
    if let Some(n) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(n, &["name", "slug", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabshopCollection>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.find"))
    })?;
    let mut rows: Vec<SabshopCollection> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.collect"))
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
pub async fn get_collection(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabshopCollection>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCollection>(COLL);
    let row = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("collection".into()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_collection(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCollectionInput>,
) -> Result<Json<CreateCollectionResponse>> {
    let uid = user_oid(&user)?;
    let mut entity = entity_from_create(input, uid)?;
    let coll = mongo.collection::<SabshopCollection>(COLL);
    let ins = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.insert"))
    })?;
    let nid = ins
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(nid);
    if let Some(ev) = audit_for_create(&user, ENTITY_KIND, nid, Some(doc_for_audit(&entity))) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(CreateCollectionResponse {
        id: nid.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn update_collection(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateCollectionInput>,
) -> Result<Json<SabshopCollection>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCollection>(COLL);
    let before = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("collection".into()))?;
    let upd = build_update_doc(patch);
    let r = coll
        .update_one(ownership(uid, oid), upd)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.update"))
        })?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("collection".into()));
    }
    let after = coll
        .find_one(ownership(uid, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("collection".into()))?;
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
pub async fn delete_collection(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteCollectionResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabshopCollection>(COLL);
    let r = coll.delete_one(ownership(uid, oid)).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabshop_collections.delete"))
    })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("collection".into()));
    }
    if let Some(ev) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, ev).await;
    }
    Ok(Json(DeleteCollectionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_empty_name() {
        let u = ObjectId::new();
        let sf = ObjectId::new().to_hex();
        assert!(
            entity_from_create(
                CreateCollectionInput {
                    storefront_id: sf,
                    name: " ".into(),
                    slug: "x".into(),
                    ..Default::default()
                },
                u
            )
            .is_err()
        );
    }
}
