//! Read-only field analytics. Aggregates over `esign_envelopes.fields`.

use axum::{Json, extract::{Query, State}};
use bson::{Document, doc};
use crm_common::tenant::user_oid;
use sabsign_envelopes::types::EsignEnvelope;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use std::collections::HashMap;
use tracing::instrument;

use crate::dto::{PerEnvelopeQuery, PerEnvelopeResponse, UsageQuery, UsageResponse};
use crate::types::{EnvelopeFieldSummary, FieldUsageBucket, VALID_FIELD_TYPES};

const COLL: &str = "esign_envelopes";

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn field_usage(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<UsageQuery>,
) -> Result<Json<UsageResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().filter(|s| !s.is_empty() && *s != "all") {
        filter.insert("status", s);
    }
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find"))
    })?;
    let rows: Vec<EsignEnvelope> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.collect"))
    })?;

    let mut by_type: HashMap<&str, (u64, u64)> = HashMap::new();
    for env in &rows {
        for f in &env.fields {
            let key = VALID_FIELD_TYPES
                .iter()
                .copied()
                .find(|t| *t == f.field_type.as_str())
                .unwrap_or("text");
            let entry = by_type.entry(key).or_insert((0, 0));
            entry.0 += 1;
            if f.value.as_deref().map(|v| !v.is_empty()).unwrap_or(false) {
                entry.1 += 1;
            }
        }
    }
    let buckets: Vec<FieldUsageBucket> = VALID_FIELD_TYPES
        .iter()
        .map(|t| {
            let (total, filled) = by_type.get(*t).copied().unwrap_or((0, 0));
            FieldUsageBucket {
                field_type: (*t).to_owned(),
                total,
                filled,
                unfilled: total.saturating_sub(filled),
            }
        })
        .collect();

    Ok(Json(UsageResponse { buckets }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn per_envelope(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<PerEnvelopeQuery>,
) -> Result<Json<PerEnvelopeResponse>> {
    let user_id = user_oid(&user)?;
    let coll = mongo.collection::<EsignEnvelope>(COLL);
    let cursor = coll
        .find(doc! { "userId": user_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.find")))?;
    let rows: Vec<EsignEnvelope> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("esign_envelopes.collect"))
    })?;
    let limit = q.limit.unwrap_or(50).min(500) as usize;

    let items: Vec<EnvelopeFieldSummary> = rows
        .into_iter()
        .take(limit)
        .map(|env| {
            let total = env.fields.len() as u64;
            let filled = env
                .fields
                .iter()
                .filter(|f| f.value.as_deref().map(|v| !v.is_empty()).unwrap_or(false))
                .count() as u64;
            EnvelopeFieldSummary {
                envelope_id: env.id.map(|o| o.to_hex()).unwrap_or_default(),
                envelope_name: env.name,
                status: format!("{:?}", env.status).to_lowercase(),
                total_fields: total,
                filled_fields: filled,
            }
        })
        .collect();

    Ok(Json(PerEnvelopeResponse { items }))
}

#[cfg(test)]
mod tests {
    use crate::types::VALID_FIELD_TYPES;
    #[test]
    fn field_catalog_has_six_types() {
        assert_eq!(VALID_FIELD_TYPES.len(), 6);
    }
}
