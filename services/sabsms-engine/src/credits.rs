use anyhow::{Context, Result};
use std::sync::Arc;

use crate::{
    state::AppState,
    types::{
        CampaignBatchReserveRequest, CreditFinaliseRequest, CreditReserveRequest,
        CreditReserveResponse,
    },
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

/// Call the Next-side `/api/sabsms/credits?op=reserve-batch` callback —
/// a single hold covering a claimed campaign batch. Used as an
/// affordability GATE by the campaign ticker: on approval the hold is
/// released immediately via [`release_batch`] because the worker takes
/// the real per-message hold at send time.
pub async fn reserve_batch(
    state: &Arc<AppState>,
    req: &CampaignBatchReserveRequest,
) -> Result<CreditReserveResponse> {
    let url = format!(
        "{}/api/sabsms/credits?op=reserve-batch",
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
        anyhow::bail!("credit reserve-batch callback returned {}", resp.status());
    }
    Ok(resp.json::<CreditReserveResponse>().await?)
}

/// Release a batch hold taken by [`reserve_batch`] (charge=false). The
/// finalise op requires a `messageId`; batch reservations are keyed by
/// campaign, so the campaign id is presented in that slot — the ledger
/// resolves the reservation purely by token. Best-effort: an
/// un-released hold self-expires via the ledger's 15-min TTL sweep.
pub async fn release_batch(
    state: &Arc<AppState>,
    workspace_id: &str,
    campaign_id: &str,
    reservation_token: &str,
) {
    let req = CreditFinaliseRequest {
        workspace_id: workspace_id.to_string(),
        message_id: campaign_id.to_string(),
        reservation_token: reservation_token.to_string(),
        actual_cost: 0,
        charge: false,
    };
    if let Err(e) = finalise(state, &req).await {
        tracing::warn!(?e, campaign_id, "failed to release batch credit hold (TTL sweep will refund)");
    }
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
