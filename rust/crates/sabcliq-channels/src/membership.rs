//! Channel-membership helpers shared with sibling sabcliq crates.
//!
//! Sibling crates (messages, threads, pins, reactions, bookmarks,
//! huddles) take this crate as a path dep and call
//! [`is_channel_member`] before any list/read/write touching channel
//! contents. Keeping the lookup here avoids stringly-typed collection
//! references at the call site.

use bson::{Document, doc, oid::ObjectId};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::types::SabcliqChannel;

pub const COLL: &str = "sabcliq_channels";

/// Load a channel by id scoped to the calling tenant (`userId`).
/// Returns `NotFound` if the channel is missing or owned by another
/// tenant.
pub async fn load_channel(
    mongo: &MongoHandle,
    user_id: ObjectId,
    channel_id: ObjectId,
) -> Result<SabcliqChannel> {
    let coll = mongo.collection::<SabcliqChannel>(COLL);
    coll.find_one(doc! { "_id": channel_id, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcliq_channels.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("channel".to_owned()))
}

/// True if `caller_user_id` is in the channel's `memberUserIds`. The
/// tenant owner is always considered a member of every channel they own
/// (even when not listed explicitly), matching the dashboard-shell
/// behaviour where the workspace owner can see every channel.
pub fn is_channel_member(channel: &SabcliqChannel, caller_user_id: ObjectId) -> bool {
    if channel.user_id == caller_user_id {
        return true;
    }
    channel.member_user_ids.iter().any(|id| *id == caller_user_id)
}

/// `403 Forbidden` if the caller is not a channel member.
pub async fn require_membership(
    mongo: &MongoHandle,
    user_id: ObjectId,
    channel_id: ObjectId,
) -> Result<SabcliqChannel> {
    let channel = load_channel(mongo, user_id, channel_id).await?;
    if !is_channel_member(&channel, user_id) {
        return Err(ApiError::Forbidden(
            "not a member of this channel".to_owned(),
        ));
    }
    Ok(channel)
}

/// Convenience filter for sibling crates that store `channelId` directly.
pub fn channel_scope_filter(channel_id: ObjectId) -> Document {
    doc! { "channelId": channel_id }
}
