use mongodb::Database;
use redis::aio::ConnectionManager;

use crate::config::Config;

pub struct AppState {
    pub cfg: Config,
    pub mongo: Database,
    pub redis: ConnectionManager,
    pub http: reqwest::Client,
}
