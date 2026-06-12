//! Engine event stream — a Redis Stream bridge (`sabsms:events`).
//!
//! Every state transition the rest of the platform cares about (Next
//! events consumer: unread counters, identity graph, journeys, rollups)
//! is XADD-ed here. The stream is capped with `MAXLEN ~ 100000` so a
//! stalled consumer can never OOM Redis.
//!
//! Emitting is ALWAYS best-effort: a failure to publish must never fail
//! the send/webhook main path — we log a warning and move on.

use redis::aio::ConnectionManager;
use serde::Serialize;

pub const EVENTS_STREAM: &str = "sabsms:events";
const EVENTS_MAXLEN: usize = 100_000;

/// Engine-emitted domain events. Serialized with `kind` as the tag and
/// camelCase everywhere — e.g.
/// `{"kind":"messageSent","workspaceId":"...","messageId":"...","provider":"twilio","segments":2}`.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum EngineEvent {
    MessageQueued {
        workspace_id: String,
        message_id: String,
    },
    MessageSent {
        workspace_id: String,
        message_id: String,
        provider: String,
        segments: u32,
    },
    MessageFailed {
        workspace_id: String,
        message_id: String,
        error_code: String,
    },
    MessageDelivered {
        workspace_id: String,
        message_id: String,
    },
    /// The V2.6 router advanced past a candidate — `from_account`
    /// failed (or was circuit-skipped) and `to_account` is being tried.
    RouteFailover {
        workspace_id: String,
        message_id: String,
        from_account: String,
        to_account: String,
        reason: String,
    },
    MessageInbound {
        workspace_id: String,
        message_id: String,
        conversation_id: String,
        from: String,
        body: String,
    },
    ContactUnsubscribed {
        workspace_id: String,
        phone_hash: String,
        source: String,
    },
    ComplianceBlocked {
        workspace_id: String,
        message_id: String,
        code: String,
    },
    ComplianceRescheduled {
        workspace_id: String,
        message_id: String,
        until_epoch: i64,
    },
    CampaignStarted {
        workspace_id: String,
        campaign_id: String,
    },
    CampaignPaused {
        workspace_id: String,
        campaign_id: String,
    },
    CampaignCompleted {
        workspace_id: String,
        campaign_id: String,
    },
}

impl EngineEvent {
    /// The camelCase tag string (mirrors the serde `kind` tag).
    pub fn kind(&self) -> &'static str {
        match self {
            EngineEvent::MessageQueued { .. } => "messageQueued",
            EngineEvent::MessageSent { .. } => "messageSent",
            EngineEvent::MessageFailed { .. } => "messageFailed",
            EngineEvent::MessageDelivered { .. } => "messageDelivered",
            EngineEvent::RouteFailover { .. } => "routeFailover",
            EngineEvent::MessageInbound { .. } => "messageInbound",
            EngineEvent::ContactUnsubscribed { .. } => "contactUnsubscribed",
            EngineEvent::ComplianceBlocked { .. } => "complianceBlocked",
            EngineEvent::ComplianceRescheduled { .. } => "complianceRescheduled",
            EngineEvent::CampaignStarted { .. } => "campaignStarted",
            EngineEvent::CampaignPaused { .. } => "campaignPaused",
            EngineEvent::CampaignCompleted { .. } => "campaignCompleted",
        }
    }
}

/// XADD the event to `sabsms:events`. Fire-and-forget: failures are
/// logged at WARN and swallowed — emitting must NEVER fail the caller.
pub async fn emit(redis: &mut ConnectionManager, event: &EngineEvent) {
    if let Err(e) = try_emit(redis, event).await {
        tracing::warn!(?e, kind = event.kind(), "failed to emit engine event");
    }
}

async fn try_emit(redis: &mut ConnectionManager, event: &EngineEvent) -> anyhow::Result<()> {
    let payload = serde_json::to_string(event)?;
    let at_ms = chrono::Utc::now().timestamp_millis();
    let _: String = redis::cmd("XADD")
        .arg(EVENTS_STREAM)
        .arg("MAXLEN")
        .arg("~")
        .arg(EVENTS_MAXLEN)
        .arg("*")
        .arg("kind")
        .arg(event.kind())
        .arg("payload")
        .arg(&payload)
        .arg("at")
        .arg(at_ms)
        .query_async(redis)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_serializes_with_camel_case_kind_tag_and_fields() {
        let e = EngineEvent::MessageSent {
            workspace_id: "ws1".into(),
            message_id: "m1".into(),
            provider: "twilio".into(),
            segments: 2,
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "messageSent");
        assert_eq!(v["workspaceId"], "ws1");
        assert_eq!(v["messageId"], "m1");
        assert_eq!(v["provider"], "twilio");
        assert_eq!(v["segments"], 2);
    }

    #[test]
    fn kind_helper_matches_serde_tag() {
        let cases: Vec<EngineEvent> = vec![
            EngineEvent::MessageQueued {
                workspace_id: "w".into(),
                message_id: "m".into(),
            },
            EngineEvent::MessageFailed {
                workspace_id: "w".into(),
                message_id: "m".into(),
                error_code: "x".into(),
            },
            EngineEvent::MessageDelivered {
                workspace_id: "w".into(),
                message_id: "m".into(),
            },
            EngineEvent::RouteFailover {
                workspace_id: "w".into(),
                message_id: "m".into(),
                from_account: "a1".into(),
                to_account: "a2".into(),
                reason: "blocked_by_carrier".into(),
            },
            EngineEvent::MessageInbound {
                workspace_id: "w".into(),
                message_id: "m".into(),
                conversation_id: "c".into(),
                from: "+15551230000".into(),
                body: "hi".into(),
            },
            EngineEvent::ContactUnsubscribed {
                workspace_id: "w".into(),
                phone_hash: "h".into(),
                source: "keyword".into(),
            },
            EngineEvent::ComplianceBlocked {
                workspace_id: "w".into(),
                message_id: "m".into(),
                code: "no_consent".into(),
            },
            EngineEvent::ComplianceRescheduled {
                workspace_id: "w".into(),
                message_id: "m".into(),
                until_epoch: 1_700_000_000,
            },
            EngineEvent::CampaignStarted {
                workspace_id: "w".into(),
                campaign_id: "c".into(),
            },
            EngineEvent::CampaignPaused {
                workspace_id: "w".into(),
                campaign_id: "c".into(),
            },
            EngineEvent::CampaignCompleted {
                workspace_id: "w".into(),
                campaign_id: "c".into(),
            },
        ];
        for e in cases {
            let v = serde_json::to_value(&e).unwrap();
            assert_eq!(v["kind"].as_str().unwrap(), e.kind());
        }
    }

    #[test]
    fn campaign_events_serialize_camel_case_campaign_id() {
        let e = EngineEvent::CampaignPaused {
            workspace_id: "ws1".into(),
            campaign_id: "c1".into(),
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "campaignPaused");
        assert_eq!(v["workspaceId"], "ws1");
        assert_eq!(v["campaignId"], "c1");
    }

    #[test]
    fn route_failover_serializes_camel_case_accounts() {
        let e = EngineEvent::RouteFailover {
            workspace_id: "ws1".into(),
            message_id: "m1".into(),
            from_account: "acctA".into(),
            to_account: "acctB".into(),
            reason: "spam_filtered".into(),
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["kind"], "routeFailover");
        assert_eq!(v["fromAccount"], "acctA");
        assert_eq!(v["toAccount"], "acctB");
        assert_eq!(v["reason"], "spam_filtered");
    }

    #[test]
    fn compliance_rescheduled_carries_until_epoch_camel_case() {
        let e = EngineEvent::ComplianceRescheduled {
            workspace_id: "w".into(),
            message_id: "m".into(),
            until_epoch: 1234,
        };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["untilEpoch"], 1234);
    }
}
