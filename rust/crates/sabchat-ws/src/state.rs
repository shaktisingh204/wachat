//! State slice consumed by the SabChat websocket router.
//!
//! All the router needs is a clone of the per-process [`WsHub`] so each
//! upgraded connection can subscribe to the same broadcast channel that
//! sibling crates publish into.
//!
//! The hub is `Clone` (it wraps a `broadcast::Sender`, which is itself
//! cheap to clone — internally `Arc`-backed), so this struct is cheap to
//! pass around in `with_state`.

use crate::WsHub;

/// Bundle of handles the websocket router needs. Today that is just the
/// in-process [`WsHub`] — no Mongo, no Redis, because the WS surface is
/// pure fan-out. Persistence of inbound events lives in the publishing
/// crates (e.g. `sabchat-messages`).
#[derive(Clone)]
pub struct SabChatWsState {
    pub hub: WsHub,
}

impl SabChatWsState {
    pub fn new(hub: WsHub) -> Self {
        Self { hub }
    }
}
