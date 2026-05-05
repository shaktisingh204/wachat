//! [`WebhookSubscriber`] — orchestrates Meta `subscribed_apps` calls and
//! the matching Mongo project lookups.
//!
//! Cheap to clone (`MongoHandle` and `MetaClient` are both Arc-backed).
//! Construct once per process and share via Axum app state.

use bson::doc;
use futures::TryStreamExt;
use mongodb::Collection;
use serde::Deserialize;
use tracing::{debug, instrument, warn};

use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_types::project::Project;

use crate::dto::{SubscribeAllOutcome, SubscribeFailure, SubscriptionStatus};

/// Mongo collection storing [`Project`] documents. Matches the TS
/// `getProjects()` collection name.
const PROJECTS_COLL: &str = "projects";

/// Wire shape Meta returns from
/// `GET /{wabaId}/subscribed_apps`. We only care about whether `data`
/// is non-empty, but typing the inner element documents what the field
/// actually contains.
#[derive(Debug, Deserialize)]
struct SubscribedAppsResponse {
    #[serde(default)]
    data: Vec<SubscribedAppEntry>,
}

#[derive(Debug, Deserialize)]
struct SubscribedAppEntry {
    /// Subscribed app `whatsapp_business_api_data` block. We don't read
    /// any fields off it — its presence in the array is the signal.
    #[allow(dead_code)]
    whatsapp_business_api_data: Option<serde_json::Value>,
}

/// Webhook subscription manager.
///
/// Cloning is cheap — both inner handles are Arc-wrapped already.
#[derive(Debug, Clone)]
pub struct WebhookSubscriber {
    mongo: MongoHandle,
    meta: MetaClient,
}

impl WebhookSubscriber {
    /// Construct a subscriber over a shared Mongo + Meta handle.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// `GET https://graph.facebook.com/v23.0/{waba_id}/subscribed_apps`
    ///
    /// Returns `SubscriptionStatus { is_active }` where `is_active` is
    /// `true` iff Meta returns at least one entry in the `data` array.
    /// Mirrors `getWebhookSubscriptionStatus(wabaId, accessToken)` in
    /// `src/app/actions/whatsapp.actions.ts:341`.
    ///
    /// Argument validation matches the TS — empty `waba_id` or
    /// `access_token` returns a `BadRequest` rather than going to Meta.
    #[instrument(skip_all, fields(waba_id = %waba_id))]
    pub async fn status(
        &self,
        waba_id: &str,
        access_token: &str,
    ) -> Result<SubscriptionStatus, ApiError> {
        if waba_id.is_empty() || access_token.is_empty() {
            return Err(ApiError::BadRequest(
                "WABA ID or Access Token not provided.".to_owned(),
            ));
        }

        let path = format!("{waba_id}/subscribed_apps");
        let resp: SubscribedAppsResponse = self.meta.get_json(&path, access_token).await?;

        debug!(entries = resp.data.len(), "subscribed_apps fetched");
        Ok(SubscriptionStatus {
            is_active: !resp.data.is_empty(),
        })
    }

    /// `POST https://graph.facebook.com/v23.0/{waba_id}/subscribed_apps`
    ///
    /// Subscribes the given WABA to the configured Meta app. Mirrors
    /// `handleSubscribeProjectWebhook(wabaId, appId, userAccessToken)`
    /// in `src/app/actions/whatsapp.actions.ts:382`.
    ///
    /// `app_id` is taken from the project document for symmetry with the
    /// TS signature; Meta does not require it on the request itself
    /// (the bound app is identified by the access token's app context),
    /// but we keep it in the signature so callers can plumb the project
    /// triple through unchanged.
    #[instrument(skip_all, fields(waba_id = %waba_id, app_id = %app_id))]
    pub async fn subscribe_one(
        &self,
        waba_id: &str,
        app_id: &str,
        user_access_token: &str,
    ) -> Result<(), ApiError> {
        if waba_id.is_empty() {
            return Err(ApiError::BadRequest("waba_id is required".to_owned()));
        }
        if app_id.is_empty() {
            return Err(ApiError::BadRequest("app_id is required".to_owned()));
        }
        if user_access_token.is_empty() {
            return Err(ApiError::Unauthorized(
                "user access token is required".to_owned(),
            ));
        }

        let path = format!("{waba_id}/subscribed_apps");
        // Meta accepts an empty body when the access token identifies
        // the calling app. The TS sends `{ access_token: <token> }` as a
        // body field; `MetaClient` already supplies the same token via
        // the `Authorization: Bearer …` header, which Meta treats as
        // equivalent. Using `serde_json::Value::Null` would emit `null`
        // in the body — send `{}` instead so we match the curl examples
        // in Meta's docs.
        let _: serde_json::Value = self
            .meta
            .post_json(&path, user_access_token, &serde_json::json!({}))
            .await?;
        Ok(())
    }

    /// Iterates **every** project in Mongo and attempts a subscribe.
    ///
    /// Mirrors `handleSubscribeAllProjects()` in
    /// `src/app/actions/whatsapp.actions.ts:364`. Projects missing
    /// `wabaId` / `appId` / `accessToken` are counted in `attempted`
    /// and recorded as a [`SubscribeFailure`] with a "skipped"-style
    /// reason (the TS quietly forwards `undefined!` to Meta and lets it
    /// 400 — we report the skip up-front instead, which is strictly
    /// more informative for the dashboard).
    ///
    /// **Tenancy:** this method has no auth scope of its own. Callers
    /// must enforce admin-only access at the HTTP layer before invoking
    /// it; a bulk subscribe across every tenant's projects is an
    /// admin-only operation in the TS world too.
    #[instrument(skip_all)]
    pub async fn subscribe_all(&self) -> Result<SubscribeAllOutcome, ApiError> {
        let coll: Collection<Project> = self.mongo.collection::<Project>(PROJECTS_COLL);
        let cursor = coll.find(doc! {}).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.find for subscribe_all"))
        })?;

        let projects: Vec<Project> = cursor.try_collect().await.map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("collecting projects cursor for subscribe_all"),
            )
        })?;

        let mut outcome = SubscribeAllOutcome {
            attempted: projects.len(),
            succeeded: 0,
            failed: Vec::new(),
        };

        for project in projects {
            let project_id = project.id.to_hex();

            let waba_id = match project.waba_id.as_deref() {
                Some(s) if !s.is_empty() => s,
                _ => {
                    outcome.failed.push(SubscribeFailure {
                        project_id,
                        error: "missing wabaId".to_owned(),
                    });
                    continue;
                }
            };
            let app_id = match project.app_id.as_deref() {
                Some(s) if !s.is_empty() => s,
                _ => {
                    outcome.failed.push(SubscribeFailure {
                        project_id,
                        error: "missing appId".to_owned(),
                    });
                    continue;
                }
            };
            let access_token = match project.access_token.as_deref() {
                Some(s) if !s.is_empty() => s,
                _ => {
                    outcome.failed.push(SubscribeFailure {
                        project_id,
                        error: "missing accessToken".to_owned(),
                    });
                    continue;
                }
            };

            match self.subscribe_one(waba_id, app_id, access_token).await {
                Ok(()) => outcome.succeeded += 1,
                Err(e) => {
                    warn!(project_id = %project_id, error = %e, "subscribe_one failed");
                    outcome.failed.push(SubscribeFailure {
                        project_id,
                        error: e.to_string(),
                    });
                }
            }
        }

        Ok(outcome)
    }
}
