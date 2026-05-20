use anyhow::{anyhow, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub service_token: String,
    pub mongo_uri: String,
    pub mongo_db: String,
    pub redis_url: String,
    pub app_callback_url: String,
    pub worker_concurrency: usize,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("PORT")
            .or_else(|_| std::env::var("SABSMS_PORT"))
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4002);

        let service_token = std::env::var("SABSMS_ENGINE_TOKEN")
            .map_err(|_| anyhow!("SABSMS_ENGINE_TOKEN is required"))?;
        if service_token.len() < 16 {
            return Err(anyhow!("SABSMS_ENGINE_TOKEN must be >= 16 chars"));
        }

        let mongo_uri = std::env::var("MONGO_URL")
            .or_else(|_| std::env::var("MONGODB_URI"))
            .map_err(|_| anyhow!("MONGO_URL or MONGODB_URI is required"))?;
        let mongo_db = std::env::var("MONGODB_DB").unwrap_or_else(|_| "sabnode".to_string());

        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        let app_callback_url = std::env::var("SABSMS_APP_CALLBACK_URL")
            .or_else(|_| std::env::var("NEXT_PUBLIC_APP_URL"))
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        let worker_concurrency = std::env::var("SABSMS_WORKER_CONCURRENCY")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(8usize);

        Ok(Self {
            port,
            service_token,
            mongo_uri,
            mongo_db,
            redis_url,
            app_callback_url,
            worker_concurrency,
        })
    }
}
