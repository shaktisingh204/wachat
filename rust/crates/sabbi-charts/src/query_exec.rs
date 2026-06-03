//! Query execution for BI charts.
//!
//! Implements bar/line/pie/table/kpi fully against Mongo-collection-backed
//! datasets using the aggregation pipeline. map/heatmap return raw rows
//! and let the renderer handle the rest (TODO: dedicated geo / matrix
//! aggregators).
//!
//! CSV-upload and REST-API datasets are **not** executed here yet — the
//! query exec layer must first fetch / parse / cache rows. Until that's
//! wired, `run_chart` returns `mode = "unsupported"` for those sources.

use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::AggregateOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::dto::{ChartColumn, RunChartResponse};

const RUN_DEFAULT_LIMIT: u32 = 1000;
const RUN_MAX_LIMIT: u32 = 5000;

#[derive(Debug, Clone)]
pub struct ChartSpec {
    pub user_id: ObjectId,
    pub chart_type: String,
    pub collection_name: String,
    pub config: Document,
    pub filters: Vec<Document>,
    pub extra_filters: Vec<Document>,
    pub limit: u32,
}

pub fn clamp_run_limit(input: Option<u32>) -> u32 {
    let v = input.unwrap_or(RUN_DEFAULT_LIMIT);
    v.clamp(1, RUN_MAX_LIMIT)
}

/// Translate `{ column, op, value }` filter docs into a `$match` clause.
/// Supported ops: `eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`,
/// `contains`. Unknown ops are dropped silently — the editor validates.
fn filters_to_match(user_id: ObjectId, filters: &[Document]) -> Document {
    let mut and: Vec<Document> = vec![doc! { "userId": user_id }];
    for f in filters {
        let col = match f.get_str("column") {
            Ok(s) if !s.is_empty() => s,
            _ => continue,
        };
        let op = f.get_str("op").unwrap_or("eq");
        let value = f.get("value").cloned().unwrap_or(Bson::Null);
        let clause = match op {
            "eq" => doc! { col: { "$eq": value } },
            "ne" => doc! { col: { "$ne": value } },
            "in" => doc! { col: { "$in": value } },
            "nin" => doc! { col: { "$nin": value } },
            "gt" => doc! { col: { "$gt": value } },
            "gte" => doc! { col: { "$gte": value } },
            "lt" => doc! { col: { "$lt": value } },
            "lte" => doc! { col: { "$lte": value } },
            "contains" => {
                let s = value.as_str().unwrap_or("").to_owned();
                doc! { col: { "$regex": s, "$options": "i" } }
            }
            _ => continue,
        };
        and.push(clause);
    }
    if and.len() == 1 {
        and.into_iter().next().unwrap()
    } else {
        doc! { "$and": and }
    }
}

fn dimensions(config: &Document) -> Vec<String> {
    config
        .get_array("dimensions")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone)]
struct Measure {
    column: String,
    agg: String,
    /// Output key, defaults to `<agg>_<column>`.
    alias: String,
}

fn measures(config: &Document) -> Vec<Measure> {
    let Ok(arr) = config.get_array("measures") else {
        return vec![];
    };
    arr.iter()
        .filter_map(|b| b.as_document())
        .filter_map(|d| {
            let column = d.get_str("column").ok()?.to_owned();
            let agg = d.get_str("agg").unwrap_or("sum").to_owned();
            let alias = d
                .get_str("alias")
                .ok()
                .map(str::to_owned)
                .unwrap_or_else(|| format!("{agg}_{column}"));
            Some(Measure { column, agg, alias })
        })
        .collect()
}

/// Map a measure to its `$group` accumulator clause.
fn measure_accumulator(m: &Measure) -> Document {
    let field = format!("${}", m.column);
    match m.agg.as_str() {
        "count" => doc! { "$sum": 1 },
        "avg" => doc! { "$avg": field },
        "min" => doc! { "$min": field },
        "max" => doc! { "$max": field },
        _ => doc! { "$sum": field }, // default sum
    }
}

/// Build the aggregation pipeline for an aggregated chart (bar/line/pie/kpi).
fn build_agg_pipeline(spec: &ChartSpec, dims: &[String], meas: &[Measure]) -> Vec<Document> {
    let mut all_filters: Vec<Document> = spec.filters.clone();
    all_filters.extend(spec.extra_filters.iter().cloned());
    let match_doc = filters_to_match(spec.user_id, &all_filters);

    let mut group_id = Document::new();
    for d in dims {
        group_id.insert(d.clone(), format!("${d}"));
    }

    let mut group =
        doc! { "_id": if dims.is_empty() { Bson::Null } else { Bson::Document(group_id) } };
    for m in meas {
        group.insert(m.alias.clone(), measure_accumulator(m));
    }

    // Project: flatten `_id.<dim>` back to top-level `<dim>`, drop `_id`.
    let mut project = doc! { "_id": 0 };
    for d in dims {
        project.insert(d.clone(), format!("$_id.{d}"));
    }
    for m in meas {
        project.insert(m.alias.clone(), 1);
    }

    let mut sort = Document::new();
    if let Some(first) = meas.first() {
        sort.insert(first.alias.clone(), -1);
    } else if let Some(first) = dims.first() {
        sort.insert(first.clone(), 1);
    }

    let mut pipeline = vec![
        doc! { "$match": match_doc },
        doc! { "$group": group },
        doc! { "$project": project },
    ];
    if !sort.is_empty() {
        pipeline.push(doc! { "$sort": sort });
    }
    pipeline.push(doc! { "$limit": spec.limit as i64 });
    pipeline
}

/// Build the table pipeline — no aggregation, just project + filter +
/// limit. If the config carries `selectColumns`, those are projected;
/// otherwise the whole document goes through (minus `_id` / `userId`).
fn build_table_pipeline(spec: &ChartSpec) -> Vec<Document> {
    let mut all_filters = spec.filters.clone();
    all_filters.extend(spec.extra_filters.iter().cloned());
    let match_doc = filters_to_match(spec.user_id, &all_filters);

    let mut pipeline = vec![doc! { "$match": match_doc }];
    if let Ok(cols) = spec.config.get_array("selectColumns") {
        let mut project = doc! { "_id": 0, "userId": 0 };
        for c in cols.iter().filter_map(|b| b.as_str()) {
            project.insert(c, 1);
        }
        pipeline.push(doc! { "$project": project });
    } else {
        pipeline.push(doc! { "$project": { "_id": 0, "userId": 0 } });
    }
    pipeline.push(doc! { "$limit": spec.limit as i64 });
    pipeline
}

fn build_columns(chart_type: &str, dims: &[String], meas: &[Measure]) -> Vec<ChartColumn> {
    let mut out = Vec::with_capacity(dims.len() + meas.len());
    for d in dims {
        out.push(ChartColumn {
            key: d.clone(),
            role: "dimension".to_owned(),
            kind: None,
        });
    }
    for m in meas {
        out.push(ChartColumn {
            key: m.alias.clone(),
            role: "measure".to_owned(),
            kind: Some("number".to_owned()),
        });
    }
    if chart_type == "table" {
        // No structured columns until we infer from first row downstream.
        return vec![];
    }
    out
}

pub async fn run_chart(mongo: &MongoHandle, spec: ChartSpec) -> Result<RunChartResponse> {
    let dims = dimensions(&spec.config);
    let meas = measures(&spec.config);

    let (pipeline, mode) = match spec.chart_type.as_str() {
        "bar" | "line" | "pie" | "kpi" => (build_agg_pipeline(&spec, &dims, &meas), "renderable"),
        "table" => (build_table_pipeline(&spec), "renderable"),
        "map" | "heatmap" => {
            // TODO: dedicated geo / matrix aggregators. For now we return raw
            // (filtered, projected) rows so the renderer can compute its own
            // layout.
            (build_table_pipeline(&spec), "raw")
        }
        _ => {
            return Ok(RunChartResponse {
                rows: vec![],
                columns: vec![],
                mode: "unsupported".to_owned(),
            });
        }
    };

    let coll = mongo.collection::<Document>(&spec.collection_name);
    let opts = AggregateOptions::builder().allow_disk_use(true).build();
    let cursor = coll
        .aggregate(pipeline)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.run.aggregate"))
        })?;
    let rows: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbi_charts.run.collect"))
    })?;

    let columns = build_columns(&spec.chart_type, &dims, &meas);

    Ok(RunChartResponse {
        rows,
        columns,
        mode: mode.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_to_match_handles_known_ops() {
        let uid = ObjectId::new();
        let filters = vec![
            doc! { "column": "country", "op": "eq", "value": "IN" },
            doc! { "column": "amount", "op": "gt", "value": 100 },
            doc! { "column": "name", "op": "contains", "value": "acme" },
        ];
        let m = filters_to_match(uid, &filters);
        assert!(m.contains_key("$and"));
    }

    #[test]
    fn clamp_run_limit_bounds_input() {
        assert_eq!(clamp_run_limit(None), RUN_DEFAULT_LIMIT);
        assert_eq!(clamp_run_limit(Some(0)), 1);
        assert_eq!(clamp_run_limit(Some(99_999)), RUN_MAX_LIMIT);
    }

    #[test]
    fn bar_pipeline_has_group_and_project() {
        let spec = ChartSpec {
            user_id: ObjectId::new(),
            chart_type: "bar".into(),
            collection_name: "sales".into(),
            config: doc! {
                "dimensions": ["region"],
                "measures": [{ "column": "amount", "agg": "sum" }],
            },
            filters: vec![],
            extra_filters: vec![],
            limit: 100,
        };
        let dims = dimensions(&spec.config);
        let meas = measures(&spec.config);
        let pipeline = build_agg_pipeline(&spec, &dims, &meas);
        assert!(pipeline.iter().any(|d| d.contains_key("$group")));
        assert!(pipeline.iter().any(|d| d.contains_key("$project")));
    }
}
