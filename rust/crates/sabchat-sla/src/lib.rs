//! # sabchat-sla
//!
//! Axum router for the SabChat SLA policies HTTP surface. Mounted under
//! `/v1/sabchat/sla` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/sla", sabchat_sla::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Owns the `sabchat_sla_policies` collection plus the two derived
//! endpoints that read it:
//!
//! | HTTP route                                | Handler                  |
//! |-------------------------------------------|--------------------------|
//! | `POST   /policies`                        | [`handlers::create_policy`] |
//! | `GET    /policies`                        | [`handlers::list_policies`] |
//! | `GET    /policies/{id}`                   | [`handlers::get_policy`]    |
//! | `PATCH  /policies/{id}`                   | [`handlers::update_policy`] |
//! | `DELETE /policies/{id}`                   | [`handlers::delete_policy`] |
//! | `POST   /apply/{conversationId}`          | [`handlers::apply_to_conversation`] — pick the most-specific active policy, compute the three due-at timestamps, write them onto `conversation.sla.*`. |
//! | `POST   /sweep`                           | [`handlers::sweep`] — recompute `breached` for every open conversation in the tenant. Cron-callable. |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor and is scoped to the caller's `tenantId` claim. The
//! `apply` and `sweep` endpoints additionally filter the conversation
//! collection by the same `tenantId`, so a token issued for tenant A
//! can never stamp a conversation owned by tenant B.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatSlaState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.
//!
//! ## Public helper — [`pick_policy_for`]
//!
//! Other SabChat crates (`sabchat-conversations` on create,
//! `sabchat-messages` on first-response / next-response transitions)
//! need to ask "which SLA policy applies to this conversation?"
//! without re-implementing the matching rules. [`pick_policy_for`]
//! exposes the same most-specific-wins lookup the `apply` endpoint
//! uses, returning the raw `bson::Document` so callers can do their
//! own due-at math against whichever anchor timestamp they have in
//! hand.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

pub use state::SabChatSlaState;

/// Mongo collection holding tenant-scoped SLA policy documents.
pub const SLA_POLICIES_COLL: &str = "sabchat_sla_policies";

/// Mongo collection holding SabChat conversations — owned by
/// `sabchat-conversations` but read / patched by the `apply` and
/// `sweep` endpoints here.
pub const CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// Build the SabChat SLA router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/sla`):
///
/// ```text
/// POST   /policies                       — create_policy
/// GET    /policies                       — list_policies
/// GET    /policies/{id}                  — get_policy
/// PATCH  /policies/{id}                  — update_policy
/// DELETE /policies/{id}                  — delete_policy
/// POST   /apply/{conversationId}         — apply_to_conversation
/// POST   /sweep                          — sweep
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatSlaState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal `/sweep` and `/apply/...`
/// prefixes are registered separately from the `/policies/{id}`
/// pattern, so there is no ambiguity in axum's matcher.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatSlaState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- policies collection -------------------------------------------
        .route(
            "/policies",
            post(handlers::create_policy).get(handlers::list_policies),
        )
        .route(
            "/policies/{id}",
            get(handlers::get_policy)
                .patch(handlers::update_policy)
                .delete(handlers::delete_policy),
        )
        // ---- derived endpoints --------------------------------------------
        .route("/apply/{conversationId}", post(handlers::apply_to_conversation))
        .route("/sweep", post(handlers::sweep))
}

// ===========================================================================
// Public helper — most-specific active policy lookup
// ===========================================================================

/// Pick the most-specific active SLA policy that matches a given
/// conversation. Returns the raw `bson::Document` so callers can do
/// their own due-at math against whichever anchor timestamp they have
/// in hand (`created_at` for first-response, `last_message_at` for
/// next-response, etc.).
///
/// Matching rules (mirrors `handlers::apply_to_conversation`):
///
/// 1. Load the conversation by `(_id, tenantId)` — tenant isolation is
///    non-negotiable. Returns `Ok(None)` if the conversation does not
///    exist in the tenant.
/// 2. Load every `active == true` SLA policy for the tenant.
/// 3. For each policy compute a specificity score:
///    * `+2` if `applies_to.inboxIds` contains the conversation's
///      `inboxId`.
///    * `+1` if `applies_to.priorities` contains the conversation's
///      `priority`.
///    * Wildcards (a field set to `None` / an empty list) always
///      match and contribute `0` to the score.
///    * If `applies_to.inboxIds` is **set** but does **not** contain
///      the conversation's inbox, the policy is rejected. Same for
///      `priorities`.
/// 4. The policy with the highest score wins. Ties are broken
///    deterministically by `updated_at` descending (most-recently
///    updated wins) so callers see stable behaviour.
/// 5. If no policy matches, `Ok(None)`.
///
/// Errors propagate as `anyhow::Error` (callers in handler context
/// wrap them in `ApiError::Internal`).
pub async fn pick_policy_for(
    mongo: &MongoHandle,
    tenant_id: &str,
    conversation_id: &str,
) -> anyhow::Result<Option<Document>> {
    use anyhow::Context;

    let tenant_oid = ObjectId::parse_str(tenant_id)
        .with_context(|| format!("tenant_id `{tenant_id}` is not a valid ObjectId"))?;
    let convo_oid = ObjectId::parse_str(conversation_id)
        .with_context(|| format!("conversation_id `{conversation_id}` is not a valid ObjectId"))?;

    // 1. Conversation — scoped by tenant.
    let convo_coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let convo = match convo_coll
        .find_one(doc! { "_id": convo_oid, "tenantId": tenant_oid })
        .await
        .context("sabchat_conversations.find_one")?
    {
        Some(c) => c,
        None => return Ok(None),
    };

    let inbox_id = convo.get_object_id("inboxId").ok();
    let priority = convo
        .get_str("priority")
        .ok()
        .map(str::to_owned)
        .unwrap_or_else(|| "medium".to_owned());

    // 2. Candidate policies — active + tenant-scoped, sorted by
    //    `updatedAt` desc so deterministic tie-breaking falls out of
    //    the iteration order.
    let pol_coll = mongo.collection::<Document>(SLA_POLICIES_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .build();
    let cursor = pol_coll
        .find(doc! { "tenantId": tenant_oid, "active": true })
        .with_options(opts)
        .await
        .context("sabchat_sla_policies.find")?;
    let candidates: Vec<Document> = cursor
        .try_collect()
        .await
        .context("sabchat_sla_policies.collect")?;

    // 3. Score every candidate; reject hard non-matches.
    let mut best: Option<(i32, Document)> = None;
    for policy in candidates {
        if let Some(score) = score_policy(&policy, inbox_id.as_ref(), &priority) {
            if best.as_ref().map_or(true, |(s, _)| score > *s) {
                best = Some((score, policy));
            }
        }
    }

    Ok(best.map(|(_, doc)| doc))
}

/// Score one policy against a conversation. Returns `None` if the
/// policy has a hard non-match (a field is set but the conversation
/// is not in the listed values). Public so `handlers::apply_to_conversation`
/// can reuse it without going through Mongo a second time.
pub(crate) fn score_policy(
    policy: &Document,
    inbox_id: Option<&ObjectId>,
    priority: &str,
) -> Option<i32> {
    let applies_to = policy.get_document("appliesTo").ok();
    let mut score: i32 = 0;

    if let Some(applies) = applies_to {
        // ---- inbox match ---------------------------------------------------
        match applies.get("inboxIds") {
            None | Some(Bson::Null) => {}
            Some(Bson::Array(arr)) if arr.is_empty() => {}
            Some(Bson::Array(arr)) => {
                let matched = inbox_id
                    .map(|target| arr.iter().any(|b| inbox_matches(b, target)))
                    .unwrap_or(false);
                if !matched {
                    return None;
                }
                score += 2;
            }
            // Unexpected type → treat as wildcard rather than panic.
            Some(_) => {}
        }

        // ---- priority match -----------------------------------------------
        match applies.get("priorities") {
            None | Some(Bson::Null) => {}
            Some(Bson::Array(arr)) if arr.is_empty() => {}
            Some(Bson::Array(arr)) => {
                let matched = arr.iter().any(|b| match b {
                    Bson::String(s) => s.eq_ignore_ascii_case(priority),
                    _ => false,
                });
                if !matched {
                    return None;
                }
                score += 1;
            }
            Some(_) => {}
        }
    }

    Some(score)
}

/// Compare one entry of the policy's `inboxIds` array against a target
/// `ObjectId`. Accepts both `Bson::ObjectId` (canonical form) and
/// `Bson::String` (hex) so policies authored from either the Rust
/// crates or the Next.js shim round-trip cleanly.
fn inbox_matches(entry: &Bson, target: &ObjectId) -> bool {
    match entry {
        Bson::ObjectId(o) => o == target,
        Bson::String(s) => ObjectId::parse_str(s).map_or(false, |o| &o == target),
        _ => false,
    }
}
