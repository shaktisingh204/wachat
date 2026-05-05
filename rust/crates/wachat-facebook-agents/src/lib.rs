//! # wachat-facebook-agents
//!
//! Ports the **Agents / Knowledge / Moderation / Audience** slice of
//! `src/app/actions/facebook.actions.ts` to the Rust BFF — 14 server
//! actions:
//!
//! | TS action                          | HTTP                                                  |
//! |------------------------------------|-------------------------------------------------------|
//! | `getFacebookAgents`                | `GET    /projects/{id}/agents`                        |
//! | `createFacebookAgent`              | `POST   /projects/{id}/agents`                        |
//! | `updateFacebookAgent`              | `PATCH  /agents/{id}`                                 |
//! | `deleteFacebookAgent`              | `DELETE /agents/{id}`                                 |
//! | `getKnowledgeDocs`                 | `GET    /projects/{id}/knowledge-docs`                |
//! | `uploadKnowledgeDoc`               | `POST   /projects/{id}/knowledge-docs`                |
//! | `deleteKnowledgeDoc`               | `DELETE /knowledge-docs/{id}`                         |
//! | `getModerationRules`               | `GET    /projects/{id}/moderation-rules`              |
//! | `saveModerationRule`               | `POST   /projects/{id}/moderation-rules`              |
//! | `deleteModerationRule`             | `DELETE /moderation-rules/{id}`                       |
//! | `handleUpdateCommentAutoReply`     | `PUT    /projects/{id}/comment-auto-reply`            |
//! | `getAudienceSegments`              | `GET    /projects/{id}/audience-segments`             |
//! | `saveAudienceSegment`              | `POST   /projects/{id}/audience-segments`             |
//! | `deleteAudienceSegment`            | `DELETE /audience-segments/{id}`                      |
//!
//! Mongo collections: `facebook_agents`, `knowledge_docs`,
//! `fb_moderation_rules`, `fb_audience_segments`, plus `projects` for
//! tenancy and the comment-auto-reply settings field.
//!
//! **Multipart binary stays in TS.** `uploadKnowledgeDoc` accepts an
//! already-parsed text body (and an optional `blobUrl` reference); the
//! TS shim handles the FormData → blob upload first.
//!
//! Mount under `/v1/facebook/agents` from the `api` crate:
//!
//! ```ignore
//! .nest("/v1/facebook/agents", wachat_facebook_agents::router::<AppState>())
//! ```

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookAgentsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookAgentsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Agents
        .route(
            "/projects/{project_id}/agents",
            get(handlers::get_agents).post(handlers::create_agent),
        )
        .route(
            "/agents/{agent_id}",
            patch(handlers::update_agent).delete(handlers::delete_agent),
        )
        // Knowledge base
        .route(
            "/projects/{project_id}/knowledge-docs",
            get(handlers::get_knowledge_docs).post(handlers::upload_knowledge_doc),
        )
        .route(
            "/knowledge-docs/{doc_id}",
            delete(handlers::delete_knowledge_doc),
        )
        // Moderation rules
        .route(
            "/projects/{project_id}/moderation-rules",
            get(handlers::get_moderation_rules).post(handlers::save_moderation_rule),
        )
        .route(
            "/moderation-rules/{rule_id}",
            delete(handlers::delete_moderation_rule),
        )
        // Comment auto-reply (lives on the project document)
        .route(
            "/projects/{project_id}/comment-auto-reply",
            put(handlers::update_comment_auto_reply),
        )
        // Audience segments
        .route(
            "/projects/{project_id}/audience-segments",
            get(handlers::get_audience_segments).post(handlers::save_audience_segment),
        )
        .route(
            "/audience-segments/{segment_id}",
            delete(handlers::delete_audience_segment),
        )
}
