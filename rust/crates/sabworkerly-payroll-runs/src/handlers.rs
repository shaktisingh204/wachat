//! HTTP handlers for SabWorkerly payroll-runs.

use axum::{Json, extract::{Path, Query, State}};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{pagination::{clamp_limit, skip_for}, tenant::user_oid};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::*;
use crate::types::{SabworkerlyPayrollLine, SabworkerlyPayrollRun};

const COLL: &str = "sabworkerly_payroll_runs";

fn own(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabworkerlyPayrollRun>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all)]
pub async fn list_payroll_runs(
    user: AuthUser, State(mongo): State<MongoHandle>, Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    match q.status.as_deref().unwrap_or("all") {
        "all" => {}
        s @ ("draft" | "approved" | "paid") => { filter.insert("status", s); }
        _ => {}
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabworkerlyPayrollRun>(COLL);
    let cursor = coll.find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let mut rows: Vec<SabworkerlyPayrollRun> = cursor.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let has_more = rows.len() as i64 > limit;
    if has_more { rows.truncate(limit as usize); }
    Ok(Json(ListResponse { items: rows, page: q.page.unwrap_or(0), limit: limit as u32, has_more }))
}

#[instrument(skip_all)]
pub async fn get_payroll_run(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<SabworkerlyPayrollRun>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyPayrollRun>(COLL);
    let row = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("payroll-run".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all)]
pub async fn create_payroll_run(
    user: AuthUser, State(mongo): State<MongoHandle>, Json(input): Json<CreatePayrollRunInput>,
) -> Result<Json<CreatePayrollRunResponse>> {
    let user_id = user_oid(&user)?;
    let ts_oids: Vec<ObjectId> = input.timesheet_ids.iter()
        .map(|s| oid_from_str(s))
        .collect::<Result<_>>()?;
    let lines: Vec<SabworkerlyPayrollLine> = input.line_items.into_iter()
        .map(|l| -> Result<SabworkerlyPayrollLine> {
            Ok(SabworkerlyPayrollLine {
                worker_id: oid_from_str(&l.worker_id)?,
                hours: l.hours,
                rate: l.rate,
                amount_minor: l.amount_minor,
            })
        })
        .collect::<Result<_>>()?;
    let mut run = SabworkerlyPayrollRun {
        id: None,
        user_id,
        period_start: BsonDateTime::from_chrono(input.period_start),
        period_end: BsonDateTime::from_chrono(input.period_end),
        timesheet_ids: ts_oids,
        line_items: lines,
        total_minor: input.total_minor,
        currency: input.currency.unwrap_or_else(|| "USD".to_owned()),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        processed_at: None,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.collection::<SabworkerlyPayrollRun>(COLL);
    let inserted = coll.insert_one(&run).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let new_id = inserted.inserted_id.as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    run.id = Some(new_id);
    Ok(Json(CreatePayrollRunResponse { id: new_id.to_hex(), entity: run }))
}

#[instrument(skip_all)]
pub async fn update_payroll_run(
    user: AuthUser, State(mongo): State<MongoHandle>,
    Path(id): Path<String>, Json(patch): Json<UpdatePayrollRunInput>,
) -> Result<Json<SabworkerlyPayrollRun>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status { set.insert("status", v); }
    if let Some(v) = patch.processed_at { set.insert("processedAt", BsonDateTime::from_chrono(v)); }
    let coll = mongo.collection::<SabworkerlyPayrollRun>(COLL);
    let result = coll.update_one(own(user_id, oid), doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    if result.matched_count == 0 { return Err(ApiError::NotFound("payroll-run".to_owned())); }
    let after = coll.find_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?
        .ok_or_else(|| ApiError::NotFound("payroll-run".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all)]
pub async fn delete_payroll_run(
    user: AuthUser, State(mongo): State<MongoHandle>, Path(id): Path<String>,
) -> Result<Json<DeletePayrollRunResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabworkerlyPayrollRun>(COLL);
    let result = coll.delete_one(own(user_id, oid)).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(DeletePayrollRunResponse { deleted: result.deleted_count > 0 }))
}
