//! HTTP handlers for SabWorkerly clients.

use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use crm_common::{pagination::{clamp_limit, skip_for}, search::build_q_filter, tenant::user_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::SabworkerlyClient;

const COLL: &str = "sabworkerly_clients";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        s @ ("active" | "inactive") => { filter.insert("status", s); }
        _ => { filter.insert("status", doc! { "$ne": "inactive" }); }
    }
    filter
}

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyClient>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_clients(
    user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "contactName", "contactEmail"]);
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
    let coll = mongo.collection::<SabworkerlyClient>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyClient> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_client(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyClient>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyClient>(COLL);
    let row = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("client".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_client(
    user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreateClientInput>,
) -> Result<Json<CreateClientResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut client = SabworkerlyClient {
        id: None,
        user_id,
        name: input.name,
        contact_name: input.contact_name,
        contact_email: input.contact_email,
        contact_phone: input.contact_phone,
        billing_address_json: input.billing_address_json,
        payment_terms_days: input.payment_terms_days.unwrap_or(30),
        status: input.status.unwrap_or_else(|| "active".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyClient>(COLL);
    let inserted = coll.insert_one(&client).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    client.id = Some(new_id);
    Ok(Json(CreateClientResponse { id: new_id.to_hex(), entity: client }))
}

#[instrument(skip_all)]
pub async fn update_client(
    user: AuthUser, State(mongo): State<MongoHandle>,
    Path(id): Path<String>, Json(patch): Json<UpdateClientInput>,
) -> Result<Json<SabworkerlyClient>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name { set.insert("name", v); }
    if let Some(v) = patch.contact_name { set.insert("contactName", v); }
    if let Some(v) = patch.contact_email { set.insert("contactEmail", v); }
    if let Some(v) = patch.contact_phone { set.insert("contactPhone", v); }
    if let Some(v) = patch.billing_address_json {
        let b = to_bson(&v).map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
        set.insert("billingAddressJson", b);
    }
    if let Some(v) = patch.payment_terms_days { set.insert("paymentTermsDays", v as i64); }
    if let Some(v) = patch.status { set.insert("status", v); }
    let coll = mongo.collection::<SabworkerlyClient>(COLL);
    let result = coll.update_one(own(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("client".to_owned())); }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("client".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_client(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<DeleteClientResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyClient>(COLL);
    let result = coll.update_one(own(user_id, oid),
        doc! { "$set": { "status": "inactive", "updatedAt": BsonDateTime::from_chrono(Utc::now()) } }
    ).await.map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("client".to_owned())); }
    Ok(Json(DeleteClientResponse { deleted: true }))
}
