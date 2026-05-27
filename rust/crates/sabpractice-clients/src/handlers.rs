//! HTTP handlers for the SabPractice Client entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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

use crate::dto::{
    CreateClientInput, CreateClientResponse, DeleteClientResponse, ListQuery, UpdateClientInput,
};
use crate::types::SabPracticeClient;

const CLIENTS_COLL: &str = "sabpractice_clients";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    firm_id: Option<ObjectId>,
    assigned_to: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "inactive" => {
            filter.insert("status", "inactive");
        }
        "onboarding" => {
            filter.insert("status", "onboarding");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "inactive" });
        }
    }
    if let Some(f) = firm_id {
        filter.insert("firmId", f);
    }
    if let Some(uid) = assigned_to.filter(|s| !s.is_empty()) {
        filter.insert("assignedAdvisorUserIds", uid);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn client_from_create(input: CreateClientInput, user_id: ObjectId) -> Result<SabPracticeClient> {
    let firm_oid = match input.firm_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    Ok(SabPracticeClient {
        id: None,
        user_id,
        firm_id: firm_oid,
        name: input.name,
        industry: input.industry,
        fiscal_year_start: input.fiscal_year_start,
        primary_contact_name: input.primary_contact_name,
        primary_contact_email: input.primary_contact_email,
        primary_contact_phone: input.primary_contact_phone,
        address: input.address,
        tax_id: input.tax_id,
        registration_no: input.registration_no,
        website: input.website,
        timezone: input.timezone,
        currency: input.currency,
        notes: input.notes,
        status: Some(input.status.unwrap_or_else(|| "onboarding".to_owned())),
        books_link_ref: input.books_link_ref,
        assigned_advisor_user_ids: input.assigned_advisor_user_ids,
        tags: input.tags,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateClientInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.firm_id {
        if v.is_empty() {
            set.insert("firmId", Bson::Null);
        } else {
            set.insert("firmId", oid_from_str(&v)?);
        }
    }
    if let Some(v) = patch.industry {
        set.insert("industry", v);
    }
    if let Some(v) = patch.fiscal_year_start {
        set.insert("fiscalYearStart", v);
    }
    if let Some(v) = patch.primary_contact_name {
        set.insert("primaryContactName", v);
    }
    if let Some(v) = patch.primary_contact_email {
        set.insert("primaryContactEmail", v);
    }
    if let Some(v) = patch.primary_contact_phone {
        set.insert("primaryContactPhone", v);
    }
    if let Some(v) = patch.address {
        set.insert("address", v);
    }
    if let Some(v) = patch.tax_id {
        set.insert("taxId", v);
    }
    if let Some(v) = patch.registration_no {
        set.insert("registrationNo", v);
    }
    if let Some(v) = patch.website {
        set.insert("website", v);
    }
    if let Some(v) = patch.timezone {
        set.insert("timezone", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.books_link_ref {
        let bson = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("encode booksLinkRef"))
        })?;
        set.insert("booksLinkRef", bson);
    }
    if let Some(v) = patch.assigned_advisor_user_ids {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("assignedAdvisorUserIds", arr);
    }
    if let Some(v) = patch.tags {
        let arr: Vec<Bson> = v.into_iter().map(Bson::String).collect();
        set.insert("tags", arr);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabPracticeClient>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_clients(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let firm_oid = match q.firm_id.as_deref() {
        Some(s) if !s.is_empty() => Some(oid_from_str(s)?),
        _ => None,
    };
    let mut filter = list_filter(user_id, q.status.as_deref(), firm_oid, q.assigned_to.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["name", "primaryContactName", "primaryContactEmail", "industry"],
        );
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
    let coll = mongo.collection::<SabPracticeClient>(CLIENTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.find")))?;
    let mut rows: Vec<SabPracticeClient> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, client_id = %id))]
pub async fn get_client(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabPracticeClient>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeClient>(CLIENTS_COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.find_one")))?
        .ok_or_else(|| ApiError::NotFound("client".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_client(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateClientInput>,
) -> Result<Json<CreateClientResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let mut client = client_from_create(input, user_id)?;
    let coll = mongo.collection::<SabPracticeClient>(CLIENTS_COLL);
    let inserted = coll
        .insert_one(&client)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    client.id = Some(new_id);
    Ok(Json(CreateClientResponse {
        id: new_id.to_hex(),
        entity: client,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, client_id = %id))]
pub async fn update_client(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateClientInput>,
) -> Result<Json<SabPracticeClient>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeClient>(CLIENTS_COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("client".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.refetch")))?
        .ok_or_else(|| ApiError::NotFound("client".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, client_id = %id))]
pub async fn delete_client(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteClientResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabPracticeClient>(CLIENTS_COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "inactive",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabpractice_clients.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("client".to_owned()));
    }
    Ok(Json(DeleteClientResponse { deleted: true }))
}
