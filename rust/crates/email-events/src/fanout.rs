//! Outbound webhook fan-out — after persisting a batch of normalized
//! events, look up subscribed `email_webhook_configs` and ship each
//! event to each subscriber via `email_webhooks::deliver::deliver`.
//!
//! Deliveries are fire-and-forget (`tokio::spawn`) so the ingest
//! request returns to the provider as fast as possible. Failures are
//! tracked on the config row (lastFailedAt + failureCount) by the
//! `deliver` helper.

use bson::{Document, doc};
use email_webhooks::deliver::{WebhookConfigRecord, deliver};
use futures::TryStreamExt;
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::warn;

const WEBHOOK_CONFIGS_COLL: &str = "email_webhook_configs";

/// Fan out a batch of events to subscribed webhook configs.
///
/// `events` is a Vec of `(event_kind_str, payload_json)` pairs. The
/// caller has already persisted the events into `email_events`; this
/// function only handles outbound delivery.
pub async fn fanout(
    mongo: &MongoHandle,
    http: &reqwest::Client,
    tenant_id: &str,
    events: Vec<(String, Value)>,
) {
    if events.is_empty() {
        return;
    }

    // Collect the set of distinct kinds so we can filter configs once.
    let distinct_kinds: Vec<String> = {
        let mut set = std::collections::BTreeSet::new();
        for (k, _) in &events {
            set.insert(k.clone());
        }
        set.into_iter().collect()
    };

    // Find every active config in the tenant that subscribes to at
    // least one of the kinds we're about to ship.
    let cursor_res = mongo
        .collection::<Document>(WEBHOOK_CONFIGS_COLL)
        .find(doc! {
            "userId": tenant_id,
            "active": true,
            "events": { "$in": &distinct_kinds },
        })
        .await;

    let cursor = match cursor_res {
        Ok(c) => c,
        Err(e) => {
            warn!(?e, "email-events fanout: config lookup failed");
            return;
        }
    };
    let configs: Vec<Document> = match cursor.try_collect().await {
        Ok(v) => v,
        Err(e) => {
            warn!(?e, "email-events fanout: config drain failed");
            return;
        }
    };

    let records: Vec<WebhookConfigRecord> = configs
        .into_iter()
        .filter_map(|d| doc_to_record(&d, tenant_id))
        .collect();

    if records.is_empty() {
        return;
    }

    // Fire-and-forget per (config, event) pair.
    for (kind, payload) in events {
        for cfg in &records {
            if !cfg.events.iter().any(|e| e == &kind) {
                continue;
            }
            let mongo = mongo.clone();
            let http = http.clone();
            let cfg = cfg.clone();
            let payload = payload.clone();
            tokio::spawn(async move {
                if let Err(e) = deliver(&mongo, &http, &cfg, &payload).await {
                    warn!(?e, url = %cfg.url, "email-events fanout delivery error");
                }
            });
        }
    }
}

fn doc_to_record(d: &Document, tenant_id: &str) -> Option<WebhookConfigRecord> {
    let id = d.get_object_id("_id").ok()?;
    let url = d.get_str("url").ok()?.to_owned();
    let secret = d.get_str("secret").ok()?.to_owned();
    let events: Vec<String> = d
        .get_array("events")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default();
    let active = d.get_bool("active").unwrap_or(true);
    Some(WebhookConfigRecord {
        id,
        user_id: tenant_id.to_owned(),
        url,
        secret,
        events,
        active,
    })
}
