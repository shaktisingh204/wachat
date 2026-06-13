//! Inbound binding — when real mail arrives (from the IMAP sync or the
//! inbound webhook), bind it into the collaboration/automation layers:
//! upsert a team conversation, register the sender in the screener, and
//! evaluate enabled rules. This is the production "live-mail binding".

use std::sync::Arc;

use mongodb::bson::{doc, DateTime as BsonDateTime, Document};
use serde::{Deserialize, Serialize};

use crate::{db, errors::EngineResult, state::AppState};

#[derive(Debug, Deserialize)]
pub struct InboundRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub from: String,
    #[serde(default, rename = "fromName")]
    pub from_name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default, rename = "messageId")]
    pub message_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RuleAction {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InboundResult {
    #[serde(rename = "screenerDecision")]
    pub screener_decision: String,
    #[serde(rename = "ruleActions")]
    pub rule_actions: Vec<RuleAction>,
    pub bound: bool,
}

pub async fn process_inbound(
    state: &Arc<AppState>,
    req: InboundRequest,
) -> EngineResult<InboundResult> {
    let from = req.from.trim().to_lowercase();
    if from.is_empty() {
        return Ok(InboundResult {
            screener_decision: "pending".into(),
            rule_actions: vec![],
            bound: false,
        });
    }
    let subject = req.subject.unwrap_or_default();
    let now = BsonDateTime::from_millis(chrono::Utc::now().timestamp_millis());

    // 1) Screener — register first-time senders as pending; read the decision.
    let screener = state.mongo.collection::<Document>(db::COL_SCREENER);
    screener
        .update_one(
            doc! { "workspaceId": &req.workspace_id, "email": &from },
            doc! {
                "$setOnInsert": {
                    "workspaceId": &req.workspace_id,
                    "email": &from,
                    "decision": "pending",
                    "firstSeenAt": now,
                },
            },
        )
        .upsert(true)
        .await?;
    let decision = screener
        .find_one(doc! { "workspaceId": &req.workspace_id, "email": &from })
        .await?
        .and_then(|d| d.get_str("decision").ok().map(|s| s.to_string()))
        .unwrap_or_else(|| "pending".into());

    // 2) Conversation (team shared inbox) — upsert by (workspace, sender).
    let convo_status = if decision == "denied" { "screened" } else { "open" };
    let conversations = state.mongo.collection::<Document>(db::COL_CONVERSATIONS);
    conversations
        .update_one(
            doc! { "workspaceId": &req.workspace_id, "fromEmail": &from },
            doc! {
                "$set": {
                    "subject": &subject,
                    "lastMessageAt": now,
                    "status": convo_status,
                    "lastMessageId": req.message_id.clone().unwrap_or_default(),
                },
                "$setOnInsert": {
                    "workspaceId": &req.workspace_id,
                    "fromEmail": &from,
                    "fromName": req.from_name.clone().unwrap_or_default(),
                    "createdAt": now,
                },
            },
        )
        .upsert(true)
        .await?;

    // 3) Rules — evaluate enabled rules' match against from/subject.
    let mut actions: Vec<RuleAction> = Vec::new();
    let rules = state.mongo.collection::<Document>(db::COL_RULES);
    let subj_l = subject.to_lowercase();
    let mut cursor = rules
        .find(doc! { "workspaceId": &req.workspace_id, "enabled": true })
        .await?;
    while cursor.advance().await? {
        let rule = cursor.deserialize_current()?;
        let Ok(compiled) = rule.get_document("compiled") else {
            continue;
        };
        let m = compiled.get_document("match").ok();
        let from_ok = m
            .and_then(|m| m.get_str("fromContains").ok())
            .map(|s| from.contains(&s.to_lowercase()))
            .unwrap_or(true);
        let subj_ok = m
            .and_then(|m| m.get_str("subjectContains").ok())
            .map(|s| subj_l.contains(&s.to_lowercase()))
            .unwrap_or(true);
        // A rule with neither from nor subject term shouldn't match everything.
        let has_term = m
            .map(|m| m.contains_key("fromContains") || m.contains_key("subjectContains"))
            .unwrap_or(false);
        if has_term && from_ok && subj_ok {
            let action = compiled.get_str("action").unwrap_or("label").to_string();
            let label = compiled.get_str("label").ok().map(|s| s.to_string());
            actions.push(RuleAction { action, label });
        }
    }

    Ok(InboundResult {
        screener_decision: decision,
        rule_actions: actions,
        bound: true,
    })
}
