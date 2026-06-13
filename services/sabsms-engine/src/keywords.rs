//! V2.2 inbound keyword interceptor — STOP / START / HELP handling.
//!
//! Runs in the inbound webhook path AFTER the message insert +
//! conversation upsert. Idempotency under provider webhook retries is
//! gated upstream: when the inbound insert is a duplicate-key no-op the
//! webhook handler skips this module entirely; within this module the
//! suppression write is an upsert so a rare double-run is still safe.

use std::sync::Arc;

use chrono::Utc;
use mongodb::bson::{doc, Document};

use crate::{
    compliance, db,
    events::{self, EngineEvent},
    providers, queue,
    state::AppState,
    types::ProviderId,
};

pub const DEFAULT_STOP_KEYWORDS: &[&str] =
    &["STOP", "STOPALL", "UNSUB", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
pub const DEFAULT_START_KEYWORDS: &[&str] = &["START", "UNSTOP"];
pub const DEFAULT_HELP_KEYWORDS: &[&str] = &["HELP", "INFO"];
pub const DEFAULT_CONFIRM_OPT_OUT_TEXT: &str =
    "You have been unsubscribed. Reply START to resubscribe.";
pub const DEFAULT_HELP_TEXT: &str = "Reply STOP to unsubscribe.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeywordAction {
    Stop,
    Start,
    Help,
}

/// Effective keyword rules for a workspace: built-in defaults plus the
/// optional per-workspace extras from `sabsms_keyword_rules` (single doc
/// per workspace, all fields optional).
#[derive(Clone, Debug)]
pub struct KeywordRules {
    pub stop_keywords: Vec<String>,
    pub start_keywords: Vec<String>,
    pub help_keywords: Vec<String>,
    pub help_text: String,
    pub confirm_opt_out_text: String,
}

impl Default for KeywordRules {
    fn default() -> Self {
        Self {
            stop_keywords: DEFAULT_STOP_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            start_keywords: DEFAULT_START_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            help_keywords: DEFAULT_HELP_KEYWORDS.iter().map(|s| s.to_string()).collect(),
            help_text: DEFAULT_HELP_TEXT.to_string(),
            confirm_opt_out_text: DEFAULT_CONFIRM_OPT_OUT_TEXT.to_string(),
        }
    }
}

/// Normalize an inbound body for keyword matching: trim, strip trailing
/// punctuation, uppercase. `" stop! "` → `"STOP"`.
pub fn normalize_keyword(body: &str) -> String {
    body.trim()
        .trim_end_matches(|c: char| c.is_ascii_punctuation())
        .trim()
        .to_uppercase()
}

/// Exact-match classify a NORMALIZED body against the rules.
pub fn classify(normalized: &str, rules: &KeywordRules) -> Option<KeywordAction> {
    if normalized.is_empty() {
        return None;
    }
    if rules.stop_keywords.iter().any(|k| k == normalized) {
        Some(KeywordAction::Stop)
    } else if rules.start_keywords.iter().any(|k| k == normalized) {
        Some(KeywordAction::Start)
    } else if rules.help_keywords.iter().any(|k| k == normalized) {
        Some(KeywordAction::Help)
    } else {
        None
    }
}

/// Load the per-workspace rules doc and merge onto the defaults. Any
/// error degrades to the defaults — keyword handling must never break
/// on a bad rules doc.
pub async fn load_rules(state: &Arc<AppState>, workspace_id: &str) -> KeywordRules {
    let mut rules = KeywordRules::default();
    let col = state.mongo.collection::<Document>(db::COL_KEYWORD_RULES);
    let rules_doc = match col.find_one(doc! { "workspaceId": workspace_id }).await {
        Ok(Some(d)) => d,
        Ok(None) => return rules,
        Err(e) => {
            tracing::warn!(?e, workspace = workspace_id, "loading keyword rules failed; using defaults");
            return rules;
        }
    };
    merge_extras(&rules_doc, "stopKeywords", &mut rules.stop_keywords);
    merge_extras(&rules_doc, "helpKeywords", &mut rules.help_keywords);
    if let Ok(s) = rules_doc.get_str("helpText") {
        if !s.trim().is_empty() {
            rules.help_text = s.to_string();
        }
    }
    if let Ok(s) = rules_doc.get_str("confirmOptOutText") {
        if !s.trim().is_empty() {
            rules.confirm_opt_out_text = s.to_string();
        }
    }
    rules
}

fn merge_extras(rules_doc: &Document, field: &str, into: &mut Vec<String>) {
    if let Ok(arr) = rules_doc.get_array(field) {
        for v in arr {
            if let Some(s) = v.as_str() {
                let n = normalize_keyword(s);
                if !n.is_empty() && !into.contains(&n) {
                    into.push(n);
                }
            }
        }
    }
}

/// Entry point called from the inbound webhook handler (only after a
/// NON-duplicate message insert). Errors are reported to the caller,
/// which logs and swallows them — keyword failures never fail the
/// webhook ack.
pub async fn handle_inbound_keywords(
    state: &Arc<AppState>,
    workspace_id: &str,
    from_e164: &str,
    to_e164: &str,
    number_doc: &Document,
    path_provider: ProviderId,
    body: &str,
) -> anyhow::Result<()> {
    let normalized = normalize_keyword(body);
    let rules = load_rules(state, workspace_id).await;
    let action = match classify(&normalized, &rules) {
        Some(a) => a,
        None => return Ok(()),
    };

    // The auto-reply goes out from the number that received the inbound,
    // through the same provider/account.
    let provider: String = number_doc
        .get_str("provider")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| path_provider.as_str().to_string());
    let provider_account_id = number_doc.get_str("providerAccountId").ok();

    let phone_hash = compliance::hash_phone(from_e164);
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let suppressions = state.mongo.collection::<Document>(db::COL_SUPPRESSIONS);
    let consent_log = state.mongo.collection::<Document>(db::COL_CONSENT_LOG);

    match action {
        KeywordAction::Stop => {
            // 1. Suppress — upsert; a concurrent duplicate is fine.
            //    Canonical schema (`SabsmsSuppressionSource`) owns `source`,
            //    so source="stop" + reason="keyword:<normalized>" (the
            //    suppressions facet maps "STOP keyword" → source "stop").
            let upsert = suppressions
                .update_one(
                    doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash },
                    doc! { "$setOnInsert": {
                        "workspaceId": workspace_id,
                        "phoneHash": &phone_hash,
                        "source": "stop",
                        "reason": format!("keyword:{normalized}"),
                        "createdAt": now,
                    }},
                )
                .upsert(true)
                .await;
            if let Err(e) = upsert {
                if !db::is_duplicate_key_error(&e) {
                    return Err(e.into());
                }
            }

            // 2. Consent log — canonical `kind`/`captureMethod` schema
            //    (`SabsmsConsentEvent`) that the consent page + every Next
            //    writer use. The TCPA "STOP keyword captures" badge counts
            //    kind="opt_out_stop".
            consent_log
                .insert_one(doc! {
                    "workspaceId": workspace_id,
                    "phoneHash": &phone_hash,
                    "phone": from_e164,
                    "kind": "opt_out_stop",
                    "captureMethod": "inbound_keyword",
                    "keyword": &normalized,
                    "createdAt": now,
                })
                .await?;

            // 3. Event.
            let mut redis = state.redis.clone();
            events::emit(
                &mut redis,
                &EngineEvent::ContactUnsubscribed {
                    workspace_id: workspace_id.to_string(),
                    phone_hash: phone_hash.clone(),
                    source: "keyword".to_string(),
                },
            )
            .await;

            // 4. TCPA confirmation auto-reply — marked as an opt-out
            //    confirmation so the worker's suppression check lets it out.
            queue_auto_reply(
                state,
                workspace_id,
                to_e164,
                from_e164,
                &rules.confirm_opt_out_text,
                &provider,
                provider_account_id,
                true,
            )
            .await?;
        }
        KeywordAction::Start => {
            // Remove any STOP-sourced suppression (covers both keyword and
            // AI-guardrail STOPs, which both write source="stop").
            // Manual/complaint/bounce/carrier_block suppressions stay.
            let deleted = suppressions
                .delete_one(doc! {
                    "workspaceId": workspace_id,
                    "phoneHash": &phone_hash,
                    "source": "stop",
                })
                .await?;
            tracing::info!(
                workspace = workspace_id,
                removed = deleted.deleted_count,
                "START keyword processed"
            );
            // Canonical consent schema — kind="opt_in_restart".
            consent_log
                .insert_one(doc! {
                    "workspaceId": workspace_id,
                    "phoneHash": &phone_hash,
                    "phone": from_e164,
                    "kind": "opt_in_restart",
                    "captureMethod": "inbound_keyword",
                    "keyword": &normalized,
                    "createdAt": now,
                })
                .await?;
        }
        KeywordAction::Help => {
            queue_auto_reply(
                state,
                workspace_id,
                to_e164,
                from_e164,
                &rules.help_text,
                &provider,
                provider_account_id,
                false,
            )
            .await?;
        }
    }
    Ok(())
}

/// Insert an outbound auto-reply message doc (category transactional,
/// status queued) and push it onto the send queue.
#[allow(clippy::too_many_arguments)]
async fn queue_auto_reply(
    state: &Arc<AppState>,
    workspace_id: &str,
    from: &str,
    to: &str,
    body: &str,
    provider: &str,
    provider_account_id: Option<&str>,
    opt_out_confirmation: bool,
) -> anyhow::Result<()> {
    let now = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());
    let segments = providers::estimate_segments(body) as i32;
    let mut msg = doc! {
        "workspaceId": workspace_id,
        "direction": "outbound",
        "channel": "sms",
        "from": from,
        "to": to,
        "body": body,
        "category": "transactional",
        "status": "queued",
        "provider": provider,
        "segmentsCount": segments,
        "autoReply": true,
        "queuedAt": now,
        "createdAt": now,
        "updatedAt": now,
    };
    if opt_out_confirmation {
        msg.insert("optOutConfirmation", true);
    }
    if let Some(acc) = provider_account_id {
        msg.insert("providerAccountId", acc);
    }

    let messages = state.mongo.collection::<Document>(db::COL_MESSAGES);
    let inserted = messages.insert_one(msg).await?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .map(|oid| oid.to_hex())
        .unwrap_or_default();

    let mut redis = state.redis.clone();
    queue::enqueue_send(&mut redis, &id).await?;
    events::emit(
        &mut redis,
        &EngineEvent::MessageQueued {
            workspace_id: workspace_id.to_string(),
            message_id: id,
        },
    )
    .await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_uppercases_and_strips_trailing_punctuation() {
        assert_eq!(normalize_keyword(" stop! "), "STOP");
        assert_eq!(normalize_keyword("Stop."), "STOP");
        assert_eq!(normalize_keyword("STOP"), "STOP");
        assert_eq!(normalize_keyword("help???"), "HELP");
        assert_eq!(normalize_keyword("  unsubscribe  "), "UNSUBSCRIBE");
        assert_eq!(normalize_keyword("start"), "START");
        // Trailing punctuation only — leading chars are part of the word.
        assert_eq!(normalize_keyword("!stop"), "!STOP");
        assert_eq!(normalize_keyword(""), "");
        assert_eq!(normalize_keyword("  !?  "), "");
    }

    #[test]
    fn classify_matches_default_stop_set() {
        let rules = KeywordRules::default();
        for k in ["STOP", "STOPALL", "UNSUB", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"] {
            assert_eq!(classify(k, &rules), Some(KeywordAction::Stop), "{k}");
        }
        // Through the normalizer, incl. lowercase + punctuation.
        assert_eq!(
            classify(&normalize_keyword(" stop! "), &rules),
            Some(KeywordAction::Stop)
        );
        assert_eq!(
            classify(&normalize_keyword("cancel"), &rules),
            Some(KeywordAction::Stop)
        );
    }

    #[test]
    fn classify_matches_start_and_help() {
        let rules = KeywordRules::default();
        assert_eq!(classify("START", &rules), Some(KeywordAction::Start));
        assert_eq!(classify("UNSTOP", &rules), Some(KeywordAction::Start));
        assert_eq!(classify("HELP", &rules), Some(KeywordAction::Help));
        assert_eq!(classify("INFO", &rules), Some(KeywordAction::Help));
        assert_eq!(
            classify(&normalize_keyword("Help."), &rules),
            Some(KeywordAction::Help)
        );
    }

    #[test]
    fn classify_ignores_non_keywords_and_sentences() {
        let rules = KeywordRules::default();
        assert_eq!(classify("HELLO", &rules), None);
        assert_eq!(classify(&normalize_keyword("please stop"), &rules), None);
        assert_eq!(classify(&normalize_keyword("stop it"), &rules), None);
        assert_eq!(classify("", &rules), None);
    }

    #[test]
    fn custom_stop_keywords_extend_defaults() {
        let mut rules = KeywordRules::default();
        rules.stop_keywords.push(normalize_keyword("basta"));
        assert_eq!(
            classify(&normalize_keyword("Basta!"), &rules),
            Some(KeywordAction::Stop)
        );
        // Defaults still work.
        assert_eq!(classify("STOP", &rules), Some(KeywordAction::Stop));
    }

    #[test]
    fn stop_precedence_over_help_if_duplicated() {
        let mut rules = KeywordRules::default();
        rules.help_keywords.push("STOP".to_string());
        assert_eq!(classify("STOP", &rules), Some(KeywordAction::Stop));
    }
}
