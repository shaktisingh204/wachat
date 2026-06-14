//! Asterisk REST Interface (ARI) client + event types.
//!
//! Thin wrapper over the ARI REST API. The Stasis event stream is handled in
//! [`crate::stasis`]; this module is the imperative control surface (answer /
//! hangup / play / originate / bridge) plus typed views over the JSON events.

use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;

use crate::config::EngineConfig;
use crate::errors::{EngineError, EngineResult};

#[derive(Clone)]
pub struct AriClient {
    http: Client,
    base: String,
    user: String,
    pass: String,
    app: String,
}

impl AriClient {
    pub fn new(cfg: &EngineConfig) -> Self {
        AriClient {
            http: Client::new(),
            base: cfg.ari_base_url.trim_end_matches('/').to_owned(),
            user: cfg.ari_username.clone(),
            pass: cfg.ari_password.clone(),
            app: cfg.ari_app.clone(),
        }
    }

    pub fn app(&self) -> &str {
        &self.app
    }

    fn url(&self, path: &str) -> String {
        format!("{}/ari{}", self.base, path)
    }

    async fn send(
        &self,
        method: reqwest::Method,
        path: &str,
        query: &[(&str, &str)],
    ) -> EngineResult<Value> {
        let resp = self
            .http
            .request(method, self.url(path))
            .basic_auth(&self.user, Some(&self.pass))
            .query(query)
            .send()
            .await
            .map_err(|e| EngineError::Ari(format!("request failed: {e}")))?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(EngineError::Ari(format!("{status}: {body}")));
        }
        Ok(serde_json::from_str(&body).unwrap_or(Value::Null))
    }

    /// Answer a ringing channel.
    pub async fn answer(&self, channel_id: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/answer"),
            &[],
        )
        .await
        .map(|_| ())
    }

    /// Hang up a channel.
    pub async fn hangup(&self, channel_id: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::DELETE,
            &format!("/channels/{channel_id}"),
            &[],
        )
        .await
        .map(|_| ())
    }

    /// Play a media URI (e.g. `sound:hello-world`) to a channel. Returns the
    /// playback resource.
    pub async fn play(&self, channel_id: &str, media: &str) -> EngineResult<Value> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/play"),
            &[("media", media)],
        )
        .await
    }

    /// Originate an outbound channel into this Stasis app.
    pub async fn originate(
        &self,
        endpoint: &str,
        caller_id: Option<&str>,
        app_args: &str,
    ) -> EngineResult<Value> {
        let mut query: Vec<(&str, &str)> =
            vec![("endpoint", endpoint), ("app", &self.app), ("appArgs", app_args)];
        if let Some(cid) = caller_id {
            query.push(("callerId", cid));
        }
        self.send(reqwest::Method::POST, "/channels", &query).await
    }

    /// Create a mixing bridge for connecting two legs.
    pub async fn create_bridge(&self) -> EngineResult<String> {
        let v = self
            .send(reqwest::Method::POST, "/bridges", &[("type", "mixing")])
            .await?;
        v.get("id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| EngineError::Ari("bridge create returned no id".to_owned()))
    }

    /// Add a channel into a bridge.
    pub async fn add_to_bridge(&self, bridge_id: &str, channel_id: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::POST,
            &format!("/bridges/{bridge_id}/addChannel"),
            &[("channel", channel_id)],
        )
        .await
        .map(|_| ())
    }

    /// Record the channel's audio to a named recording in the given format.
    pub async fn record(
        &self,
        channel_id: &str,
        name: &str,
        format: &str,
        max_seconds: u32,
    ) -> EngineResult<Value> {
        let max = max_seconds.to_string();
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/record"),
            &[
                ("name", name),
                ("format", format),
                ("maxDurationSeconds", &max),
                ("ifExists", "overwrite"),
            ],
        )
        .await
    }

    /// Hand the channel back to the dialplan (used for fallthrough routing).
    pub async fn continue_in_dialplan(&self, channel_id: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/continue"),
            &[],
        )
        .await
        .map(|_| ())
    }

    /// List all active channels (for the live agent console).
    pub async fn list_channels(&self) -> EngineResult<Value> {
        self.send(reqwest::Method::GET, "/channels", &[]).await
    }

    /// Put a channel on hold (plays music-on-hold to the other leg).
    pub async fn hold(&self, channel_id: &str) -> EngineResult<()> {
        self.send(reqwest::Method::POST, &format!("/channels/{channel_id}/hold"), &[])
            .await
            .map(|_| ())
    }

    pub async fn unhold(&self, channel_id: &str) -> EngineResult<()> {
        self.send(reqwest::Method::DELETE, &format!("/channels/{channel_id}/hold"), &[])
            .await
            .map(|_| ())
    }

    /// Mute a channel (`direction` = "in" | "out" | "both").
    pub async fn mute(&self, channel_id: &str, direction: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/mute"),
            &[("direction", direction)],
        )
        .await
        .map(|_| ())
    }

    pub async fn unmute(&self, channel_id: &str, direction: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::DELETE,
            &format!("/channels/{channel_id}/mute"),
            &[("direction", direction)],
        )
        .await
        .map(|_| ())
    }

    /// Blind-transfer (redirect) a channel to a new endpoint.
    pub async fn redirect(&self, channel_id: &str, endpoint: &str) -> EngineResult<()> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/redirect"),
            &[("endpoint", endpoint)],
        )
        .await
        .map(|_| ())
    }

    /// Create a holding bridge (used for park + queue waiting rooms).
    pub async fn create_holding_bridge(&self) -> EngineResult<String> {
        let v = self
            .send(reqwest::Method::POST, "/bridges", &[("type", "holding")])
            .await?;
        v.get("id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| EngineError::Ari("holding bridge create returned no id".to_owned()))
    }

    /// Snoop on a channel for supervisor coaching.
    /// `spy` = "in"|"out"|"both"|"none" (listen); `whisper` = "in"|"out"|"both"|"none" (talk).
    /// monitor = spy:both/whisper:none · whisper = spy:both/whisper:out · barge = spy:both/whisper:both.
    pub async fn snoop(
        &self,
        channel_id: &str,
        spy: &str,
        whisper: &str,
    ) -> EngineResult<Value> {
        self.send(
            reqwest::Method::POST,
            &format!("/channels/{channel_id}/snoop"),
            &[("spy", spy), ("whisper", whisper), ("app", &self.app)],
        )
        .await
    }

    /// Fork a channel's audio to an external host (websocket) for live STT/AI.
    pub async fn external_media(
        &self,
        external_host: &str,
        format: &str,
    ) -> EngineResult<Value> {
        self.send(
            reqwest::Method::POST,
            "/channels/externalMedia",
            &[
                ("app", &self.app),
                ("external_host", external_host),
                ("format", format),
            ],
        )
        .await
    }
}

/* ── Event views ─────────────────────────────────────────────────────── */

/// A channel as it appears inside an ARI event payload.
#[derive(Debug, Clone, Deserialize)]
pub struct AriChannel {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub caller: Option<AriCaller>,
    #[serde(default)]
    pub dialplan: Option<AriDialplan>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AriCaller {
    #[serde(default)]
    pub number: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AriDialplan {
    /// The dialed extension — for inbound calls this is the DID / number.
    #[serde(default)]
    pub exten: String,
    #[serde(default)]
    pub context: String,
}

impl AriChannel {
    pub fn caller_number(&self) -> String {
        self.caller
            .as_ref()
            .map(|c| c.number.clone())
            .unwrap_or_default()
    }

    pub fn dialed_exten(&self) -> String {
        self.dialplan
            .as_ref()
            .map(|d| d.exten.clone())
            .unwrap_or_default()
    }
}
