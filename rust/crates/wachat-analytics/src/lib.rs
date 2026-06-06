//! Wachat analytics crate — port of `src/app/actions/whatsapp-analytics.actions.ts`.
//!
//! Five endpoints under `/v1/wachat/analytics`:
//!  - Meta Graph passthroughs (`conversation_analytics`, `template_analytics`,
//!    `messaging_limit_tier`)
//!  - Local Mongo aggregations over `outgoing_messages` / `incoming_messages`
//!    and `broadcasts`.

pub mod agent_hourly;
pub mod agent_performance;
pub mod broadcasts;
pub mod conversation;
pub mod dashboard_summary;
pub mod local_messages;
pub mod messaging_limit;
pub mod router;
pub mod state;
pub mod template;

pub use router::router;
pub use state::WachatAnalyticsState;
