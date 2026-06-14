//! Shared application state.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use mongodb::Database;
use tokio::sync::mpsc;

use crate::ari::AriClient;
use crate::config::EngineConfig;

/// Per-channel DTMF fan-out: the Stasis loop pushes each received digit to the
/// sender registered for that channel, and the verb runtime's `gather` awaits
/// on the matching receiver.
pub type DtmfRegistry = Arc<Mutex<HashMap<String, mpsc::UnboundedSender<String>>>>;

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<EngineConfig>,
    pub db: Database,
    pub ari: AriClient,
    pub http: reqwest::Client,
    pub dtmf: DtmfRegistry,
}

impl AppState {
    pub fn new(cfg: EngineConfig, db: Database) -> Self {
        let ari = AriClient::new(&cfg);
        AppState {
            cfg: Arc::new(cfg),
            db,
            ari,
            http: reqwest::Client::new(),
            dtmf: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a DTMF receiver for a channel; returns the receiver end.
    pub fn register_dtmf(&self, channel_id: &str) -> mpsc::UnboundedReceiver<String> {
        let (tx, rx) = mpsc::unbounded_channel();
        if let Ok(mut map) = self.dtmf.lock() {
            map.insert(channel_id.to_owned(), tx);
        }
        rx
    }

    pub fn unregister_dtmf(&self, channel_id: &str) {
        if let Ok(mut map) = self.dtmf.lock() {
            map.remove(channel_id);
        }
    }

    /// Deliver a digit to the channel's registered gather, if any.
    pub fn push_dtmf(&self, channel_id: &str, digit: &str) {
        if let Ok(map) = self.dtmf.lock() {
            if let Some(tx) = map.get(channel_id) {
                let _ = tx.send(digit.to_owned());
            }
        }
    }
}
