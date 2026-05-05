//! Transaction listing for a project.
//!
//! Mirrors the legacy `getTransactionsForProject` server action — returns
//! every `transactions` row whose `projectId` matches, sorted by
//! `createdAt` descending. We deliberately serialize to open `Value`
//! (via `document_to_clean_json`) because the `Transaction` shape on the
//! TS side has multiple optional fields tied to provider-specific flows
//! (`PLAN`, `CREDITS`, `WHATSAPP_PAY`) and grows independently of this
//! crate.

use bson::{Document, doc, oid::ObjectId};
use mongodb::Cursor;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde::Serialize;
use serde_json::Value;

const TRANSACTIONS_COLL: &str = "transactions";

/// Response body for `GET /v1/wachat/pay/projects/{id}/transactions`.
#[derive(Debug, Clone, Serialize)]
pub struct TransactionsResponse {
    pub transactions: Vec<Value>,
}

/// Find transactions for a project, sorted by `createdAt` descending.
///
/// The caller is responsible for the tenant access check (the router
/// loads the project with `load_project_for` before invoking this).
pub async fn list_for_project(
    mongo: &MongoHandle,
    project_id: &ObjectId,
) -> Result<TransactionsResponse> {
    let coll = mongo.collection::<Document>(TRANSACTIONS_COLL);
    let mut cursor: Cursor<Document> = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out: Vec<Value> = Vec::new();
    // Explicit advance avoids pulling in `futures::TryStreamExt` for one
    // call site.
    while cursor
        .advance()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        let doc = cursor
            .deserialize_current()
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        out.push(document_to_clean_json(doc));
    }

    Ok(TransactionsResponse { transactions: out })
}
