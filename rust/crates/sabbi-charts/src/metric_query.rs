//! MetricQuery — the semantic AST.
//!
//! A `MetricQuery` selects **measures**, **dimensions**, and **segments** *by
//! key* from a governed [`BiModel`](sabbi_semantic::BiModel). `compile_to_spec`
//! resolves those keys against the model and lowers them to a [`ChartSpec`] the
//! Mongo engine executes — so charts, the visual query builder, the AI copilot,
//! and embeds all author against the same governed surface instead of touching
//! raw collections. Compile failure is an explicit error (unknown key), never a
//! silently-wrong query.

use bson::{Bson, Document, doc, oid::ObjectId};
use sabbi_semantic::BiModel;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Deserialize;

use crate::query_exec::{ChartSpec, clamp_run_limit};

/// Resolve the tenant scope value used to query a model's TARGET collection.
/// `scope_by` selects the project (`tid`) or user (`sub`) id; `scope_string`
/// selects string vs ObjectId storage. Centralised so the MetricQuery runner
/// and the raw Query Lab scope identically (governance is never bypassed).
pub fn resolve_scope(user: &AuthUser, model: &BiModel) -> Result<Bson> {
    let id_str = if model.scope_by.as_deref() == Some("user") {
        user.user_id.clone()
    } else {
        user.tenant_id.clone()
    };
    if model.scope_string.unwrap_or(false) {
        Ok(Bson::String(id_str))
    } else {
        Ok(Bson::ObjectId(ObjectId::parse_str(&id_str).map_err(|_| {
            ApiError::Unauthorized("scope id is not a valid ObjectId".to_owned())
        })?))
    }
}

/// A raw aggregation request for the Query Lab: extra pipeline stages appended
/// after the mandatory tenant + base-filter `$match`. Write stages are rejected.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawQuery {
    pub model_id: String,
    /// User-authored aggregation stages (e.g. `[{ "$group": … }, { "$sort": … }]`).
    #[serde(default)]
    pub stages: Vec<Document>,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Stages that could mutate data or escape the tenant sandbox — never allowed
/// from the Query Lab.
const FORBIDDEN_STAGES: &[&str] = &["$out", "$merge", "$function", "$accumulator", "$where"];

/// Validate user-authored stages, rejecting any write / code-exec stage.
pub fn validate_stages(stages: &[Document]) -> Result<()> {
    for stage in stages {
        for key in stage.keys() {
            if FORBIDDEN_STAGES.contains(&key.as_str()) {
                return Err(ApiError::Validation(format!(
                    "pipeline stage '{key}' is not allowed in the Query Lab"
                )));
            }
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricQuery {
    /// Id of the `BiModel` to query.
    pub model_id: String,
    /// Measure keys defined on the model (e.g. `["revenue"]`).
    #[serde(default)]
    pub measures: Vec<String>,
    /// Dimension keys to group/break out by (e.g. `["stage"]`).
    #[serde(default)]
    pub dimensions: Vec<String>,
    /// Segment keys whose filters are ANDed in (e.g. `["won"]`).
    #[serde(default)]
    pub segments: Vec<String>,
    /// Ad-hoc `{ column, op, value }` filters layered on top of segments.
    #[serde(default)]
    pub filters: Vec<Document>,
    /// `bar` | `line` | `pie` | `table` | `kpi` — defaults to `table`.
    #[serde(default)]
    pub chart_type: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Lower a `MetricQuery` against its model into an executable [`ChartSpec`].
///
/// `scope_value` is the resolved tenant key the engine filters `scope_field`
/// by — a `Bson::ObjectId` or `Bson::String` depending on the collection
/// (the handler computes it from the model's `scope_by` / `scope_string`).
pub fn compile_to_spec(model: &BiModel, mq: &MetricQuery, scope_value: Bson) -> Result<ChartSpec> {
    // Resolve dimension keys → source columns.
    let mut dim_cols: Vec<Bson> = Vec::with_capacity(mq.dimensions.len());
    for key in &mq.dimensions {
        let dim = model
            .dimensions
            .iter()
            .find(|d| &d.key == key)
            .ok_or_else(|| ApiError::Validation(format!("unknown dimension '{key}'")))?;
        dim_cols.push(Bson::String(dim.column.clone()));
    }

    // Resolve measure keys → { column, agg, alias }. `count` needs no real
    // column (the engine emits `$sum: 1`), but the config parser requires the
    // field, so we pass a harmless placeholder.
    let mut measure_docs: Vec<Document> = Vec::with_capacity(mq.measures.len());
    for key in &mq.measures {
        let m = model
            .measures
            .iter()
            .find(|m| &m.key == key)
            .ok_or_else(|| ApiError::Validation(format!("unknown measure '{key}'")))?;
        let column = match (&m.column, m.agg.as_str()) {
            (Some(col), _) => col.clone(),
            (None, "count") => "_id".to_owned(),
            (None, other) => {
                return Err(ApiError::Validation(format!(
                    "measure '{key}' needs a column for agg '{other}'"
                )));
            }
        };
        measure_docs.push(doc! {
            "column": column,
            "agg": m.agg.clone(),
            "alias": m.key.clone(),
        });
    }

    // Segment keys → their filter clauses, layered onto the ad-hoc filters.
    let mut filters: Vec<Document> = mq.filters.clone();
    for key in &mq.segments {
        let seg = model
            .segments
            .iter()
            .find(|s| &s.key == key)
            .ok_or_else(|| ApiError::Validation(format!("unknown segment '{key}'")))?;
        filters.extend(seg.filters.iter().cloned());
    }

    let config = doc! {
        "dimensions": dim_cols,
        "measures": measure_docs,
    };

    Ok(ChartSpec {
        scope_value,
        scope_field: model
            .scope_field
            .clone()
            .unwrap_or_else(|| "userId".to_owned()),
        chart_type: mq
            .chart_type
            .clone()
            .unwrap_or_else(|| "table".to_owned()),
        collection_name: model.collection.clone(),
        config,
        filters,
        extra_filters: vec![],
        base_filter: model.base_filter.clone().unwrap_or_default(),
        limit: clamp_run_limit(mq.limit),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sabbi_semantic::{Dimension, Measure, Segment};

    fn sample_model() -> BiModel {
        BiModel {
            id: None,
            user_id: ObjectId::new(),
            name: "Pipeline".into(),
            description: None,
            collection: "sabcrm_records".into(),
            base_filter: Some(doc! { "object": "leads" }),
            scope_field: Some("projectId".into()),
            scope_by: Some("project".into()),
            measures: vec![Measure {
                key: "revenue".into(),
                label: "Revenue".into(),
                agg: "sum".into(),
                column: Some("data.amount".into()),
                format: Some("currency".into()),
                down_is_good: None,
            }],
            dimensions: vec![Dimension {
                key: "stage".into(),
                label: "Stage".into(),
                column: "data.stage".into(),
                kind: "string".into(),
                time_grain: None,
            }],
            joins: vec![],
            segments: vec![Segment {
                key: "won".into(),
                label: "Won".into(),
                filters: vec![doc! { "column": "data.status", "op": "eq", "value": "won" }],
            }],
            source: "connector".into(),
            connector: Some("crm".into()),
            status: "active".into(),
            created_at: bson::DateTime::now(),
            updated_at: None,
        }
    }

    #[test]
    fn compiles_measure_dimension_segment() {
        let model = sample_model();
        let uid = ObjectId::new();
        let mq = MetricQuery {
            model_id: ObjectId::new().to_hex(),
            measures: vec!["revenue".into()],
            dimensions: vec!["stage".into()],
            segments: vec!["won".into()],
            chart_type: Some("bar".into()),
            ..Default::default()
        };
        let spec = compile_to_spec(&model, &mq, Bson::ObjectId(uid)).unwrap();
        assert_eq!(spec.collection_name, "sabcrm_records");
        assert_eq!(spec.chart_type, "bar");
        assert!(!spec.base_filter.is_empty());
        assert_eq!(spec.filters.len(), 1); // the resolved segment filter
    }

    #[test]
    fn rejects_unknown_keys() {
        let model = sample_model();
        let uid = ObjectId::new();
        let mq = MetricQuery {
            model_id: ObjectId::new().to_hex(),
            measures: vec!["nope".into()],
            ..Default::default()
        };
        assert!(compile_to_spec(&model, &mq, Bson::ObjectId(uid)).is_err());
    }
}
