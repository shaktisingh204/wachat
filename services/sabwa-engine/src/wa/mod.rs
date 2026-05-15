//! WhatsApp client abstraction for SabWa.
//!
//! This module exposes a runtime-agnostic [`WaSession`] trait that the rest
//! of the engine talks to, plus a session pool that keeps one live session
//! per linked WhatsApp account.
//!
//! ## Phase 1 status
//!
//! There is **no production-grade Rust implementation of the WhatsApp
//! Multi-Device protocol** (see `SABWA_PLAN.md` §16, risk #1). For Phase 1
//! we ship a [`stub::StubSession`] that satisfies the trait, emits fake QR
//! and message-status events, and lets the rest of the codebase (routes,
//! scheduler, webhooks, anti-ban) develop in parallel.
//!
//! ## Real impl plan
//!
//! Two candidate routes when Phase 2 starts:
//!
//! 1. **Hand-rolled Rust client** built directly on the published WA Web
//!    protocol — highest investment, lowest operational complexity.
//! 2. **Baileys (Node.js) sidecar** invoked via local IPC (unix socket /
//!    nanomsg / gRPC) — reuses the proven Baileys session pool described
//!    in `SABWA_PLAN.md` §4 and §8 while keeping the rest of the engine
//!    in Rust.
//!
//! Either way, only [`stub::StubFactory`] gets replaced — every consumer
//! talks to [`session::WaSession`] through `Arc<dyn WaSession>`.

pub mod baileys;
pub mod errors;
pub mod pool;
pub mod session;
pub mod stub;

pub use baileys::{BaileysFactory, BaileysSession, BaileysSupervisor};
pub use session::{
    PairRequest, PairResponse, SendRequest, SendResponse, WaSession, WaSessionFactory,
};
