use anyhow::{anyhow, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub service_token: String,
    pub mongo_uri: String,
    pub mongo_db: String,
    /// 64 hex chars (32 bytes) — matches `SABMAIL_CREDS_KEY` / `SABSMS_CREDS_KEY`
    /// used by `src/lib/sabmail/credentials.ts`. Optional at boot; send fails
    /// with a clear error if a cipher needs decrypting and it is absent.
    pub creds_key_hex: Option<String>,
    pub app_callback_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("PORT")
            .or_else(|_| std::env::var("SABMAIL_PORT"))
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4003);

        let service_token = std::env::var("SABMAIL_ENGINE_TOKEN")
            .map_err(|_| anyhow!("SABMAIL_ENGINE_TOKEN is required"))?;
        if service_token.len() < 16 {
            return Err(anyhow!("SABMAIL_ENGINE_TOKEN must be >= 16 chars"));
        }

        let mongo_uri = std::env::var("MONGO_URL")
            .or_else(|_| std::env::var("MONGODB_URI"))
            .map_err(|_| anyhow!("MONGO_URL or MONGODB_URI is required"))?;
        let mongo_db = std::env::var("MONGODB_DB").unwrap_or_else(|_| "sabnode".to_string());

        let creds_key_hex = std::env::var("SABMAIL_CREDS_KEY")
            .or_else(|_| std::env::var("SABSMS_CREDS_KEY"))
            .ok()
            .filter(|s| s.len() == 64);

        let app_callback_url = std::env::var("SABMAIL_APP_CALLBACK_URL")
            .or_else(|_| std::env::var("NEXT_PUBLIC_APP_URL"))
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        Ok(Self {
            port,
            service_token,
            mongo_uri,
            mongo_db,
            creds_key_hex,
            app_callback_url,
        })
    }
}
