//! HTTP handlers for the SabBI Chart entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateChartInput, CreateChartResponse, DeleteChartResponse, ListQuery, RunChartInput,
    RunChartResponse, UpdateChartInput,
};
use crate::query_exec::{ChartSpec, clamp_run_limit, run_chart};
use crate::types::BiChart;

pub(crate) const COLL: &str = "sabbi_charts";
const DATASETS_COLL: &str = "sabbi_datasets";

fn validate_chart_type(t: &str) -> Result<()> {
    match t {
        "bar" | "line" | "pie" | "table" | "kpi" | "map" | "heatmap" => Ok(()),
        other => Err(ApiError::Validation(format!(
            "unsupported chart type '{other}'"
        ))),
    }
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    workbook_id: Option<&str>,
    dataset_id: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(s) = workbook_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("workbookId", s);
    }
    if let Some(s) = dataset_id.and_then(|s| ObjectId::parse_str(s).ok()) {
        filter.insert("datasetId", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn chart_from_create(input: CreateChartInput, user_id: ObjectId) -> Result<BiChart> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    validate_chart_type(&input.chart_type)?;
    let workbook_id = ObjectId::parse_str(&input.workbook_id)
        .map_err(|_| ApiError::Validation("workbookId is not a valid ObjectId".to_owned()))?;
    let dataset_id = ObjectId::parse_str(&input.dataset_id)
        .map_err(|_| ApiError::Validation("datasetId is not a valid ObjectId".to_owned()))?;
    Ok(BiChart {
        id: None,
        user_id,
        workbook_id,
        dataset_id,
        name: input.name.trim().to_owned(),
        chart_type: input.chart_type,
        config_json: input.config_json.unwrap_or_default(),
        filters_json: input.filters_json,
        drilldown_json: input.drilldown_json,
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateChartInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty()) {
        set.insert("name", v);
    }
    if let Some(v) = patch.dataset_id.as_deref().and_then(|s| ObjectId::parse_str(s).ok()) {
        set.insert("datasetId", v);
    }
    if let Some(v) = patch.chart_type {
        validate_chart_type(&v)?;
        set.insert("type", v);
    }
    if let Some(v) = patch.config_json {
        set.insert("configJson", v);
    }
    if let Some(v) = patch.filters_json {
        set.insert("filtersJson", v);
    }
    if let Some(v) = patch.drilldown_json {
        set.insert("drilldownJson", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BiChart>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_charts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.workbook_id.as_deref(),
        q.dataset_id.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
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
    let coll = mongo.collection::<BiChart>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.find")))?;
    let mut rows: Vec<BiChart> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %chart_id))]
pub async fn get_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
) -> Result<Json<BiChart>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let coll = mongo.collection::<BiChart>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("chart".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateChartInput>,
) -> Result<Json<CreateChartResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = chart_from_create(input, user_id)?;
    let coll = mongo.collection::<BiChart>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateChartResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %chart_id))]
pub async fn update_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
    Json(patch): Json<UpdateChartInput>,
) -> Result<Json<BiChart>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let coll = mongo.collection::<BiChart>(COLL);
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("chart".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("chart".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %chart_id))]
pub async fn delete_chart(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
) -> Result<Json<DeleteChartResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let coll = mongo.collection::<BiChart>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("chart".to_owned()));
    }
    Ok(Json(DeleteChartResponse { deleted: true }))
}

/// Execute a chart — run aggregation against the underlying dataset and
/// return shaped rows. The renderer maps `RunChartResponse.rows` directly
/// onto ZoruUI's recharts wrappers.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %chart_id))]
pub async fn run_chart_handler(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(chart_id): Path<String>,
    Json(input): Json<RunChartInput>,
) -> Result<Json<RunChartResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&chart_id)?;
    let coll = mongo.collection::<BiChart>(COLL);
    let chart = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("chart".to_owned()))?;

    // Resolve dataset → collection.
    let datasets = mongo.collection::<Document>(DATASETS_COLL);
    let dataset = datasets
        .find_one(doc! { "_id": chart.dataset_id, "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.dataset.find")))?
        .ok_or_else(|| ApiError::NotFound("dataset".to_owned()))?;
    let source = dataset.get_str("source").unwrap_or("");
    if source != "mongo_collection" {
        // TODO: CSV / REST execution path. For now signal unsupported so
        // the renderer can show a "rebuild your dataset as mongo_collection"
        // hint.
        return Ok(Json(RunChartResponse {
            rows: vec![],
            columns: vec![],
            mode: "unsupported".to_owned(),
        }));
    }
    let coll_name = dataset
        .get_str("collectionName")
        .map_err(|_| ApiError::Validation("dataset.collectionName missing".to_owned()))?
        .to_owned();

    let spec = ChartSpec {
        user_id,
        chart_type: chart.chart_type.clone(),
        collection_name: coll_name,
        config: chart.config_json.clone(),
        filters: chart.filters_json.clone(),
        extra_filters: input.extra_filters,
        limit: clamp_run_limit(input.limit),
    };

    let result = run_chart(&mongo, spec).await?;
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_chart_type_accepts_supported() {
        for t in ["bar", "line", "pie", "table", "kpi", "map", "heatmap"] {
            assert!(validate_chart_type(t).is_ok());
        }
        assert!(validate_chart_type("waterfall").is_err());
    }
}
