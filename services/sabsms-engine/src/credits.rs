use anyhow::{Context, Result};
use std::sync::Arc;

use crate::{
    state::AppState,
    types::{CreditFinaliseRequest, CreditReserveRequest, CreditReserveResponse},
};

/// Call the Next-side `/api/sabsms/credits?op=reserve` callback. Returns
/// the issued reservation token (or rejects).
pub async fn reserve(state: &Arc<AppState>, req: &CreditReserveRequest) -> Result<CreditReserveResponse> {
    let url = format!(
        "{}/api/sabsms/credits?op=reserve",
        state.cfg.app_callback_url.trim_end_matches('/'),
    );
    let resp = state
        .http
        .post(&url)
        .header("X-Sabsms-Service-Token", &state.cfg.service_token)
        .json(req)
        .send()
        .await
        .with_context(|| format!("POST {}", url))?;
    if !resp.status().is_success() {
        anyhow::bail!("credit reserve callback returned {}", resp.status());
    }
    Ok(resp.json::<CreditReserveResponse>().await?)
}

pub async fn finalise(state: &Arc<AppState>, req: &CreditFinaliseRequest) -> Result<()> {
    let url = format!(
        "{}/api/sabsms/credits?op=finalise",
        state.cfg.app_callback_url.trim_end_matches('/'),
    );
    let resp = state
        .http
        .post(&url)
        .header("X-Sabsms-Service-Token", &state.cfg.service_token)
        .json(req)
        .send()
        .await
        .with_context(|| format!("POST {}", url))?;
    if !resp.status().is_success() {
        tracing::warn!(status = %resp.status(), "credit finalise callback non-2xx");
    }
    Ok(())
}
