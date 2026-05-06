//! Public, unauthenticated redirect resolver. The browser request that
//! lands at `/[shortCode]` (or `/s/[shortCode]`) carries no JWT — the TS
//! page server-resolves the original URL via this endpoint.
//!
//! Kept distinct from `router.rs` because it must NOT require AuthUser.

use axum::{Json, extract::State};
use sabnode_common::Result;

use crate::{
    state::UrlShortenerState,
    store::{TrackClickQuery, TrackClickResult, track_click},
};

pub async fn resolve(
    State(s): State<UrlShortenerState>,
    Json(q): Json<TrackClickQuery>,
) -> Result<Json<TrackClickResult>> {
    let res = track_click(&s.mongo, q).await?;
    Ok(Json(res))
}
