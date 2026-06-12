//! Pre-send compliance kernel (V2.4 track A).
//!
//! The HTTP enqueue handler runs only the CHEAP suppression check
//! ([`is_suppressed`]) so the API stays fast; the worker runs the full
//! kernel ([`pre_send_checks`]) — suppression, quiet hours, consent
//! gating, 10DLC gating — and persists a `complianceTrace` on the
//! message doc regardless of the outcome.
//!
//! Ordering matters: the worker runs the kernel BEFORE reserving
//! credits, so a `Reschedule` verdict never holds a credit reservation
//! that would need releasing.

pub mod dlt;
pub mod dlt_store;
pub mod quiet_hours;

use std::sync::Arc;

use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::{
    db,
    errors::EngineResult,
    state::AppState,
    types::{MessageCategory, ProviderId},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
    Allow,
    Block {
        code: String,
        reason: String,
    },
    /// Send later — e.g. quiet hours. `until_epoch_secs` is the next
    /// instant the message becomes legal to send.
    Reschedule {
        until_epoch_secs: i64,
        code: String,
    },
}

/// One entry of the per-message `complianceTrace` array.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEntry {
    pub check: String,
    pub verdict: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl TraceEntry {
    pub fn new(check: &str, verdict: &str, detail: Option<String>) -> Self {
        Self {
            check: check.to_string(),
            verdict: verdict.to_string(),
            detail,
        }
    }
}

/// Everything the kernel needs to know about an outbound message.
pub struct MessageContext<'a> {
    pub workspace_id: &'a str,
    pub to_e164: &'a str,
    /// ISO-3166 alpha-2 destination country (best-effort from E.164).
    pub country: &'a str,
    pub category: MessageCategory,
    pub provider: ProviderId,
    pub provider_account_id: Option<&'a str>,
    /// TCPA opt-out confirmations must be deliverable to a contact that
    /// was JUST suppressed — set on the STOP auto-reply so the
    /// suppression check is skipped for that one message.
    pub opt_out_confirmation: bool,
    /// Final message body — required by the India DLT template scrub.
    pub body: &'a str,
    /// Sender header (the doc's `senderId`/`from`) for DLT header checks.
    pub sender_header: Option<&'a str>,
    /// India DLT content-template id claimed by the message (explicit on
    /// the doc, or auto-attached by the worker before the kernel runs).
    pub dlt_template_id: Option<&'a str>,
}

/// Hash a phone for the suppression list. SHA-256 lowercase hex.
pub fn hash_phone(e164: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(e164.as_bytes());
    hex::encode(hasher.finalize())
}

/// Cheap synchronous-path check: is this recipient on the workspace's
/// suppression list? Used by the enqueue API handler; the worker
/// re-checks inside the full kernel.
pub async fn is_suppressed(
    state: &Arc<AppState>,
    workspace_id: &str,
    to_e164: &str,
) -> EngineResult<bool> {
    let phone_hash = hash_phone(to_e164);
    let suppressions = state.mongo.collection::<Document>(db::COL_SUPPRESSIONS);
    Ok(suppressions
        .find_one(doc! { "workspaceId": workspace_id, "phoneHash": &phone_hash })
        .await?
        .is_some())
}

/// Consent events that grant marketing sendability. The LATEST event for
/// the phone must be one of these (i.e. not `opt_out`).
pub const CONSENT_GRANTING_EVENTS: &[&str] = &["opt_in", "opt_in_restored", "double_opt_in"];

/// Pure consent decision given the latest consent-log event (if any).
pub fn consent_event_grants(latest_event: Option<&str>) -> bool {
    matches!(latest_event, Some(e) if CONSENT_GRANTING_EVENTS.contains(&e))
}

/// Pure 10DLC gating decision.
///
/// US marketing requires a provider account with `tenDlc.status ==
/// "verified"` (carriers have hard-dropped unregistered 10DLC traffic
/// since Feb 2025). When no account doc exists (env-creds dev fallback)
/// we only let it through if `SABSMS_ALLOW_ENV_CREDS=true` — fail closed
/// otherwise.
pub fn ten_dlc_blocks(
    country: &str,
    category: MessageCategory,
    account_status: Option<&str>,
    account_present: bool,
    env_creds_allowed: bool,
) -> bool {
    if country != "US" || category != MessageCategory::Marketing {
        return false;
    }
    if account_present {
        account_status != Some("verified")
    } else {
        !env_creds_allowed
    }
}

/// `SABSMS_REQUIRE_CONSENT` — default TRUE (fail closed). Set to
/// `false` ONLY in dev to skip marketing consent gating.
fn require_consent() -> bool {
    std::env::var("SABSMS_REQUIRE_CONSENT")
        .map(|v| !v.eq_ignore_ascii_case("false"))
        .unwrap_or(true)
}

fn env_creds_allowed() -> bool {
    std::env::var("SABSMS_ALLOW_ENV_CREDS").unwrap_or_default() == "true"
}

/// `SABSMS_DLT_ENFORCE` — how hard the India DLT gate bites.
///
///   - `strict` — every IN send needs a registered template
///   - `marketing_only` — (default) marketing without a template blocks;
///     transactional/otp/alert/service pass with a warning trace (many
///     transactional routes attach the template at the provider level)
///   - `off` — all DLT checks skipped
///
/// Regardless of mode (except `off`): when a message DOES claim a
/// `dltTemplateId`, the full scrub against that template is enforcing.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DltEnforceMode {
    Strict,
    MarketingOnly,
    Off,
}

pub fn dlt_enforce_mode() -> DltEnforceMode {
    match std::env::var("SABSMS_DLT_ENFORCE")
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "strict" => DltEnforceMode::Strict,
        "off" => DltEnforceMode::Off,
        _ => DltEnforceMode::MarketingOnly,
    }
}

/// Pure decision for the missing-template path of the DLT gate.
/// Returns `true` when the send must block with `dlt_template_required`.
pub fn dlt_missing_template_blocks(mode: DltEnforceMode, category: MessageCategory) -> bool {
    match mode {
        DltEnforceMode::Off => false,
        DltEnforceMode::Strict => true,
        DltEnforceMode::MarketingOnly => category == MessageCategory::Marketing,
    }
}

/// Run the full pre-send compliance kernel. Returns the first non-Allow
/// verdict together with the trace of every check evaluated so far
/// (including the failing one); on success returns `(Allow, full trace)`.
pub async fn pre_send_checks(
    state: &Arc<AppState>,
    ctx: &MessageContext<'_>,
) -> EngineResult<(Verdict, Vec<TraceEntry>)> {
    let mut trace: Vec<TraceEntry> = Vec::with_capacity(4);
    let marketing = ctx.category == MessageCategory::Marketing;

    // 1. Suppression list.
    if ctx.opt_out_confirmation {
        trace.push(TraceEntry::new(
            "suppression",
            "skipped",
            Some("opt-out confirmation message".into()),
        ));
    } else if is_suppressed(state, ctx.workspace_id, ctx.to_e164).await? {
        trace.push(TraceEntry::new(
            "suppression",
            "block",
            Some("recipient is on the suppression list".into()),
        ));
        return Ok((
            Verdict::Block {
                code: "suppressed".into(),
                reason: "recipient is on the suppression list".into(),
            },
            trace,
        ));
    } else {
        trace.push(TraceEntry::new("suppression", "allow", None));
    }

    // 2. Quiet hours — marketing only.
    if !marketing {
        trace.push(TraceEntry::new(
            "quiet_hours",
            "skipped",
            Some("category exempt".into()),
        ));
    } else {
        match quiet_hours::check_quiet_hours(ctx.country, ctx.category, Utc::now()) {
            None => trace.push(TraceEntry::new("quiet_hours", "allow", None)),
            Some(until) => {
                trace.push(TraceEntry::new(
                    "quiet_hours",
                    "reschedule",
                    Some(until.to_rfc3339()),
                ));
                return Ok((
                    Verdict::Reschedule {
                        until_epoch_secs: until.timestamp(),
                        code: "quiet_hours".into(),
                    },
                    trace,
                ));
            }
        }
    }

    // 3. Consent gating — marketing only, fail closed unless
    //    SABSMS_REQUIRE_CONSENT=false.
    if !marketing {
        trace.push(TraceEntry::new(
            "consent",
            "skipped",
            Some("category exempt".into()),
        ));
    } else if !require_consent() {
        trace.push(TraceEntry::new(
            "consent",
            "skipped",
            Some("SABSMS_REQUIRE_CONSENT=false".into()),
        ));
    } else {
        let phone_hash = hash_phone(ctx.to_e164);
        let latest = state
            .mongo
            .collection::<Document>(db::COL_CONSENT_LOG)
            .find_one(doc! { "workspaceId": ctx.workspace_id, "phoneHash": &phone_hash })
            .sort(doc! { "createdAt": -1 })
            .await?;
        let latest_event = latest.as_ref().and_then(|d| d.get_str("event").ok());
        if consent_event_grants(latest_event) {
            trace.push(TraceEntry::new(
                "consent",
                "allow",
                latest_event.map(|e| e.to_string()),
            ));
        } else {
            let detail = latest_event
                .map(|e| format!("latest consent event is '{e}'"))
                .unwrap_or_else(|| "no consent record".to_string());
            trace.push(TraceEntry::new("consent", "block", Some(detail)));
            return Ok((
                Verdict::Block {
                    code: "no_consent".into(),
                    reason: "no marketing consent on record for recipient".into(),
                },
                trace,
            ));
        }
    }

    // 4. 10DLC gating — US marketing only.
    if ctx.country != "US" || !marketing {
        trace.push(TraceEntry::new(
            "ten_dlc",
            "skipped",
            Some("not US marketing".into()),
        ));
    } else {
        let account = find_provider_account(state, ctx).await?;
        let account_present = account.is_some();
        let status: Option<String> = account
            .as_ref()
            .and_then(|a| a.get_document("tenDlc").ok())
            .and_then(|t| t.get_str("status").ok())
            .map(String::from);
        if ten_dlc_blocks(
            ctx.country,
            ctx.category,
            status.as_deref(),
            account_present,
            env_creds_allowed(),
        ) {
            let detail = if account_present {
                format!("tenDlc.status is {:?}, need \"verified\"", status)
            } else {
                "no provider account resolvable (env-creds fallback not allowed)".to_string()
            };
            trace.push(TraceEntry::new("ten_dlc", "block", Some(detail)));
            return Ok((
                Verdict::Block {
                    code: "ten_dlc_required".into(),
                    reason: "US marketing requires a verified 10DLC registration".into(),
                },
                trace,
            ));
        }
        trace.push(TraceEntry::new(
            "ten_dlc",
            "allow",
            status.or_else(|| Some("env-creds dev fallback".into())),
        ));
    }

    // 5. India DLT gating (V2.8) — IN destinations only.
    let dlt_mode = dlt_enforce_mode();
    if ctx.country != "IN" {
        trace.push(TraceEntry::new(
            "dlt_gate",
            "skipped",
            Some("not an IN destination".into()),
        ));
    } else if dlt_mode == DltEnforceMode::Off {
        trace.push(TraceEntry::new(
            "dlt_gate",
            "skipped",
            Some("SABSMS_DLT_ENFORCE=off".into()),
        ));
    } else if let Some(template_id) = ctx.dlt_template_id {
        // The message claims a template → full scrub, enforcing on Fail.
        let registry = dlt_store::load_registry(state, ctx.workspace_id).await;
        match registry.find_template(template_id) {
            None if registry.templates.is_empty() => {
                // Workspace never configured a DLT registry — the id is
                // provider-portal-managed. Warn, don't break existing
                // flows; the scrub becomes enforcing once the registry
                // is populated.
                trace.push(TraceEntry::new(
                    "dlt_template_match",
                    "warn",
                    Some(format!(
                        "dlt registry not configured; template {template_id} not verified"
                    )),
                ));
            }
            None => {
                trace.push(TraceEntry::new(
                    "dlt_template_match",
                    "block",
                    Some(format!(
                        "dltTemplateId {template_id} is not in the workspace DLT registry"
                    )),
                ));
                return Ok((
                    Verdict::Block {
                        code: "dlt_template_unknown".into(),
                        reason: format!(
                            "DLT template {template_id} is not registered for this workspace"
                        ),
                    },
                    trace,
                ));
            }
            Some(template) => {
                let registered_header = ctx
                    .sender_header
                    .and_then(|h| registry.find_header(h));
                let scrub_ctx = dlt::FullScrubContext {
                    body: ctx.body,
                    header: ctx.sender_header,
                    registered_header,
                    template: Some(template),
                    chain: registry.chain.as_ref(),
                };
                let dlt_trace = dlt::full_scrub(&scrub_ctx);
                let block = dlt::first_block(&dlt_trace)
                    .map(|(check, detail)| (check.to_string(), detail.to_string()));
                trace.extend(dlt_trace);
                if let Some((check, detail)) = block {
                    return Ok((
                        Verdict::Block {
                            code: check,
                            reason: detail,
                        },
                        trace,
                    ));
                }
            }
        }
    } else if dlt_missing_template_blocks(dlt_mode, ctx.category) {
        trace.push(TraceEntry::new(
            "dlt_gate",
            "block",
            Some("IN destination with no DLT content template attached".into()),
        ));
        return Ok((
            Verdict::Block {
                code: "dlt_template_required".into(),
                reason: "India destinations require a registered DLT content template".into(),
            },
            trace,
        ));
    } else {
        trace.push(TraceEntry::new(
            "dlt_gate",
            "warn",
            Some(format!(
                "IN {} send without a DLT template id; provider-level template assumed",
                match ctx.category {
                    MessageCategory::Otp => "otp",
                    MessageCategory::Transactional => "transactional",
                    MessageCategory::Alert => "alert",
                    MessageCategory::Service => "service",
                    MessageCategory::Marketing => "marketing",
                }
            )),
        ));
    }

    Ok((Verdict::Allow, trace))
}

/// Resolve the provider-account doc the worker would use — same order as
/// `creds::resolve`: explicit id → workspace default → any active.
async fn find_provider_account(
    state: &Arc<AppState>,
    ctx: &MessageContext<'_>,
) -> EngineResult<Option<Document>> {
    let accounts = state.mongo.collection::<Document>(db::COL_PROVIDER_ACCOUNTS);

    if let Some(account_id) = ctx.provider_account_id {
        let mut filter = match ObjectId::parse_str(account_id) {
            Ok(oid) => doc! { "_id": oid },
            Err(_) => doc! { "_id": account_id },
        };
        filter.insert("workspaceId", ctx.workspace_id);
        filter.insert("status", "active");
        return Ok(accounts.find_one(filter).await?);
    }

    let default_filter = doc! {
        "workspaceId": ctx.workspace_id,
        "provider": ctx.provider.as_str(),
        "isDefault": true,
        "status": "active",
    };
    if let Some(a) = accounts.find_one(default_filter).await? {
        return Ok(Some(a));
    }
    let any_filter = doc! {
        "workspaceId": ctx.workspace_id,
        "provider": ctx.provider.as_str(),
        "status": "active",
    };
    Ok(accounts.find_one(any_filter).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consent_grants_on_opt_in_variants() {
        assert!(consent_event_grants(Some("opt_in")));
        assert!(consent_event_grants(Some("opt_in_restored")));
        assert!(consent_event_grants(Some("double_opt_in")));
    }

    #[test]
    fn consent_blocks_on_opt_out_or_missing() {
        assert!(!consent_event_grants(Some("opt_out")));
        assert!(!consent_event_grants(None));
        assert!(!consent_event_grants(Some("something_else")));
    }

    #[test]
    fn ten_dlc_only_gates_us_marketing() {
        // Non-US marketing — never gated.
        assert!(!ten_dlc_blocks("IN", MessageCategory::Marketing, None, false, false));
        // US transactional/otp — never gated.
        assert!(!ten_dlc_blocks("US", MessageCategory::Transactional, None, false, false));
        assert!(!ten_dlc_blocks("US", MessageCategory::Otp, None, false, false));
    }

    #[test]
    fn ten_dlc_requires_verified_status_when_account_present() {
        assert!(!ten_dlc_blocks(
            "US",
            MessageCategory::Marketing,
            Some("verified"),
            true,
            false
        ));
        assert!(ten_dlc_blocks(
            "US",
            MessageCategory::Marketing,
            Some("pending"),
            true,
            false
        ));
        assert!(ten_dlc_blocks("US", MessageCategory::Marketing, None, true, false));
    }

    #[test]
    fn ten_dlc_env_creds_fallback_only_passes_when_allowed() {
        // No account doc + env creds allowed → dev pass.
        assert!(!ten_dlc_blocks("US", MessageCategory::Marketing, None, false, true));
        // No account doc + env creds NOT allowed → fail closed.
        assert!(ten_dlc_blocks("US", MessageCategory::Marketing, None, false, false));
    }

    #[test]
    fn hash_phone_is_sha256_hex() {
        let h = hash_phone("+15551234567");
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
        // Deterministic.
        assert_eq!(h, hash_phone("+15551234567"));
    }

    #[test]
    fn dlt_missing_template_policy_matrix() {
        use DltEnforceMode as M;
        // off never blocks.
        assert!(!dlt_missing_template_blocks(M::Off, MessageCategory::Marketing));
        // marketing_only blocks marketing only.
        assert!(dlt_missing_template_blocks(M::MarketingOnly, MessageCategory::Marketing));
        assert!(!dlt_missing_template_blocks(M::MarketingOnly, MessageCategory::Transactional));
        assert!(!dlt_missing_template_blocks(M::MarketingOnly, MessageCategory::Otp));
        assert!(!dlt_missing_template_blocks(M::MarketingOnly, MessageCategory::Alert));
        assert!(!dlt_missing_template_blocks(M::MarketingOnly, MessageCategory::Service));
        // strict blocks everything.
        assert!(dlt_missing_template_blocks(M::Strict, MessageCategory::Otp));
        assert!(dlt_missing_template_blocks(M::Strict, MessageCategory::Transactional));
        assert!(dlt_missing_template_blocks(M::Strict, MessageCategory::Marketing));
    }

    #[test]
    fn trace_entry_serializes_camel_case() {
        let t = TraceEntry::new("quiet_hours", "reschedule", Some("2026-06-12T04:30:00Z".into()));
        let v = serde_json::to_value(&t).unwrap();
        assert_eq!(v["check"], "quiet_hours");
        assert_eq!(v["verdict"], "reschedule");
        assert_eq!(v["detail"], "2026-06-12T04:30:00Z");
        let none = TraceEntry::new("consent", "allow", None);
        let v = serde_json::to_value(&none).unwrap();
        assert!(v.get("detail").is_none());
    }
}
