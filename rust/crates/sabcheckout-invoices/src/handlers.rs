//! HTTP handlers for SabCheckout invoices.

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

use crate::dto::{
    CreateInvoiceInput, CreateInvoiceResponse, ListQuery, MarkPaidInput,
};
use crate::types::SabcheckoutInvoice;

const COLL: &str = "sabcheckout_invoices";

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = chrono::DateTime::parse_from_rfc3339(s)
        .map_err(|e| ApiError::Validation(format!("invalid date: {e}")))?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcheckoutInvoice>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_invoices(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", s);
    }
    if let Some(s) = q.subscription_id.as_deref() {
        if let Ok(oid) = oid_from_str(s) {
            filter.insert("subscriptionId", oid);
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabcheckoutInvoice>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.find"))
        })?;
    let mut rows: Vec<SabcheckoutInvoice> = cursor
        .try_collect()
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, invoice_id = %invoice_id))]
pub async fn get_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(invoice_id): Path<String>,
) -> Result<Json<SabcheckoutInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&invoice_id)?;
    let coll = mongo.collection::<SabcheckoutInvoice>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_invoice".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_invoice(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateInvoiceInput>,
) -> Result<Json<CreateInvoiceResponse>> {
    let user_id = user_oid(&user)?;
    let sub_id = oid_from_str(&input.subscription_id)?;
    let start = parse_iso(&input.period_start)?;
    let end = parse_iso(&input.period_end)?;
    if input.amount_minor < 0 {
        return Err(ApiError::Validation(
            "amountMinor must be >= 0".to_owned(),
        ));
    }

    let mut entity = SabcheckoutInvoice {
        id: None,
        user_id,
        subscription_id: sub_id,
        period_start: start,
        period_end: end,
        amount_minor: input.amount_minor,
        currency: input.currency.unwrap_or_else(|| "INR".to_owned()),
        status: input.status.unwrap_or_else(|| "open".to_owned()),
        paid_at: None,
        payment_ref: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };

    let coll = mongo.collection::<SabcheckoutInvoice>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateInvoiceResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, invoice_id = %invoice_id))]
pub async fn mark_paid(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(invoice_id): Path<String>,
    Json(input): Json<MarkPaidInput>,
) -> Result<Json<SabcheckoutInvoice>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&invoice_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());

    let mut set: Document = doc! {
        "status": "paid",
        "paidAt": now,
        "updatedAt": now,
    };
    if let Some(p) = input.payment_ref {
        set.insert("paymentRef", p);
    }
    let coll = mongo.collection::<SabcheckoutInvoice>(COLL);
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.mark_paid"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabcheckout_invoice".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcheckout_invoices.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabcheckout_invoice".to_owned()))?;
    Ok(Json(after))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_iso_rejects_garbage() {
        assert!(parse_iso("not-a-date").is_err());
    }
}
