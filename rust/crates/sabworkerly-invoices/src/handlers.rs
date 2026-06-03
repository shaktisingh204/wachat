//! HTTP handlers for SabWorkerly invoices.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
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
use crate::types::{SabworkerlyInvoice, SabworkerlyInvoiceLine};

const COLL: &str = "sabworkerly_invoices";

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyInvoice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_invoices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("all") {
        "all" => {}
        s @ ("draft" | "sent" | "paid" | "overdue") => {
            filter.insert("status", s);
        }
        _ => {}
    }
    if let Some(s) = q.client_id.as_deref() {
        if !s.is_empty() {
            filter.insert("clientId", oid_from_str(s)?);
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabworkerlyInvoice>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyInvoice> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
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

#[instrument(skip_all)]
pub async fn get_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabworkerlyInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyInvoice>(COLL);
    let row = coll
        .find_one(own(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("invoice".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateInvoiceInput>,
) -> Result<Json<CreateInvoiceResponse>> {
    let user_id = user_oid(&user)?;
    let client_oid = oid_from_str(&input.client_id)?;
    let ts_oids: Vec<ObjectId> = input
        .timesheet_ids
        .iter()
        .map(|s| oid_from_str(s))
        .collect::<Result<_>>()?;
    let lines: Vec<SabworkerlyInvoiceLine> = input
        .line_items
        .into_iter()
        .map(|l| -> Result<SabworkerlyInvoiceLine> {
            Ok(SabworkerlyInvoiceLine {
                placement_id: oid_from_str(&l.placement_id)?,
                worker_name: l.worker_name,
                hours: l.hours,
                rate: l.rate,
                amount_minor: l.amount_minor,
            })
        })
        .collect::<Result<_>>()?;

    let mut inv = SabworkerlyInvoice {
        id: None,
        user_id,
        client_id: client_oid,
        period_start: BsonDateTime::from_chrono(input.period_start),
        period_end: BsonDateTime::from_chrono(input.period_end),
        timesheet_ids: ts_oids,
        line_items: lines,
        total_minor: input.total_minor,
        currency: input.currency.unwrap_or_else(|| "USD".to_owned()),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        sent_at: None,
        paid_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyInvoice>(COLL);
    let inserted = coll
        .insert_one(&inv)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    inv.id = Some(new_id);
    Ok(Json(CreateInvoiceResponse {
        id: new_id.to_hex(),
        entity: inv,
    }))
}

#[instrument(skip_all)]
pub async fn update_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateInvoiceInput>,
) -> Result<Json<SabworkerlyInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.sent_at {
        set.insert("sentAt", BsonDateTime::from_chrono(v));
    }
    if let Some(v) = patch.paid_at {
        set.insert("paidAt", BsonDateTime::from_chrono(v));
    }
    let coll = mongo.collection::<SabworkerlyInvoice>(COLL);
    let result = coll
        .update_one(own(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("invoice".to_owned()));
    }
    let after = coll
        .find_one(own(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("invoice".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteInvoiceResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyInvoice>(COLL);
    let result = coll
        .delete_one(own(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(DeleteInvoiceResponse {
        deleted: result.deleted_count > 0,
    }))
}
