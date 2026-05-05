//! `PaymentRequestSender` — Meta send + Mongo correlation reads.
//!
//! Uses the **interactive `order_details`** flavor on Meta (richer than the
//! TS `payment_requests` REST endpoint — surfaces line items end-to-end).
//! Persists a correlation row in `payment_requests` keyed on `referenceId`
//! so the webhook status processor (Phase 2) can flip status without a
//! round-trip back to Meta.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, instrument};
use wachat_meta_client::MetaClient;
use wachat_phone::normalize_e164;
use wachat_types::Project;

use crate::dto::{
    PaymentRequest, PaymentRequestStatus, PaymentStatus, SendOutcome, SendPaymentReq,
};
use crate::{OUTGOING_MESSAGES_COLL, PAYMENT_REQUESTS_COLL};

#[derive(Clone)]
pub struct PaymentRequestSender {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl PaymentRequestSender {
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// Send a WhatsApp payment request.
    ///
    /// Builds the Meta `order_details` interactive payload, POSTs it via
    /// `{phone-number-id}/messages`, then writes both the
    /// `outgoing_messages` log and a `payment_requests` correlation row.
    /// Returns the Mongo `_id` of the new correlation row plus the wamid.
    #[instrument(skip_all, fields(reference_id = %req.reference_id, recipient = %req.to))]
    pub async fn send(&self, project: &Project, req: SendPaymentReq) -> Result<SendOutcome> {
        if req.items.is_empty() {
            return Err(ApiError::Validation(
                "payment request must have at least one item".to_owned(),
            ));
        }
        if req.items.iter().any(|i| i.quantity == 0) {
            return Err(ApiError::Validation(
                "payment request items must have quantity >= 1".to_owned(),
            ));
        }

        let access_token = project
            .access_token
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("project missing accessToken".to_owned()))?;
        // First registered phone number on the project (matches the TS
        // form-data path that takes phoneNumberId as a top-level field on
        // the project document).
        let phone_number_id = project
            .phone_numbers
            .first()
            .map(|p| p.id.as_str())
            .ok_or_else(|| {
                ApiError::BadRequest("project has no registered phone numbers".to_owned())
            })?;

        // Bare-digit recipient (Meta `wa_id` form).
        let canonical = normalize_e164(&req.to, None)
            .map_err(|e| ApiError::BadRequest(format!("invalid recipient: {e}")))?;
        let recipient = canonical.trim_start_matches('+').to_owned();

        // Build Meta order_details payload. Currency offset = 100 (2-decimal).
        let items_json: Vec<Value> = req
            .items
            .iter()
            .map(|i| {
                json!({
                    "name": i.name,
                    "amount": { "value": i.amount_minor, "offset": 100i64 },
                    "quantity": i.quantity,
                })
            })
            .collect();

        let payload = json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "interactive",
            "interactive": {
                "type": "order_details",
                "body": { "text": req.body_text },
                "action": {
                    "name": "review_and_pay",
                    "parameters": {
                        "reference_id": req.reference_id,
                        "type": "digital-goods",
                        "payment_settings": [
                            {
                                "type": "payment_gateway",
                                "payment_gateway": {
                                    "type": "razorpay",
                                    "configuration_name": req.configuration_name,
                                }
                            }
                        ],
                        "currency": req.currency,
                        "total_amount": { "value": req.amount_minor, "offset": 100i64 },
                        "order": {
                            "status": "pending",
                            "items": items_json,
                            "subtotal": { "value": req.amount_minor, "offset": 100i64 },
                        }
                    }
                }
            }
        });

        let path = format!("{phone_number_id}/messages");
        let resp: serde_json::Value = self.meta.post_json(&path, access_token, &payload).await?;
        let wamid = resp
            .get("messages")
            .and_then(|m| m.get(0))
            .and_then(|m| m.get("id"))
            .and_then(|id| id.as_str())
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!("Meta response missing messages[0].id"))
            })?
            .to_owned();

        debug!(wamid = %wamid, "payment request sent");

        // Persist the correlation doc.
        let now = bson::DateTime::from_chrono(Utc::now());
        let pr_id = ObjectId::new();
        let pr_doc = doc! {
            "_id": pr_id,
            "projectId": project.id,
            "referenceId": &req.reference_id,
            "recipient": &recipient,
            "amountMinor": req.amount_minor,
            "currency": &req.currency,
            "items": req.items
                .iter()
                .map(|i| {
                    doc! {
                        "name": &i.name,
                        "amountMinor": i.amount_minor,
                        "quantity": i.quantity as i64,
                    }
                })
                .collect::<Vec<_>>(),
            "configurationName": &req.configuration_name,
            "status": PaymentRequestStatus::Pending.as_str(),
            "wamid": &wamid,
            "paidAt": Option::<bson::DateTime>::None,
            "createdAt": now,
            "updatedAt": now,
        };
        self.mongo
            .collection::<Document>(PAYMENT_REQUESTS_COLL)
            .insert_one(pr_doc)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::anyhow!(e).context("payment_requests insert"))
            })?;

        // Outgoing message log so the webhook status processor finds it.
        let log = doc! {
            "direction": "out",
            "projectId": project.id,
            "wamid": &wamid,
            "recipient": &recipient,
            "messageTimestamp": now,
            "type": "payment_request",
            "content": bson::to_bson(&payload)
                .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?,
            "status": "sent",
            "statusTimestamps": doc! { "sent": now },
            "createdAt": now,
            "paymentRequestId": pr_id,
        };
        self.mongo
            .collection::<Document>(OUTGOING_MESSAGES_COLL)
            .insert_one(log)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::anyhow!(e).context("outgoing_messages insert"))
            })?;

        Ok(SendOutcome {
            payment_request_id: pr_id,
            wamid,
        })
    }

    /// Cached status read for a `reference_id`. Returns `None` if no
    /// correlation row exists. The webhook status processor populates
    /// `paidAt` when status transitions to `COMPLETED`.
    #[instrument(skip(self))]
    pub async fn get_status(&self, reference_id: &str) -> Result<Option<PaymentStatus>> {
        let row: Option<PaymentRequest> = self
            .mongo
            .collection::<PaymentRequest>(PAYMENT_REQUESTS_COLL)
            .find_one(doc! { "referenceId": reference_id })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        Ok(row.map(|r| PaymentStatus {
            reference_id: r.reference_id,
            status: r.status,
            paid_at: r.paid_at.map(|d| d.to_chrono()),
        }))
    }

    /// All payment requests for a project, sorted by `createdAt` desc.
    #[instrument(skip(self))]
    pub async fn list_for_project(&self, project_id: &ObjectId) -> Result<Vec<PaymentRequest>> {
        use mongodb::options::FindOptions;
        let opts = FindOptions::builder()
            .sort(doc! { "createdAt": -1i32 })
            .build();
        let cursor = self
            .mongo
            .collection::<PaymentRequest>(PAYMENT_REQUESTS_COLL)
            .find(doc! { "projectId": project_id })
            .with_options(opts)
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        let rows: Vec<PaymentRequest> = cursor
            .try_collect()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
        Ok(rows)
    }
}
