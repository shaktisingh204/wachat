use mongodb::Database;

use crate::config::Config;

pub struct AppState {
    pub cfg: Config,
    pub mongo: Database,
    pub http: reqwest::Client,
}
