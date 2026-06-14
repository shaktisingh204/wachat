//! Engine configuration, loaded from the environment.

/// Runtime configuration for the SabCall voice engine.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Master gate — when false the engine boots the HTTP server (for health
    /// checks) but does NOT connect to Asterisk or run the Stasis loop.
    pub enabled: bool,
    /// HTTP listen port (default 4005).
    pub port: u16,
    /// Bearer token the Next.js side must present on control endpoints.
    pub engine_token: Option<String>,

    /// Mongo connection string + database name.
    pub mongodb_uri: String,
    pub mongodb_db: String,

    /// Asterisk ARI base, e.g. `http://127.0.0.1:8088`.
    pub ari_base_url: String,
    /// Asterisk ARI websocket base, e.g. `ws://127.0.0.1:8088`.
    pub ari_ws_url: String,
    pub ari_username: String,
    pub ari_password: String,
    /// The Stasis application name registered in the dialplan.
    pub ari_app: String,

    /// Default greeting media URI played when an application has no audio of
    /// its own (Asterisk media id, e.g. `sound:hello-world`).
    pub default_greeting: String,

    /// Optional HTTP TTS endpoint — POST `{text, format}` → audio bytes. When
    /// unset, `Say` falls back to the default greeting.
    pub tts_url: Option<String>,
    /// Optional HTTP STT endpoint — POST `{audioUrl}` → `{text}`.
    pub stt_url: Option<String>,
    /// Where synthesized TTS clips are written (must be readable by Asterisk).
    pub sounds_dir: String,
    /// Optional Next.js callback URL for call events (recording done, call
    /// ended, transcript ready) — lets the app persist recordings to R2/SabFiles
    /// and CDR enrichment without the engine holding S3 creds.
    pub events_url: Option<String>,
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_owned())
}

impl EngineConfig {
    pub fn from_env() -> Self {
        let enabled = env_or("SABCALL_ENABLED", "false").eq_ignore_ascii_case("true");
        let port = env_or("PORT", "4005").parse().unwrap_or(4005);
        let engine_token = std::env::var("SABCALL_ENGINE_TOKEN")
            .ok()
            .filter(|s| !s.is_empty());

        EngineConfig {
            enabled,
            port,
            engine_token,
            mongodb_uri: env_or("MONGODB_URI", "mongodb://127.0.0.1:27017"),
            mongodb_db: env_or("MONGODB_DB", "test"),
            ari_base_url: env_or("ASTERISK_ARI_URL", "http://127.0.0.1:8088"),
            ari_ws_url: env_or("ASTERISK_ARI_WS_URL", "ws://127.0.0.1:8088"),
            ari_username: env_or("ASTERISK_ARI_USER", "sabcall"),
            ari_password: env_or("ASTERISK_ARI_PASS", "sabcall"),
            ari_app: env_or("ASTERISK_ARI_APP", "sabcall"),
            default_greeting: env_or("SABCALL_DEFAULT_GREETING", "sound:hello-world"),
            tts_url: std::env::var("SABCALL_TTS_URL").ok().filter(|s| !s.is_empty()),
            stt_url: std::env::var("SABCALL_STT_URL").ok().filter(|s| !s.is_empty()),
            sounds_dir: env_or("ASTERISK_SOUNDS_DIR", "/var/lib/asterisk/sounds/sabcall"),
            events_url: std::env::var("SABCALL_EVENTS_URL").ok().filter(|s| !s.is_empty()),
        }
    }
}
