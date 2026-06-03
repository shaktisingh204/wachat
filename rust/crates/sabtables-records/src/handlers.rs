//! HTTP handlers for the Record entity + formula preview.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateRecordInput, CreateRecordResponse, DeleteRecordResponse, EvaluateFormulaInput,
    EvaluateFormulaResponse, ListQuery, UpdateRecordInput,
};
use crate::formula::{Value, evaluate};
use crate::types::SabtablesRecord;

const COLL: &str = "sabtables_records";
const TABLES_COLL: &str = "sabtables_tables";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn json_map_to_doc(map: &HashMap<String, serde_json::Value>) -> Result<Document> {
    let mut out = Document::new();
    for (k, v) in map.iter() {
        let bson = bson::to_bson(v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.json_to_bson"))
        })?;
        out.insert(k.clone(), bson);
    }
    Ok(out)
}

async fn bump_records_count(mongo: &MongoHandle, table_id: ObjectId, delta: i32) {
    let coll = mongo.collection::<bson::Document>(TABLES_COLL);
    let _ = coll
        .update_one(
            doc! { "_id": table_id },
            doc! { "$inc": { "recordsCount": delta } },
        )
        .await;
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesRecord>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_records(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let table_oid = oid_from_str(&q.table_id)?;
    let mut filter = doc! { "userId": user_id, "tableId": table_oid };
    match q.status.as_deref().unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabtablesRecord>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.find"))
        })?;
    let mut rows: Vec<SabtablesRecord> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn get_record(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
) -> Result<Json<SabtablesRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;
    let coll = mongo.collection::<SabtablesRecord>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_record(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRecordInput>,
) -> Result<Json<CreateRecordResponse>> {
    let user_id = user_oid(&user)?;
    let table_oid = oid_from_str(&input.table_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let fields_doc = json_map_to_doc(&input.fields_json)?;
    let mut entity = SabtablesRecord {
        id: None,
        user_id,
        table_id: table_oid,
        fields_json: fields_doc,
        created_by: Some(user_id),
        created_at: now,
        updated_by: None,
        updated_at: None,
        status: "active".to_owned(),
    };
    let coll = mongo.collection::<SabtablesRecord>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    bump_records_count(&mongo, table_oid, 1).await;
    Ok(Json(CreateRecordResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn update_record(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
    Json(patch): Json<UpdateRecordInput>,
) -> Result<Json<SabtablesRecord>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;
    let coll = mongo.collection::<SabtablesRecord>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now, "updatedBy": user_id };
    if let Some(fields) = patch.fields_json {
        // Merge cell-by-cell so callers can patch a single column.
        for (k, v) in fields.iter() {
            let bson = bson::to_bson(v).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.bson_field"))
            })?;
            set.insert(format!("fieldsJson.{}", k), bson);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("record".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %record_id))]
pub async fn delete_record(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(record_id): Path<String>,
) -> Result<Json<DeleteRecordResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&record_id)?;
    let coll = mongo.collection::<SabtablesRecord>(COLL);
    // Look up table_id first so we can decrement the counter.
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
                "updatedBy": user_id,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_records.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("record".to_owned()));
    }
    bump_records_count(&mongo, before.table_id, -1).await;
    Ok(Json(DeleteRecordResponse { deleted: true }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn evaluate_formula(
    user: AuthUser,
    Json(input): Json<EvaluateFormulaInput>,
) -> Result<Json<EvaluateFormulaResponse>> {
    let mut fields: HashMap<String, Value> = HashMap::new();
    for (k, v) in input.fields.iter() {
        fields.insert(k.clone(), Value::from_json(v));
    }
    let v = evaluate(&input.expression, &fields).map_err(|e| ApiError::Validation(e.0))?;
    Ok(Json(EvaluateFormulaResponse { value: v.to_json() }))
}

// Silence unused-import warning when Bson helpers are pulled in.
#[allow(dead_code)]
fn _bson_unused() -> Bson {
    Bson::Null
}
