//! Email threading lookups.
//!
//! Emails group by RFC-2822 [`In-Reply-To`] / [`References`] chains. We
//! persist the bare `Message-ID` of every inbound message under
//! `provider_metadata.message_id`. To find the parent conversation for
//! a new inbound email we scan `sabchat_messages` for any previously
//! stored message whose `provider_metadata.message_id` matches **any**
//! of the inbound's `In-Reply-To` + `References` ids — the first hit's
//! `conversationId` wins.
//!
//! The lookup is **tenant-scoped**: a forged `In-Reply-To` carrying a
//! foreign tenant's message id will never resolve, because we filter on
//! `tenantId` alongside the `provider_metadata.message_id` match.

use bson::{Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

/// Mongo collection that holds the per-message threading metadata.
const MESSAGES_COLL: &str = "sabchat_messages";

/// Find the `conversation_id` for an inbound email by walking its
/// `In-Reply-To` / `References` chain. Returns `Ok(None)` when none of
/// the supplied ids match a prior message within this tenant — the
/// caller then opens a fresh conversation.
///
/// `in_reply_to` is prepended to `references` for the lookup, mirroring
/// the RFC-2822 precedence (an `In-Reply-To` value SHOULD also appear
/// in `References`, but some clients ship only one or the other; we
/// merge both into a single `$in` set).
///
/// Empty / whitespace-only ids are silently skipped; if no usable id
/// remains we short-circuit to `Ok(None)` without hitting Mongo.
pub(crate) async fn find_thread_conv_id(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    in_reply_to: Option<&str>,
    references: &[String],
) -> Result<Option<ObjectId>> {
    // Build the candidate set in first-seen order. We don't expect
    // duplicates in practice, but the upstream shim isn't required to
    // dedupe, and Mongo's `$in` doesn't care either way.
    let mut candidates: Vec<String> = Vec::with_capacity(references.len() + 1);
    if let Some(irt) = in_reply_to {
        let trimmed = strip_angle_brackets(irt);
        if !trimmed.is_empty() {
            candidates.push(trimmed);
        }
    }
    for r in references {
        let trimmed = strip_angle_brackets(r);
        if !trimmed.is_empty() && !candidates.iter().any(|x| x == &trimmed) {
            candidates.push(trimmed);
        }
    }
    if candidates.is_empty() {
        return Ok(None);
    }

    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    // The match traverses the nested `provider_metadata.message_id`
    // field. Mongo can use a compound index on
    // `(tenantId, providerMetadata.messageId)` here; without one the
    // query degrades to a tenant-scoped collection scan, which is still
    // bounded because individual tenants rarely cross five-figure
    // message counts per inbox.
    let hit = coll
        .find_one(doc! {
            "tenantId": tenant_id,
            "providerMetadata.messageId": { "$in": &candidates },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(thread)"))
        })?;

    Ok(hit.and_then(|d| d.get_object_id("conversationId").ok()))
}

/// Strip surrounding angle brackets from a bare `Message-ID` value and
/// trim whitespace. Tolerates both already-stripped and bracketed
/// inputs so the upstream shim doesn't have to be perfectly consistent.
fn strip_angle_brackets(s: &str) -> String {
    let trimmed = s.trim();
    trimmed
        .strip_prefix('<')
        .and_then(|t| t.strip_suffix('>'))
        .map(|t| t.to_owned())
        .unwrap_or_else(|| trimmed.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_brackets() {
        assert_eq!(strip_angle_brackets("<abc@x>"), "abc@x");
        assert_eq!(strip_angle_brackets("  <abc@x>  "), "abc@x");
        assert_eq!(strip_angle_brackets("abc@x"), "abc@x");
        assert_eq!(strip_angle_brackets(""), "");
    }
}
