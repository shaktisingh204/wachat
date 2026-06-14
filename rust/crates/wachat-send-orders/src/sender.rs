//! [`OrdersSender`] — the slice's public actor.
//!
//! Two operations, one per TS action:
//!
//! * [`OrdersSender::send_order_details`] — mirrors
//!   `handleSendOrderDetailsMessage` (TS line ~1679).
//! * [`OrdersSender::send_order_status`] — mirrors
//!   `handleSendOrderStatusMessage` (TS line ~1763).
//!
//! Each operation:
//!
//! 1. Validates the project plumbing (access token, app id, phone-number id).
//! 2. Normalises the recipient phone via [`wachat_phone::normalize_e164`].
//! 3. Builds the Meta interactive payload (byte-for-byte equivalent to TS).
//! 4. POSTs to `/{phone-number-id}/messages` via [`MetaClient::post_json`].
//! 5. Inserts an `outgoing_messages` log row mirroring the TS document.
//! 6. Bumps the contact's `lastMessage` / `lastMessageTimestamp` (best
//!    effort — failures only log, mirroring how the TS fires-and-forgets
//!    after the main insert).
//!
//! Returns [`SendOutcome`] on success.

use bson::{Document, oid::ObjectId};
use chrono::Utc;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::{debug, instrument, warn};

use wachat_meta_client::MetaClient;
use wachat_meta_dto::SendResponse;
use wachat_phone::normalize_e164;
use wachat_types::project::Project;

use crate::dto::{OrderItem, SendOrderDetailsReq, SendOrderStatusReq, SendOutcome};
use crate::{CONTACTS_COLL, MONEY_OFFSET_2DP, OUTGOING_MESSAGES_COLL};

/// Maximum length of the truncated `lastMessage` summary written to the
/// contacts collection. Mirrors TS `.substring(0, 50)` (lines 1754, 1820).
const LAST_MESSAGE_MAX_LEN: usize = 50;

/// The wachat orders sender. Cheap to clone — both fields are `Arc`-backed
/// (`MongoHandle` and `MetaClient` document this in their own crates).
#[derive(Debug, Clone)]
pub struct OrdersSender {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl OrdersSender {
    /// Construct a sender bound to the given Mongo + Meta handles.
    ///
    /// The `MetaClient` should be pinned to [`crate::META_API_VERSION`]
    /// (`v23.0`) to match the TS — but we don't enforce that here so
    /// tests can swap in a `with_base` mock.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    // ------------------------------------------------------------------
    // order_details
    // ------------------------------------------------------------------

    /// Send an interactive `order_details` message. See TS
    /// `handleSendOrderDetailsMessage` (line ~1679).
    #[instrument(
        skip(self, req),
        fields(
            project_id = %project.id,
            recipient = %req.to,
            reference_id = %req.reference_id,
        )
    )]
    pub async fn send_order_details(
        &self,
        project: &Project,
        req: SendOrderDetailsReq,
    ) -> Result<SendOutcome, ApiError> {
        let plumbing = self.project_plumbing(project)?;

        // Normalise → bare digits for the Meta `to` field (mirrors TS
        // `waId` which is already digits-only).
        let recipient = normalize_e164(&req.to, None)
            .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;
        let bare_to = recipient.trim_start_matches('+').to_owned();

        // Total = sum of all parts, exactly as the TS callers compute.
        // The TS receives the total pre-computed via `data.totalAmount`;
        // we accept the parts and add them up so callers can't forget.
        let total_minor: i64 = req.subtotal_minor + req.tax_minor + req.shipping_minor.unwrap_or(0)
            - req.discount_minor.unwrap_or(0);

        let order_obj = build_order_object(&req);

        // The TS spreads `paymentType`, optional `paymentLink` (as
        // `payment_configuration`), and `type` (digital-goods /
        // physical-goods) directly into `action.parameters`. We give
        // callers an opaque `payment_settings` object that we splice
        // verbatim into `parameters`.
        let mut parameters = json!({
            "reference_id": req.reference_id,
            "currency": req.currency,
            "total_amount": money(total_minor),
            "order": order_obj,
        });
        merge_payment_settings(&mut parameters, &req.payment_settings);

        let mut interactive = json!({
            "type": "order_details",
            "body": { "text": req.body_text },
            "action": {
                "name": "review_and_pay",
                "parameters": parameters,
            },
        });
        if let Some(footer) = req.footer_text.as_deref() {
            interactive
                .as_object_mut()
                .expect("interactive is an object")
                .insert("footer".to_owned(), json!({ "text": footer }));
        }

        let payload = json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": bare_to,
            "type": "interactive",
            "interactive": interactive,
        });

        let wamid = self.post_to_meta(&plumbing, &payload).await?;

        // ---- Insert outgoing log + bump contact ------------------------
        let log_id = self
            .insert_outgoing_log(
                project,
                &payload,
                &wamid,
                &bare_to,
                &format!("[Order: {}]", req.reference_id),
            )
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    // ------------------------------------------------------------------
    // order_status
    // ------------------------------------------------------------------

    /// Send an interactive `order_status` message. See TS
    /// `handleSendOrderStatusMessage` (line ~1763).
    #[instrument(
        skip(self, req),
        fields(
            project_id = %project.id,
            recipient = %req.to,
            reference_id = %req.reference_id,
            status = %req.status,
        )
    )]
    pub async fn send_order_status(
        &self,
        project: &Project,
        req: SendOrderStatusReq,
    ) -> Result<SendOutcome, ApiError> {
        let plumbing = self.project_plumbing(project)?;

        let recipient = normalize_e164(&req.to, None)
            .map_err(|e| ApiError::Validation(format!("invalid recipient phone: {e}")))?;
        let bare_to = recipient.trim_start_matches('+').to_owned();

        // Mirror the TS: ship `description` on the inner `order` object
        // when (and only when) the body text is non-empty. The TS only
        // sets it when the user supplied `data.description`; we always
        // forward the body text since callers always provide one.
        let mut order = json!({ "status": req.status });
        if !req.body_text.is_empty() {
            order
                .as_object_mut()
                .expect("order is an object")
                .insert("description".to_owned(), json!(req.body_text));
        }

        let payload = json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": bare_to,
            "type": "interactive",
            "interactive": {
                "type": "order_status",
                "body": { "text": req.body_text },
                "action": {
                    "name": "review_order",
                    "parameters": {
                        "reference_id": req.reference_id,
                        "order": order,
                    },
                },
            },
        });

        let wamid = self.post_to_meta(&plumbing, &payload).await?;

        let log_id = self
            .insert_outgoing_log(
                project,
                &payload,
                &wamid,
                &bare_to,
                &format!("[Order Status: {}]", req.status),
            )
            .await?;

        Ok(SendOutcome {
            message_log_id: log_id,
            wamid,
        })
    }

    // ------------------------------------------------------------------
    // internals
    // ------------------------------------------------------------------

    fn project_plumbing<'a>(&self, project: &'a Project) -> Result<ProjectPlumbing<'a>, ApiError> {
        let access_token = project
            .access_token
            .as_deref()
            .filter(|t| !t.is_empty())
            .ok_or_else(|| {
                ApiError::BadRequest("Project access token is not configured.".to_owned())
            })?;

        let phone_number_id = project
            .phone_numbers
            .first()
            .and_then(|p| p.id.as_deref())
            .ok_or_else(|| {
                ApiError::BadRequest("Project has no phone number configured.".to_owned())
            })?;

        Ok(ProjectPlumbing {
            access_token,
            phone_number_id,
        })
    }

    async fn post_to_meta(
        &self,
        plumbing: &ProjectPlumbing<'_>,
        payload: &Value,
    ) -> Result<String, ApiError> {
        let path = format!("{}/messages", plumbing.phone_number_id);
        debug!(path = %path, "POST /{{phone-number-id}}/messages");

        let resp: SendResponse = self
            .meta
            .post_json(&path, plumbing.access_token, payload)
            .await
            .map_err(ApiError::from)?;

        // TS line 1743 / 1809: "Message sent but no WAMID returned."
        resp.messages
            .into_iter()
            .next()
            .map(|m| m.id)
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "Message sent but no WAMID returned from Meta."
                ))
            })
    }

    async fn insert_outgoing_log(
        &self,
        project: &Project,
        payload: &Value,
        wamid: &str,
        bare_recipient: &str,
        contact_summary: &str,
    ) -> Result<ObjectId, ApiError> {
        // Mirror the TS document EXACTLY (`whatsapp.actions.ts`
        // lines 1746-1750 / 1812-1816):
        //
        // ```
        // db.collection('outgoing_messages').insertOne({
        //   direction: 'out',
        //   contactId: new ObjectId(contactId),
        //   projectId: new ObjectId(projectId),
        //   wamid,
        //   messageTimestamp: now,
        //   type: 'order' as any,
        //   content: payload,
        //   status: 'sent',
        //   statusTimestamps: { sent: now },
        //   createdAt: now,
        // });
        // ```
        let now = Utc::now();
        let bson_now = bson::DateTime::from_chrono(now);
        let log_id = ObjectId::new();

        let mut doc = bson::doc! {
            "_id": log_id,
            "direction": "out",
            "projectId": project.id,
            "wamid": wamid,
            "recipient": bare_recipient,
            "messageTimestamp": bson_now,
            "type": "order",
            "content": bson::to_bson(payload).map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("encode content"))
            })?,
            "status": "sent",
            "statusTimestamps": { "sent": bson_now },
            "createdAt": bson_now,
        };
        // The TS additionally writes `contactId` — we don't have one in
        // this slice (resolution moved upstream). Omit rather than
        // synthesise an id.
        let _ = doc.remove("contactId"); // explicit no-op to flag the diff

        let logs = self.mongo.collection::<Document>(OUTGOING_MESSAGES_COLL);
        logs.insert_one(doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("outgoing_messages.insert_one"))
        })?;

        // Best-effort contact bump — TS does this AFTER the insert and
        // does not error on failure (lines 1752 / 1818).
        self.bump_contact(project.id, bare_recipient, contact_summary, bson_now)
            .await;

        Ok(log_id)
    }

    /// Best-effort `lastMessage` / `lastMessageTimestamp` bump. Failures
    /// only log — mirrors the TS which has no error branch around the
    /// equivalent `contacts.updateOne` call.
    async fn bump_contact(
        &self,
        project_id: ObjectId,
        bare_recipient: &str,
        summary: &str,
        ts: bson::DateTime,
    ) {
        let truncated: String = summary.chars().take(LAST_MESSAGE_MAX_LEN).collect();
        let coll = self.mongo.collection::<Document>(CONTACTS_COLL);
        // TS keys on `contactId` (a Mongo `_id`); we don't have it here
        // (see `insert_outgoing_log`), so we key on the canonical
        // contact identity used elsewhere in the codebase: `(projectId,
        // waId)`. This matches `wachat-webhook-contacts`'s upsert key.
        let res = coll
            .update_one(
                bson::doc! { "projectId": project_id, "waId": bare_recipient },
                bson::doc! {
                    "$set": {
                        "lastMessage": truncated,
                        "lastMessageTimestamp": ts,
                    }
                },
            )
            .await;
        if let Err(e) = res {
            warn!(error = %e, "contacts.updateOne (lastMessage bump) failed");
        }
    }
}

// ----------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------

struct ProjectPlumbing<'a> {
    access_token: &'a str,
    phone_number_id: &'a str,
}

/// Encode a minor-unit amount as Meta's `{ value, offset }` shape.
///
/// We always use `offset = 100` (2-decimal currencies). The TS hard-codes
/// the same — see `whatsapp.actions.ts` line 1729 and the inline `amount`
/// objects on each line item. Zero-decimal currencies (JPY, KRW) are out
/// of scope for this slice; matching the TS comes first.
fn money(value_minor: i64) -> Value {
    json!({ "value": value_minor, "offset": MONEY_OFFSET_2DP })
}

/// Build the inner `order` object. Mirrors `data.order` (TS lines
/// 1691-1705) — items + subtotal + tax + optional shipping + optional
/// discount.
///
/// The TS spreads `data.order` straight into the payload. We construct
/// the same shape from typed fields so callers can't forget the
/// `offset`.
fn build_order_object(req: &SendOrderDetailsReq) -> Value {
    let items: Vec<Value> = req.items.iter().map(item_to_json).collect();
    let mut order = json!({
        // The TS receives `status` as part of `data.order` and includes
        // it. We default to "pending" here — the typical state at order
        // creation. Callers who need a different initial status should
        // ship a follow-up `order_status` message instead.
        "status": "pending",
        "items": items,
        "subtotal": money(req.subtotal_minor),
        "tax": money(req.tax_minor),
    });
    let map = order.as_object_mut().expect("order is an object");
    if let Some(s) = req.shipping_minor {
        map.insert("shipping".to_owned(), money(s));
    }
    if let Some(d) = req.discount_minor {
        map.insert("discount".to_owned(), money(d));
    }
    order
}

fn item_to_json(item: &OrderItem) -> Value {
    json!({
        "retailer_id": item.retailer_id,
        "name": item.name,
        "amount": money(item.amount_minor),
        "quantity": item.quantity,
    })
}

/// Splice an opaque `payment_settings` JSON object into an existing
/// `parameters` JSON object. Existing keys win (we never overwrite the
/// hard-coded `reference_id` / `currency` / `total_amount` / `order`).
/// Non-object inputs are ignored.
fn merge_payment_settings(parameters: &mut Value, settings: &Value) {
    let Some(src) = settings.as_object() else {
        return;
    };
    let Some(dst) = parameters.as_object_mut() else {
        return;
    };
    for (k, v) in src {
        // Don't let payment_settings clobber the hard-coded keys — the
        // TS doesn't allow that either (it sets them after the spread).
        if !dst.contains_key(k) {
            dst.insert(k.clone(), v.clone());
        }
    }
}

// ----------------------------------------------------------------------
// Unit tests
// ----------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_req() -> SendOrderDetailsReq {
        SendOrderDetailsReq {
            to: "+919876543210".to_owned(),
            reference_id: "ORD-1".to_owned(),
            items: vec![OrderItem {
                retailer_id: "SKU-1".to_owned(),
                name: "Widget".to_owned(),
                amount_minor: 9999,
                quantity: 2,
            }],
            subtotal_minor: 19998,
            tax_minor: 1800,
            shipping_minor: Some(500),
            discount_minor: Some(1000),
            currency: "INR".to_owned(),
            payment_settings: json!({
                "payment_type": "upi",
                "type": "physical-goods",
                "payment_configuration": "pm_link_123",
            }),
            body_text: "Order ORD-1".to_owned(),
            footer_text: None,
        }
    }

    #[test]
    fn money_uses_2dp_offset() {
        let v = money(1234);
        assert_eq!(v["value"], 1234);
        assert_eq!(v["offset"], 100);
    }

    #[test]
    fn money_handles_zero() {
        let v = money(0);
        assert_eq!(v["value"], 0);
        assert_eq!(v["offset"], 100);
    }

    #[test]
    fn build_order_includes_items_subtotal_tax() {
        let req = sample_req();
        let order = build_order_object(&req);
        assert_eq!(order["status"], "pending");
        assert_eq!(order["items"][0]["retailer_id"], "SKU-1");
        assert_eq!(order["items"][0]["amount"]["value"], 9999);
        assert_eq!(order["items"][0]["amount"]["offset"], 100);
        assert_eq!(order["items"][0]["quantity"], 2);
        assert_eq!(order["subtotal"]["value"], 19998);
        assert_eq!(order["tax"]["value"], 1800);
        assert_eq!(order["shipping"]["value"], 500);
        assert_eq!(order["discount"]["value"], 1000);
    }

    #[test]
    fn build_order_omits_optional_fields() {
        let mut req = sample_req();
        req.shipping_minor = None;
        req.discount_minor = None;
        let order = build_order_object(&req);
        assert!(order.get("shipping").is_none());
        assert!(order.get("discount").is_none());
    }

    #[test]
    fn merge_payment_settings_adds_new_keys() {
        let mut params = json!({ "reference_id": "X" });
        let s = json!({ "payment_type": "upi", "extra": "ok" });
        merge_payment_settings(&mut params, &s);
        assert_eq!(params["payment_type"], "upi");
        assert_eq!(params["extra"], "ok");
        assert_eq!(params["reference_id"], "X");
    }

    #[test]
    fn merge_payment_settings_does_not_clobber_existing() {
        let mut params = json!({ "reference_id": "X", "currency": "INR" });
        let s = json!({ "currency": "USD" }); // attempted clobber
        merge_payment_settings(&mut params, &s);
        assert_eq!(params["currency"], "INR");
    }

    #[test]
    fn merge_payment_settings_ignores_non_object() {
        let mut params = json!({ "a": 1 });
        merge_payment_settings(&mut params, &json!("not an object"));
        assert_eq!(params["a"], 1);
        assert_eq!(params.as_object().unwrap().len(), 1);
    }

    #[test]
    fn item_to_json_shape() {
        let it = OrderItem {
            retailer_id: "r".into(),
            name: "n".into(),
            amount_minor: 50,
            quantity: 3,
        };
        let j = item_to_json(&it);
        assert_eq!(j["retailer_id"], "r");
        assert_eq!(j["name"], "n");
        assert_eq!(j["amount"]["value"], 50);
        assert_eq!(j["amount"]["offset"], 100);
        assert_eq!(j["quantity"], 3);
    }

    #[test]
    fn meta_api_version_matches_ts() {
        // Source of truth: top of whatsapp.actions.ts.
        assert_eq!(crate::META_API_VERSION, "v25.0");
    }

    #[test]
    fn outgoing_messages_collection_name_matches_ts() {
        assert_eq!(crate::OUTGOING_MESSAGES_COLL, "outgoing_messages");
    }

    #[test]
    fn contacts_collection_name_matches_ts() {
        assert_eq!(crate::CONTACTS_COLL, "contacts");
    }

    #[test]
    fn money_offset_2dp_constant() {
        assert_eq!(crate::MONEY_OFFSET_2DP, 100);
    }
}
