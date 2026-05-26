//! Mongo aggregation pipeline builders for the SabChat reports surface.
//!
//! Every builder returns `Vec<bson::Document>` so the calling handler
//! can pass the pipeline directly to
//! [`mongodb::Collection::aggregate`]. Centralising the pipelines here
//! keeps the handlers focused on shaping the HTTP response and avoids
//! sprawling `doc!` literals inside `match` arms.
//!
//! ## Conventions
//!
//! * The tenant filter is always the first `$match` stage so Mongo can
//!   restrict the scan to a single tenant's slice of the collection
//!   before any of the heavier transformations run.
//! * Window bounds are passed as `bson::DateTime` rather than chrono so
//!   the resulting documents drop straight into the driver without
//!   another conversion hop.
//! * Pipelines target the camelCase wire field names used by the
//!   `sabchat-types` Mongo documents (`tenantId`, `createdAt`,
//!   `firstResponseAt`, `inboxId`, `assigneeId`, `channelType`, …).
//!
//! Helpers are crate-private — the public surface is the handlers.

use bson::{Document, doc, oid::ObjectId};

use crate::dto::VolumeGroupBy;

// ---------------------------------------------------------------------------
// Group-key formats for $dateToString. Keeping the strftime-style format
// strings in one place stops "%G-W%V" / "%Y-%m-%d" drift between the
// pipeline and the response payload.
// ---------------------------------------------------------------------------

/// `$dateToString` format for an `hour | day | week` bucket.
fn group_format(group_by: VolumeGroupBy) -> &'static str {
    match group_by {
        VolumeGroupBy::Hour => "%Y-%m-%dT%H:00:00Z",
        VolumeGroupBy::Day => "%Y-%m-%d",
        // ISO week — `%G` is the ISO-week year, `%V` the ISO week number.
        VolumeGroupBy::Week => "%G-W%V",
    }
}

// ===========================================================================
// GET /live
// ===========================================================================

/// Pipeline for `GET /live` — single aggregation over
/// `sabchat_conversations` that emits one document with the four
/// counters, the longest wait, and the queue-by-inbox array (already
/// joined to the inbox name).
///
/// Status counts use `$cond` rather than `$facet` so the whole snapshot
/// comes back in a single round-trip and a single document.
pub(crate) fn build_live_pipeline(tenant: ObjectId, now: bson::DateTime) -> Vec<Document> {
    vec![
        // Restrict to the tenant first — this is the only stage that
        // benefits from the (tenantId, status) compound index.
        doc! { "$match": { "tenantId": tenant } },
        // Compute the per-conversation wait (in minutes) so the
        // `$group` stage can `$max` it without recomputing per-status.
        doc! {
            "$addFields": {
                "_waitMinutes": {
                    "$cond": [
                        { "$in": [ "$status", ["open", "pending"] ] },
                        {
                            "$divide": [
                                { "$subtract": [ now, "$createdAt" ] },
                                60000_i64,
                            ]
                        },
                        0_i64,
                    ]
                }
            }
        },
        // One $group rolls up the global counters; queue-by-inbox is
        // handled by a separate $facet branch below.
        doc! {
            "$facet": {
                "totals": [
                    {
                        "$group": {
                            "_id": null,
                            "openCount": {
                                "$sum": { "$cond": [ { "$eq": ["$status", "open"] }, 1_i64, 0_i64 ] }
                            },
                            "pendingCount": {
                                "$sum": { "$cond": [ { "$eq": ["$status", "pending"] }, 1_i64, 0_i64 ] }
                            },
                            "snoozedCount": {
                                "$sum": { "$cond": [ { "$eq": ["$status", "snoozed"] }, 1_i64, 0_i64 ] }
                            },
                            "slaBreachedCount": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                { "$in": ["$status", ["open", "pending"]] },
                                                { "$eq": ["$sla.breached", true] },
                                            ]
                                        },
                                        1_i64,
                                        0_i64,
                                    ]
                                }
                            },
                            "longestWaitMinutes": { "$max": "$_waitMinutes" },
                        }
                    }
                ],
                "queue": [
                    // Only open / pending count toward the queue — snoozed
                    // conversations are not currently waiting on an agent.
                    { "$match": { "status": { "$in": ["open", "pending"] } } },
                    {
                        "$group": {
                            "_id": "$inboxId",
                            "count": { "$sum": 1_i64 },
                        }
                    },
                    {
                        "$lookup": {
                            "from": crate::INBOXES_COLL,
                            "localField": "_id",
                            "foreignField": "_id",
                            "as": "inbox",
                        }
                    },
                    { "$unwind": { "path": "$inbox", "preserveNullAndEmptyArrays": true } },
                    {
                        "$project": {
                            "_id": 0,
                            "inboxId": { "$toString": "$_id" },
                            "name": { "$ifNull": ["$inbox.name", ""] },
                            "count": 1,
                        }
                    },
                    { "$sort": { "count": -1_i32 } },
                ],
            }
        },
    ]
}

// ===========================================================================
// GET /volume
// ===========================================================================

/// Pipeline for the **conversations** half of `GET /volume`. Groups
/// `sabchat_conversations.createdAt` into `groupBy` buckets between
/// `from` (inclusive) and `to` (exclusive).
pub(crate) fn build_volume_conversations_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
    group_by: VolumeGroupBy,
) -> Vec<Document> {
    vec![
        doc! {
            "$match": {
                "tenantId": tenant,
                "createdAt": { "$gte": from, "$lt": to },
            }
        },
        doc! {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": group_format(group_by),
                        "date": "$createdAt",
                    }
                },
                "count": { "$sum": 1_i64 },
            }
        },
    ]
}

/// Pipeline for the **messages** half of `GET /volume`.
pub(crate) fn build_volume_messages_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
    group_by: VolumeGroupBy,
) -> Vec<Document> {
    vec![
        doc! {
            "$match": {
                "tenantId": tenant,
                "createdAt": { "$gte": from, "$lt": to },
            }
        },
        doc! {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": group_format(group_by),
                        "date": "$createdAt",
                    }
                },
                "count": { "$sum": 1_i64 },
            }
        },
    ]
}

// ===========================================================================
// GET /response-times
// ===========================================================================

/// Pipeline for `GET /response-times`. Emits one document carrying the
/// `latencies` array (in minutes) plus the per-row count; percentile
/// math happens in Rust because Mongo's `$percentile` is 7.0+ only and
/// we want to keep the driver-feature matrix narrow.
pub(crate) fn build_response_times_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
) -> Vec<Document> {
    vec![
        doc! {
            "$match": {
                "tenantId": tenant,
                "createdAt": { "$gte": from, "$lt": to },
                "firstResponseAt": { "$ne": null },
            }
        },
        doc! {
            "$project": {
                "_id": 0,
                "latencyMin": {
                    "$divide": [
                        { "$subtract": ["$firstResponseAt", "$createdAt"] },
                        60000_i64,
                    ]
                }
            }
        },
        // Drop pathological negative latencies (clock skew on writers).
        doc! { "$match": { "latencyMin": { "$gte": 0_f64 } } },
        doc! { "$sort": { "latencyMin": 1_i32 } },
    ]
}

// ===========================================================================
// GET /by-agent
// ===========================================================================

/// Pipeline for `GET /by-agent`. Drives off `sabchat_assignments` for
/// "conversations handled" and joins back into `sabchat_conversations`
/// to attach status + first-response latency for the **current**
/// assignee snapshot.
pub(crate) fn build_by_agent_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
) -> Vec<Document> {
    vec![
        // Per-agent handled count from the audit trail.
        doc! {
            "$match": {
                "tenantId": tenant,
                "at": { "$gte": from, "$lt": to },
                "newAssigneeId": { "$ne": null },
            }
        },
        doc! {
            "$group": {
                "_id": { "agentId": "$newAssigneeId", "conversationId": "$conversationId" },
            }
        },
        doc! {
            "$group": {
                "_id": "$_id.agentId",
                "conversationsHandled": { "$sum": 1_i64 },
            }
        },
        // Pull conversations currently assigned to this agent (for
        // status + latency aggregates).
        doc! {
            "$lookup": {
                "from": crate::CONVERSATIONS_COLL,
                "let": { "agentId": "$_id" },
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    { "$eq": ["$tenantId", tenant] },
                                    { "$eq": ["$assigneeId", "$$agentId"] },
                                ]
                            }
                        }
                    },
                    {
                        "$project": {
                            "status": 1,
                            "latencyMin": {
                                "$cond": [
                                    {
                                        "$and": [
                                            { "$ne": ["$firstResponseAt", null] },
                                            { "$ne": ["$createdAt", null] },
                                        ]
                                    },
                                    {
                                        "$divide": [
                                            { "$subtract": ["$firstResponseAt", "$createdAt"] },
                                            60000_i64,
                                        ]
                                    },
                                    null,
                                ]
                            }
                        }
                    },
                ],
                "as": "_convs",
            }
        },
        doc! {
            "$project": {
                "agentId": { "$toString": "$_id" },
                "conversationsHandled": 1,
                "resolvedCount": {
                    "$size": {
                        "$filter": {
                            "input": "$_convs",
                            "cond": { "$eq": ["$$this.status", "resolved"] },
                        }
                    }
                },
                "openCount": {
                    "$size": {
                        "$filter": {
                            "input": "$_convs",
                            "cond": { "$eq": ["$$this.status", "open"] },
                        }
                    }
                },
                "avgFirstResponseMin": {
                    "$let": {
                        "vars": {
                            "lat": {
                                "$filter": {
                                    "input": "$_convs.latencyMin",
                                    "cond": { "$ne": ["$$this", null] },
                                }
                            }
                        },
                        "in": {
                            "$cond": [
                                { "$gt": [{ "$size": "$$lat" }, 0_i64] },
                                { "$avg": "$$lat" },
                                0_f64,
                            ]
                        }
                    }
                },
                "_id": 0,
            }
        },
        doc! { "$sort": { "conversationsHandled": -1_i32 } },
    ]
}

// ===========================================================================
// GET /by-inbox
// ===========================================================================

/// Pipeline for `GET /by-inbox`. Aggregates `sabchat_conversations`
/// keyed by inbox over the window, joined with `sabchat_inboxes` for
/// the name + channelType. The message count is pulled in via
/// `$lookup` against `sabchat_messages`.
pub(crate) fn build_by_inbox_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
) -> Vec<Document> {
    vec![
        doc! {
            "$match": {
                "tenantId": tenant,
                "createdAt": { "$gte": from, "$lt": to },
            }
        },
        doc! {
            "$group": {
                "_id": "$inboxId",
                "conversationsCreated": { "$sum": 1_i64 },
                "resolvedCount": {
                    "$sum": { "$cond": [ { "$eq": ["$status", "resolved"] }, 1_i64, 0_i64 ] }
                },
                "latencies": {
                    "$push": {
                        "$cond": [
                            { "$ne": ["$firstResponseAt", null] },
                            {
                                "$divide": [
                                    { "$subtract": ["$firstResponseAt", "$createdAt"] },
                                    60000_i64,
                                ]
                            },
                            null,
                        ]
                    }
                },
            }
        },
        // Attach inbox name + channelType.
        doc! {
            "$lookup": {
                "from": crate::INBOXES_COLL,
                "localField": "_id",
                "foreignField": "_id",
                "as": "inbox",
            }
        },
        doc! { "$unwind": { "path": "$inbox", "preserveNullAndEmptyArrays": true } },
        // Pull message count for this inbox in the same window.
        doc! {
            "$lookup": {
                "from": crate::MESSAGES_COLL,
                "let": { "inboxId": "$_id" },
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    { "$eq": ["$tenantId", tenant] },
                                    { "$eq": ["$inboxId", "$$inboxId"] },
                                    { "$gte": ["$createdAt", from] },
                                    { "$lt": ["$createdAt", to] },
                                ]
                            }
                        }
                    },
                    { "$count": "n" },
                ],
                "as": "_msgs",
            }
        },
        doc! {
            "$project": {
                "_id": 0,
                "inboxId": { "$toString": "$_id" },
                "name": { "$ifNull": ["$inbox.name", ""] },
                "channelType": { "$ifNull": ["$inbox.channelType", ""] },
                "conversationsCreated": 1,
                "resolvedCount": 1,
                "messagesSent": {
                    "$ifNull": [ { "$arrayElemAt": ["$_msgs.n", 0] }, 0_i64 ]
                },
                "avgFirstResponseMin": {
                    "$let": {
                        "vars": {
                            "lat": {
                                "$filter": {
                                    "input": "$latencies",
                                    "cond": { "$ne": ["$$this", null] },
                                }
                            }
                        },
                        "in": {
                            "$cond": [
                                { "$gt": [{ "$size": "$$lat" }, 0_i64] },
                                { "$avg": "$$lat" },
                                0_f64,
                            ]
                        }
                    }
                },
            }
        },
        doc! { "$sort": { "conversationsCreated": -1_i32 } },
    ]
}

// ===========================================================================
// GET /csat
// ===========================================================================

/// Pipeline for `GET /csat`. Matches conversations with a populated
/// `customAttrs.csat.submittedAt` inside the window and emits one row
/// per qualifying conversation carrying just the score; the handler
/// rolls up count / mean / distribution in Rust so the response shape
/// stays uniform when no rows come back.
pub(crate) fn build_csat_pipeline(
    tenant: ObjectId,
    from: bson::DateTime,
    to: bson::DateTime,
) -> Vec<Document> {
    vec![
        doc! {
            "$match": {
                "tenantId": tenant,
                "customAttrs.csat.submittedAt": { "$gte": from, "$lt": to },
                "customAttrs.csat.score": { "$exists": true, "$ne": null },
            }
        },
        doc! {
            "$project": {
                "_id": 0,
                "score": "$customAttrs.csat.score",
            }
        },
    ]
}
