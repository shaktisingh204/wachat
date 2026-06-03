//! # wachat-features
//!
//! Phase 6 of the SabNode wachat → Rust port. Replaces
//! `src/app/actions/wachat-features.actions.ts` (84 server actions covering
//! chat labels, scheduled messages, contact notes, auto-reply rules,
//! broadcast segments, analytics, contact groups, opt-out / blacklist,
//! saved replies, chatbot responses, business hours, ratings, link clicks,
//! agent assignment, media library, greeting / away messages,
//! notification prefs, message tags, delivery report, import history,
//! conversation filters, API keys, scheduled broadcasts, agent statuses,
//! search, statistics, contact timeline, conversation transfer, webhook
//! logs, credit usage, bulk messaging, phone-number profiles).
//!
//! Most handlers are thin Mongo CRUD shims. Two reach Meta:
//!
//! - `POST /projects/:id/phone-numbers/:pnid/profile` — mirrors
//!   `updatePhoneProfile` (`whatsapp_business_profile`).
//! - `POST /projects/:id/bulk-send` — mirrors `sendBulkMessages`
//!   (`/messages` text bulk loop).
//!
//! ## Mount
//!
//! Routes are written **relative**. The `api` crate nests this under
//! `/v1/wachat/features`.
//!
//! ## State contract
//!
//! `router::<S>()` is generic over the caller's outer state `S`. It needs
//! exactly one bundle handle [`WachatFeaturesState`] (Mongo + MetaClient)
//! and the JWT verifier `Arc<sabnode_auth::AuthConfig>`, both pulled via
//! [`FromRef`](axum::extract::FromRef). The orchestrating `api` crate
//! constructs a single `WachatFeaturesState` at boot.
//!
//! ## Auth
//!
//! Every handler requires `AuthUser`. Per-project handlers additionally
//! enforce `user.tenant_id == project.userId.to_hex()` (mirrors
//! `wachat-send-router`). A follow-up `sabnode-tenancy` slice will swap
//! that for `project_members`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub mod analytics;
pub mod chat;
pub mod contacts;
pub mod health_automation_commerce;
pub mod helpers;
pub mod media;
pub mod messaging;
pub mod misc;
pub mod profile;
pub mod state;
pub mod tenancy;

pub use state::WachatFeaturesState;

/// Build the wachat-features router (mounted under `/v1/wachat/features`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFeaturesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- chat: labels --------------------------------------------------
        .route(
            "/projects/{project_id}/chat-labels",
            get(chat::labels::list).post(chat::labels::save),
        )
        .route("/chat-labels/{label_id}", delete(chat::labels::delete))
        .route(
            "/contacts/{contact_id}/labels/{label_id}",
            post(chat::labels::assign),
        )
        // ---- chat: notes ---------------------------------------------------
        .route(
            "/contacts/{contact_id}/notes",
            get(chat::notes::list).post(chat::notes::add),
        )
        .route("/notes/{note_id}", delete(chat::notes::delete))
        // ---- chat: ratings -------------------------------------------------
        .route(
            "/projects/{project_id}/chat-ratings",
            get(chat::ratings::list),
        )
        .route(
            "/projects/{project_id}/chat-ratings/submit",
            post(chat::ratings::submit),
        )
        // ---- chat: search/timeline/transfer/assignment ---------------------
        .route(
            "/projects/{project_id}/conversation-search",
            get(chat::search::search),
        )
        .route(
            "/projects/{project_id}/contact-timeline/{contact_id}",
            get(chat::search::timeline),
        )
        .route(
            "/contacts/{contact_id}/transfer",
            post(chat::transfer::transfer),
        )
        .route(
            "/projects/{project_id}/transfer-history",
            get(chat::transfer::history),
        )
        .route(
            "/projects/{project_id}/unassigned",
            get(chat::assignment::unassigned),
        )
        .route(
            "/contacts/{contact_id}/assign",
            post(chat::assignment::assign),
        )
        .route(
            "/projects/{project_id}/agents/statuses",
            get(chat::agent_status::list),
        )
        .route(
            "/agents/{agent_id}/status",
            post(chat::agent_status::set_status),
        )
        // ---- chat: history export -----------------------------------------
        .route(
            "/projects/{project_id}/contacts/{contact_id}/export",
            get(chat::export::export_history),
        )
        // ---- messaging: scheduled messages --------------------------------
        .route(
            "/projects/{project_id}/scheduled-messages",
            get(messaging::scheduled::list).post(messaging::scheduled::create),
        )
        .route(
            "/scheduled-messages/{message_id}/cancel",
            post(messaging::scheduled::cancel),
        )
        // ---- messaging: scheduled broadcasts ------------------------------
        .route(
            "/projects/{project_id}/scheduled-broadcasts",
            get(messaging::scheduled_broadcasts::list)
                .post(messaging::scheduled_broadcasts::create),
        )
        .route(
            "/scheduled-broadcasts/{schedule_id}/cancel",
            post(messaging::scheduled_broadcasts::cancel),
        )
        // ---- messaging: auto-reply rules ----------------------------------
        .route(
            "/projects/{project_id}/auto-reply-rules",
            get(messaging::auto_reply::list).post(messaging::auto_reply::save),
        )
        .route(
            "/auto-reply-rules/{rule_id}",
            delete(messaging::auto_reply::delete),
        )
        // ---- messaging: chatbot responses ---------------------------------
        .route(
            "/projects/{project_id}/chatbot-responses",
            get(messaging::chatbot::list).post(messaging::chatbot::save),
        )
        .route(
            "/chatbot-responses/{response_id}",
            delete(messaging::chatbot::delete),
        )
        // ---- messaging: saved replies -------------------------------------
        .route(
            "/projects/{project_id}/saved-replies",
            get(messaging::saved_replies::list).post(messaging::saved_replies::save),
        )
        .route(
            "/saved-replies/{reply_id}",
            delete(messaging::saved_replies::delete),
        )
        // ---- messaging: quick-reply categories ----------------------------
        .route(
            "/projects/{project_id}/quick-reply-categories",
            get(messaging::quick_reply::list).post(messaging::quick_reply::save),
        )
        // ---- messaging: tags ---------------------------------------------
        .route(
            "/projects/{project_id}/message-tags",
            get(messaging::tags::list).post(messaging::tags::save),
        )
        .route("/message-tags/{tag_id}", delete(messaging::tags::delete))
        // ---- messaging: bulk send -----------------------------------------
        .route(
            "/projects/{project_id}/bulk-send",
            post(messaging::bulk::send_bulk),
        )
        // ---- contacts: groups --------------------------------------------
        .route(
            "/projects/{project_id}/contact-groups",
            get(contacts::groups::list).post(contacts::groups::save),
        )
        .route(
            "/contact-groups/{group_id}",
            delete(contacts::groups::delete),
        )
        // ---- contacts: opt-out -------------------------------------------
        .route(
            "/projects/{project_id}/opt-out",
            get(contacts::opt_out::list).post(contacts::opt_out::add),
        )
        .route("/opt-out/{opt_out_id}", delete(contacts::opt_out::remove))
        // ---- contacts: blocked -------------------------------------------
        .route(
            "/projects/{project_id}/blocked-contacts",
            get(contacts::blocked::list).post(contacts::blocked::add),
        )
        .route(
            "/blocked-contacts/{blocked_id}",
            delete(contacts::blocked::remove),
        )
        // ---- contacts: blacklist -----------------------------------------
        .route(
            "/projects/{project_id}/blacklist",
            get(contacts::blacklist::list).post(contacts::blacklist::add),
        )
        .route(
            "/projects/{project_id}/blacklist/bulk",
            post(contacts::blacklist::bulk_add),
        )
        .route(
            "/blacklist/{blacklist_id}",
            delete(contacts::blacklist::remove),
        )
        // ---- contacts: tags ----------------------------------------------
        .route(
            "/projects/{project_id}/conversation-tags",
            get(contacts::tags::list),
        )
        // ---- contacts: broadcast segments --------------------------------
        .route(
            "/projects/{project_id}/broadcast-segments",
            get(contacts::segments::list).post(contacts::segments::save),
        )
        .route(
            "/broadcast-segments/{segment_id}",
            delete(contacts::segments::delete),
        )
        // ---- analytics ---------------------------------------------------
        .route(
            "/projects/{project_id}/analytics/templates",
            get(analytics::templates::report),
        )
        .route(
            "/projects/{project_id}/analytics/messages",
            get(analytics::messages::report),
        )
        .route(
            "/projects/{project_id}/analytics/agents",
            get(analytics::agents::performance),
        )
        .route(
            "/projects/{project_id}/analytics/delivery",
            get(analytics::delivery::report),
        )
        .route(
            "/projects/{project_id}/analytics/statistics",
            get(analytics::statistics::report),
        )
        .route(
            "/projects/{project_id}/analytics/credits",
            get(analytics::credits::usage),
        )
        .route(
            "/projects/{project_id}/analytics/link-clicks",
            get(analytics::link_clicks::list),
        )
        // ---- profile: business hours, greeting, away, prefs --------------
        .route(
            "/projects/{project_id}/business-hours",
            get(profile::business_hours::get).post(profile::business_hours::save),
        )
        .route(
            "/projects/{project_id}/greeting",
            get(profile::greeting::get).post(profile::greeting::save),
        )
        .route(
            "/projects/{project_id}/away",
            get(profile::away::get).post(profile::away::save),
        )
        .route(
            "/projects/{project_id}/notification-preferences",
            get(profile::notification_prefs::get).post(profile::notification_prefs::save),
        )
        .route(
            "/projects/{project_id}/phone-numbers",
            get(profile::phone_profiles::list),
        )
        .route(
            "/projects/{project_id}/phone-numbers/{phone_number_id}/profile",
            post(profile::phone_profiles::update),
        )
        // ---- media library -----------------------------------------------
        .route(
            "/projects/{project_id}/media",
            get(media::library::list).post(media::library::save),
        )
        .route("/media/{media_id}", delete(media::library::delete))
        // ---- misc: api keys, webhook logs, conversation filters,
        //           import history -------------------------------------------
        .route(
            "/projects/{project_id}/api-keys",
            get(misc::api_keys::list).post(misc::api_keys::create),
        )
        .route("/api-keys/{key_id}/revoke", post(misc::api_keys::revoke))
        .route(
            "/projects/{project_id}/webhook-logs",
            get(misc::webhook_logs::list),
        )
        .route(
            "/projects/{project_id}/import-history",
            get(misc::import_history::list),
        )
        .route(
            "/projects/{project_id}/conversation-filters",
            get(misc::conversation_filters::list).post(misc::conversation_filters::save),
        )
        .route(
            "/conversation-filters/{filter_id}",
            delete(misc::conversation_filters::delete),
        )
        // ---- health / conversational automation / commerce settings -------
        .route(
            "/waba/{waba_id}/health",
            get(health_automation_commerce::waba_health),
        )
        .route(
            "/phone-numbers/{phone_id}/health",
            get(health_automation_commerce::phone_health),
        )
        .route(
            "/phone-numbers/{phone_id}/conversational-automation",
            get(health_automation_commerce::get_conversational_automation)
                .post(health_automation_commerce::update_conversational_automation)
                .delete(health_automation_commerce::delete_conversational_automation),
        )
        .route(
            "/phone-numbers/{phone_id}/commerce-settings",
            get(health_automation_commerce::get_commerce_settings)
                .post(health_automation_commerce::update_commerce_settings),
        )
}
