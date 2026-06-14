//! Inbound routing: resolve a dialed number to a tenant + voice application.
//!
//! Reads the same collections the Next.js side writes (direct Mongo):
//!   `sabcall_dids`          — provisioned numbers (carries the tenant + route)
//!   `sabcall_applications`  — the "what happens on a call" entity
//!
//! IMPORTANT: SabCall scopes every document by the `userId` field set to the
//! project's **id string** (the workspace id) — NOT a BSON ObjectId — to match
//! the Next.js direct-Mongo write path. So the tenant is treated as an opaque
//! string here.

use mongodb::bson::{doc, oid::ObjectId};
use mongodb::Database;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct DidDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    /// Project id string (the workspace tenant).
    #[serde(rename = "userId")]
    pub user_id: String,
    pub number: String,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AppDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(default)]
    pub name: String,
    /// Stored under BSON key `type` — "webhook"|"ivr"|"queue"|"dial"|"autopilot".
    #[serde(rename = "type", default)]
    pub app_type: String,
    #[serde(rename = "webhookUrl", default)]
    pub webhook_url: Option<String>,
    #[serde(rename = "dialTarget", default)]
    pub dial_target: Option<String>,
    #[serde(rename = "recordCalls", default)]
    pub record_calls: bool,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct RouteDecision {
    /// The tenant (project id string) that owns the dialed number.
    pub tenant: String,
    pub did_id: Option<ObjectId>,
    pub app: Option<AppDoc>,
}

/// Resolve the dialed number to a routing decision. Returns `None` when the
/// number is not provisioned (engine will then reject / play a notice).
pub async fn resolve(db: &Database, dialed: &str) -> Option<RouteDecision> {
    let dids = db.collection::<DidDoc>("sabcall_dids");
    let did = dids
        .find_one(doc! { "number": dialed, "status": "active" })
        .await
        .ok()
        .flatten()?;

    // Pick the tenant's first active application (string-scoped by userId).
    let app = db
        .collection::<AppDoc>("sabcall_applications")
        .find_one(doc! { "userId": &did.user_id, "status": "active" })
        .await
        .ok()
        .flatten();

    Some(RouteDecision {
        tenant: did.user_id.clone(),
        did_id: Some(did.id),
        app,
    })
}
