use anyhow::Result;
use bson::{doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use sabnode_db::mongo::MongoHandle;
use uuid::Uuid;

use crate::dto::{WebhookRegistration, WebhookRegistrationDoc};

pub const WEBHOOKS_COLLECTION: &str = "sabflow_webhooks";
pub const FLOWS_COLLECTION: &str = "sabflows";
pub const EXECUTIONS_COLLECTION: &str = "sabflow_executions";

pub struct WebhookStore {
    mongo: MongoHandle,
}

impl WebhookStore {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    fn col_webhooks(&self) -> Collection<WebhookRegistrationDoc> {
        self.mongo.collection(WEBHOOKS_COLLECTION)
    }

    fn col_flows(&self) -> Collection<bson::Document> {
        self.mongo.collection(FLOWS_COLLECTION)
    }

    fn col_executions(&self) -> Collection<bson::Document> {
        self.mongo.collection(EXECUTIONS_COLLECTION)
    }

    /// Look up a webhook registration by its public ID.
    pub async fn find_by_webhook_id(
        &self,
        webhook_id: &str,
    ) -> Result<Option<WebhookRegistrationDoc>> {
        Ok(self
            .col_webhooks()
            .find_one(doc! { "webhookId": webhook_id })
            .await?)
    }

    /// Fetch the flow snapshot (full document) for enqueueing.
    pub async fn fetch_flow_snapshot(
        &self,
        flow_id: &str,
        user_id: &str,
    ) -> Result<Option<serde_json::Value>> {
        let filter = if let Ok(oid) = ObjectId::parse_str(flow_id) {
            doc! { "_id": oid, "userId": user_id }
        } else {
            doc! { "userId": user_id }
        };
        if let Some(doc) = self.col_flows().find_one(filter).await? {
            Ok(Some(serde_json::to_value(doc)?))
        } else {
            Ok(None)
        }
    }

    /// Insert a new queued execution record; returns the generated execution_id.
    pub async fn insert_execution(
        &self,
        flow_id: &str,
        user_id: &str,
        trigger_data: Option<serde_json::Value>,
    ) -> Result<String> {
        let execution_id = Uuid::new_v4().to_string();
        let now = bson::DateTime::now();

        let doc = doc! {
            "executionId":  &execution_id,
            "flowId":       flow_id,
            "projectId":    user_id,
            "status":       "queued",
            "triggerMode":  "webhook",
            "startedAt":    bson::Bson::Null,
            "finishedAt":   bson::Bson::Null,
            "durationMs":   bson::Bson::Null,
            "error":        bson::Bson::Null,
            "createdAt":    now,
            "updatedAt":    now,
            "triggerData":  trigger_data
                .map(|v| bson::to_bson(&v).unwrap_or(bson::Bson::Null))
                .unwrap_or(bson::Bson::Null),
        };

        self.col_executions().insert_one(doc).await?;
        Ok(execution_id)
    }

    /// Upsert a webhook registration.  Preserves existing webhookId on repeat activations.
    pub async fn upsert_webhook(
        &self,
        flow_id: &str,
        user_id: &str,
        app_event: &str,
        method: &str,
        authentication: &str,
        response_mode: &str,
    ) -> Result<WebhookRegistration> {
        let existing = self
            .col_webhooks()
            .find_one(doc! {
                "flowId":   flow_id,
                "userId":   user_id,
                "appEvent": app_event,
            })
            .await?;

        let webhook_id = existing
            .as_ref()
            .map(|d| d.webhook_id.clone())
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let now = Utc::now();
        let now_bson = bson::DateTime::from_chrono(now);

        self.col_webhooks()
            .update_one(
                doc! { "flowId": flow_id, "userId": user_id, "appEvent": app_event },
                doc! {
                    "$set": {
                        "webhookId":      &webhook_id,
                        "method":         method,
                        "authentication": authentication,
                        "responseMode":   response_mode,
                        "isActive":       true,
                        "updatedAt":      now_bson,
                    },
                    "$setOnInsert": { "createdAt": now_bson },
                },
            )
            .upsert(true)
            .await?;

        Ok(WebhookRegistration {
            webhook_id,
            flow_id: flow_id.to_string(),
            app_event: app_event.to_string(),
            method: method.to_string(),
            auth_type: authentication.to_string(),
            is_active: true,
            created_at: now,
        })
    }

    /// Mark all webhooks for a flow as inactive.
    pub async fn deactivate_flow_webhooks(&self, flow_id: &str, user_id: &str) -> Result<()> {
        self.col_webhooks()
            .update_many(
                doc! { "flowId": flow_id, "userId": user_id },
                doc! { "$set": { "isActive": false, "updatedAt": bson::DateTime::now() } },
            )
            .await?;
        Ok(())
    }
}
