//! Meta Authentication SDK.
//!
//! Provides a high-level SDK for exchanging Meta tokens, fetching app tokens,
//! and introspecting access tokens.
//!
//! Wraps the Graph API endpoints for authentication.

use reqwest::Client;
use sabnode_common::ApiError;
use serde::Deserialize;
use tracing::debug;

use crate::types::mask;

pub const GRAPH_API_VERSION: &str = "v23.0";

#[derive(Debug, Deserialize)]
struct OauthTokenResp {
    access_token: String,
    #[serde(default)]
    expires_in: Option<i64>,
}

/// Meta Authentication SDK for exchanging and fetching tokens.
#[derive(Debug, Clone)]
pub struct MetaAuthSdk {
    http: Client,
    app_id: String,
    app_secret: String,
}

impl MetaAuthSdk {
    /// Creates a new instance of the Meta Authentication SDK.
    pub fn new(http: Client, app_id: impl Into<String>, app_secret: impl Into<String>) -> Self {
        Self {
            http,
            app_id: app_id.into(),
            app_secret: app_secret.into(),
        }
    }

    /// Fetches an app-level access token from Meta using client credentials.
    pub async fn fetch_app_access_token(&self) -> Result<String, ApiError> {
        let url = format!("https://graph.facebook.com/{GRAPH_API_VERSION}/oauth/access_token");
        
        let resp = self.http
            .get(&url)
            .query(&[
                ("client_id", self.app_id.as_str()),
                ("client_secret", self.app_secret.as_str()),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "meta oauth/client_credentials {}: {body}",
                status.as_u16()
            )));
        }

        let parsed: OauthTokenResp = serde_json::from_str(&body)
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        Ok(parsed.access_token)
    }

    /// Exchanges a short-lived user token for a long-lived one.
    pub async fn exchange_short_lived_token(
        &self,
        short_lived: &str,
    ) -> Result<(String, Option<i64>), ApiError> {
        debug!(short = %mask(short_lived), "meta auth sdk: exchanging short-lived token");
        
        let url = format!("https://graph.facebook.com/{GRAPH_API_VERSION}/oauth/access_token");
        
        let resp = self.http
            .get(&url)
            .query(&[
                ("grant_type", "fb_exchange_token"),
                ("client_id", self.app_id.as_str()),
                ("client_secret", self.app_secret.as_str()),
                ("fb_exchange_token", short_lived),
            ])
            .send()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        if !status.is_success() {
            return Err(ApiError::BadRequest(format!(
                "meta oauth/access_token {}: {body}",
                status.as_u16()
            )));
        }

        let parsed: OauthTokenResp = serde_json::from_str(&body)
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

        Ok((parsed.access_token, parsed.expires_in))
    }
}
