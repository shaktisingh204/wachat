//! # sabchat-sabflow-nodes
//!
//! Phase — axum router that publishes SabChat as a set of SabFlow node
//! descriptors and exposes the HTTP entry points SabFlow's executor
//! calls when it fires an action. Mounted under
//! `/v1/sabchat/sabflow` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/sabflow", sabchat_sabflow_nodes::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Two surfaces share this router:
//!
//! 1. **Descriptor catalogue** — `GET /nodes` returns the JSON
//!    descriptors for six **triggers** (`sabchat.conversation.created`,
//!    `…assigned`, `…resolved`, `sabchat.message.received`,
//!    `sabchat.sla.breached`, `sabchat.csat.submitted`) and six
//!    **actions** (`sabchat.action.send_message`,
//!    `…add_label`, `…set_status`, `…set_priority`,
//!    `…set_assignee`, `…run_macro`). SabFlow's executor reads this
//!    list at boot and the UI re-fetches it on each block-picker open.
//!
//! 2. **Action endpoints** — `POST /actions/{name}` is the HTTP entry
//!    point SabFlow's executor calls when a workflow run reaches a
//!    SabChat action node. Each endpoint mirrors the corresponding
//!    `sabchat-conversations` / `sabchat-messages` / `sabchat-macros`
//!    write inline (we deliberately do **not** import those crates —
//!    see the [`crate::handlers`] header for rationale).
//!
//! Trigger emission is **not** owned here. The SabChat router crates
//! emit their own events into the audit log; SabFlow's executor
//! subscribes via webhook or polling and matches against the trigger
//! `event` names published in our descriptor catalogue. This crate
//! defines the contract — it does not implement the dispatch.
//!
//! | Route                                  | Handler                       |
//! |----------------------------------------|-------------------------------|
//! | `GET    /nodes`                        | [`handlers::list_nodes`]      |
//! | `POST   /actions/send-message`         | [`handlers::action_send_message`] |
//! | `POST   /actions/add-label`            | [`handlers::action_add_label`]    |
//! | `POST   /actions/set-status`           | [`handlers::action_set_status`]   |
//! | `POST   /actions/set-priority`         | [`handlers::action_set_priority`] |
//! | `POST   /actions/set-assignee`         | [`handlers::action_set_assignee`] |
//! | `POST   /actions/run-macro`            | [`handlers::action_run_macro`]    |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. The SabFlow executor is expected to mint a service JWT
//! scoped to the workflow's tenant before calling us; every Mongo write
//! is filtered on `tenantId == ObjectId::parse_str(&auth.tenant_id)` so
//! a cross-tenant call surfaces as a plain `404 NOT_FOUND` without
//! leaking existence.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatSabflowNodesState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod descriptors;
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use descriptors::descriptors;
pub use dto::{
    ActionAck, AddLabelBody, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
    NodePropertyType, NodesResponse, RunMacroBody, SendMessageBody, SetAssigneeBody,
    SetPriorityBody, SetStatusBody,
};
pub use state::SabChatSabflowNodesState;

/// Build the SabChat → SabFlow bridge router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/sabflow`):
///
/// ```text
/// GET    /nodes                       — list_nodes
/// POST   /actions/send-message        — action_send_message
/// POST   /actions/add-label           — action_add_label
/// POST   /actions/set-status          — action_set_status
/// POST   /actions/set-priority        — action_set_priority
/// POST   /actions/set-assignee        — action_set_assignee
/// POST   /actions/run-macro           — action_run_macro
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatSabflowNodesState`] bundle and the JWT verifier config;
/// both are pulled via [`FromRef`] so the router does not have to know
/// about a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatSabflowNodesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- descriptor catalogue ----------------------------------------
        .route("/nodes", get(handlers::list_nodes))
        // ---- actions -----------------------------------------------------
        .route(
            "/actions/send-message",
            post(handlers::action_send_message),
        )
        .route("/actions/add-label", post(handlers::action_add_label))
        .route("/actions/set-status", post(handlers::action_set_status))
        .route("/actions/set-priority", post(handlers::action_set_priority))
        .route("/actions/set-assignee", post(handlers::action_set_assignee))
        .route("/actions/run-macro", post(handlers::action_run_macro))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn descriptors_are_published() {
        // Quick smoke test — the catalogue helper is exposed at the
        // crate root so external callers (the api crate's bootstrap
        // path, integration tests) can read the descriptors without
        // going through HTTP.
        let nodes = descriptors();
        assert!(!nodes.is_empty(), "descriptor catalogue must not be empty");
    }
}
