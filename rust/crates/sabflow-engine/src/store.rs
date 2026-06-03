use anyhow::Result;
use bson::{doc, oid::ObjectId};
use mongodb::Collection;
use sabnode_db::mongo::MongoHandle;

use crate::dto::{ExecutionRecord, NodeExecutionResult};

pub const EXECUTIONS_COLLECTION: &str = "sabflow_executions";
pub const FLOWS_COLLECTION: &str = "sabflows";

pub struct ExecutionStore {
    mongo: MongoHandle,
}

impl ExecutionStore {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    fn col_exec(&self) -> Collection<ExecutionRecord> {
        self.mongo.collection(EXECUTIONS_COLLECTION)
    }

    fn col_exec_doc(&self) -> Collection<bson::Document> {
        self.mongo.collection(EXECUTIONS_COLLECTION)
    }

    fn col_flows(&self) -> Collection<bson::Document> {
        self.mongo.collection(FLOWS_COLLECTION)
    }

    pub async fn insert(&self, record: &ExecutionRecord) -> Result<()> {
        let doc = bson::to_document(record)?;
        self.col_exec_doc().insert_one(doc).await?;
        Ok(())
    }

    pub async fn find_by_execution_id(
        &self,
        execution_id: &str,
    ) -> Result<Option<ExecutionRecord>> {
        Ok(self
            .col_exec()
            .find_one(doc! { "executionId": execution_id })
            .await?)
    }

    pub async fn update_status(&self, execution_id: &str, status: &str) -> Result<()> {
        self.col_exec_doc()
            .update_one(
                doc! { "executionId": execution_id },
                doc! { "$set": { "status": status, "finishedAt": bson::DateTime::now() } },
            )
            .await?;
        Ok(())
    }

    pub async fn push_node_result(
        &self,
        execution_id: &str,
        node_result: &NodeExecutionResult,
    ) -> Result<()> {
        let node_doc = bson::to_document(node_result)?;
        self.col_exec_doc()
            .update_one(
                doc! { "executionId": execution_id },
                doc! { "$push": { "nodeResults": node_doc } },
            )
            .await?;
        Ok(())
    }

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

    pub async fn set_flow_active(&self, flow_id: &str, user_id: &str, active: bool) -> Result<()> {
        // Match Next.js convention: PUBLISHED = live, DRAFT = offline
        let status = if active { "PUBLISHED" } else { "DRAFT" };
        let filter = if let Ok(oid) = ObjectId::parse_str(flow_id) {
            doc! { "_id": oid, "userId": user_id }
        } else {
            doc! { "userId": user_id }
        };
        self.col_flows()
            .update_one(filter, doc! { "$set": { "status": status } })
            .await?;
        Ok(())
    }
}
