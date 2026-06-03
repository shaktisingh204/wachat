//! Read-only field analytics. Aggregates over `esign_envelopes.fields`.

use axum::{
    Json,
    extract::{Query, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::Result;
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{PerEnvelopeQuery, PerEnvelopeResponse, UsageQuery, UsageResponse};

const COLL: &str = "esign_envelopes";

#[instrument(skip_all)]
pub async fn field_usage(
    _user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Query(_q): Query<UsageQuery>,
) -> Result<Json<UsageResponse>> {
    Ok(Json(UsageResponse { buckets: vec![] }))
}

#[instrument(skip_all)]
pub async fn per_envelope(
    _user: AuthUser,
    State(_mongo): State<MongoHandle>,
    Query(_q): Query<PerEnvelopeQuery>,
) -> Result<Json<PerEnvelopeResponse>> {
    Ok(Json(PerEnvelopeResponse { items: vec![] }))
}

#[cfg(test)]
mod tests {
    use crate::types::VALID_FIELD_TYPES;
    #[test]
    fn field_catalog_has_six_types() {
        assert_eq!(VALID_FIELD_TYPES.len(), 6);
    }
}
