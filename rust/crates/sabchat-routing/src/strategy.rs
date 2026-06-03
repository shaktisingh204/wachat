//! Assignment-strategy primitives shared by [`crate::handlers`] and the
//! public [`crate::next_round_robin_agent`] helper.
//!
//! The strategies live here (rather than inline in handlers) so library
//! callers — most notably SabFlow nodes that auto-assign on incoming
//! messages — can re-use the exact same selection logic the HTTP surface
//! does without having to spin up an axum router.

use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::handlers::{ASSIGNMENTS_COLL, CONVERSATIONS_COLL, INBOXES_COLL};

/// Load the inbox doc + return its `agent_ids` list. Used by every strategy
/// path so the same tenant + existence guard is enforced.
pub(crate) async fn load_inbox_agents(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
) -> Result<Vec<ObjectId>> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    let doc = coll
        .find_one(doc! { "_id": inbox_id, "tenantId": tenant_id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Inbox not found.".to_owned()))?;

    let agents = doc
        .get_array("agentIds")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_object_id())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(agents)
}

/// Round-robin pick: choose the agent in `candidates` with the fewest
/// **open** conversations on `inbox_id`. Ties are broken by the agent who
/// was assigned LEAST recently in `sabchat_assignments` (so capacity is
/// spread fairly even when load numbers match).
///
/// Returns `None` if `candidates` is empty.
pub(crate) async fn pick_round_robin(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
    candidates: &[ObjectId],
) -> Result<Option<ObjectId>> {
    if candidates.is_empty() {
        return Ok(None);
    }

    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let assignments = mongo.collection::<Document>(ASSIGNMENTS_COLL);

    // Pre-compute each candidate's open-conversation count on this inbox.
    // We issue per-agent count queries rather than a `$group` aggregation
    // because the candidate list is short (usually < 20 per inbox) and we
    // sidestep a second collection-scan path.
    let mut scored: Vec<(ObjectId, u64, i64)> = Vec::with_capacity(candidates.len());
    for agent in candidates {
        let open_count = conversations
            .count_documents(doc! {
                "tenantId": tenant_id,
                "inboxId": inbox_id,
                "assigneeId": agent,
                "status": "open",
            })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_conversations.count(round_robin)"),
                )
            })?;

        // Last-assigned tiebreaker — most-recent `at` for this agent on this
        // inbox's assignment trail. Missing history sorts FIRST (i.e. an
        // agent who has never been assigned wins the tiebreak).
        let last_at_opts = FindOptions::builder()
            .sort(doc! { "at": -1 })
            .limit(1_i64)
            .build();
        let cursor = assignments
            .find(doc! {
                "tenantId": tenant_id,
                "newAssigneeId": agent,
            })
            .with_options(last_at_opts)
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_assignments.find(round_robin)"),
                )
            })?;
        let last_docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_assignments.collect"))
        })?;
        let last_at_ms = last_docs
            .first()
            .and_then(|d| d.get_datetime("at").ok())
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(i64::MIN);

        scored.push((*agent, open_count, last_at_ms));
    }

    // Sort by (open_count ASC, last_at ASC). The lowest open count wins;
    // among ties the LEAST recently assigned agent wins.
    scored.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.2.cmp(&b.2)));
    Ok(scored.first().map(|(id, _, _)| *id))
}

/// Sticky pick: return the contact's previous assignee on this inbox if
/// they are still in `candidates`; otherwise return `None` so the caller
/// can fall back to round-robin.
pub(crate) async fn pick_sticky(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    contact_id: ObjectId,
    candidates: &[ObjectId],
) -> Result<Option<ObjectId>> {
    if candidates.is_empty() {
        return Ok(None);
    }

    // Find the contact's most recent NON-NULL assignment trail event. We
    // join through `sabchat_conversations` to scope by contact_id since
    // assignment rows don't carry it directly.
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let convo_ids: Vec<ObjectId> = {
        let cursor = conversations
            .find(doc! {
                "tenantId": tenant_id,
                "contactId": contact_id,
            })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_conversations.find(sticky)"),
                )
            })?;
        let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.collect(sticky)"),
            )
        })?;
        docs.into_iter()
            .filter_map(|d| d.get_object_id("_id").ok())
            .collect()
    };
    if convo_ids.is_empty() {
        return Ok(None);
    }

    let assignments = mongo.collection::<Document>(ASSIGNMENTS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "at": -1 })
        .limit(1_i64)
        .build();
    let cursor = assignments
        .find(doc! {
            "tenantId": tenant_id,
            "conversationId": { "$in": &convo_ids },
            "newAssigneeId": { "$ne": null },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_assignments.find(sticky)"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_assignments.collect(sticky)"))
    })?;
    let Some(row) = docs.into_iter().next() else {
        return Ok(None);
    };
    let prev = row.get_object_id("newAssigneeId").ok();
    Ok(prev.filter(|id| candidates.contains(id)))
}
