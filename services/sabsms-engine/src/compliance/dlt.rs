//! India DLT (Distributed Ledger Technology) scrubbing simulator — V2.8.
//!
//! Pure logic only: no Mongo, no Redis, no env. The registry cache and
//! kernel wiring live in [`super::dlt_store`] and [`super`]; the HTTP
//! preview endpoint lives in `handlers::dlt`.
//!
//! ## What operators actually do (and what we simulate)
//!
//! Every commercial SMS terminating in India is scrubbed on the DLT
//! ledger before the operator forwards it: the header (sender id) must
//! be registered, the content must match a registered content template,
//! and the PE (principal entity) → TM (telemarketer) chain must be
//! bound (max 2 TMs). Registered templates carry fixed text with
//! `{#var#}` placeholders; each variable fill is limited to 30
//! characters. Since May 2025 the operator appends a category suffix to
//! the header: `-P` promotional, `-S` service (explicit AND implicit),
//! `-T` transactional, `-G` government.
//!
//! ## Documented simulator assumptions (this module IS the spec)
//!
//! Operator portals (Airtel/Jio/VIL/BSNL) disagree on edge cases; where
//! they do, we make these deterministic choices:
//!
//!  1. **Whitespace-normalized compare** — runs of Unicode whitespace
//!     (incl. newlines) collapse to a single ASCII space on BOTH the
//!     registered body and the message, then both are trimmed. A
//!     multiline registered template therefore matches a single-line
//!     message with the same words.
//!  2. **Variable length is counted in Unicode scalar values** (Rust
//!     `char`s) of the normalized fill — 30 max, per TRAI's 30-char
//!     limit. (Operators count UTF-16 units for unicode templates; code
//!     points are the stricter, safer choice for Devanagari text.)
//!  3. **Empty variable fills fail** (`var_empty_where_required`): a
//!     `{#var#}` slot must consume at least 1 character. Some operators
//!     pass empty fills; we fail closed because Airtel does not.
//!  4. **Adjacent `{#var#}{#var#}` slots merge**: a run of N adjacent
//!     vars must consume between N and N*30 characters in total —
//!     individual attribution inside the run is impossible.
//!  5. **The `{#var#}` token is matched case-insensitively**
//!     (`{#VAR#}` appears in some portal CSV exports).
//!  6. **Pass/fail is exact** (full backtracking over fill lengths);
//!     the *named failing check* on a fail is best-effort diagnosis via
//!     a greedy pass and may pick one of several simultaneous problems.
//!
//! The anti-drift contract for all of the above is
//! `tests/fixtures/dlt-corpus.json` (50+ operator-style cases) executed
//! by `tests/dlt_corpus.rs`.

use serde::{Deserialize, Serialize};

use super::TraceEntry;

// ─── Registry types (wire/Mongo shapes, camelCase) ──────────────────────

/// Registered content-template category. Wire form is snake_case to
/// match the rest of the engine's enums (`MessageCategory` etc.).
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DltCategory {
    Promotional,
    ServiceExplicit,
    ServiceImplicit,
    Transactional,
    Government,
}

impl DltCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            DltCategory::Promotional => "promotional",
            DltCategory::ServiceExplicit => "service_explicit",
            DltCategory::ServiceImplicit => "service_implicit",
            DltCategory::Transactional => "transactional",
            DltCategory::Government => "government",
        }
    }

    /// Parse the wire / Mongo string form. Tolerates the hyphenated
    /// forms operator CSVs use (`service-explicit`, `Service Implicit`).
    pub fn parse(s: &str) -> Option<DltCategory> {
        let norm = s.trim().to_ascii_lowercase().replace(['-', ' '], "_");
        Some(match norm.as_str() {
            "promotional" | "promo" | "p" => DltCategory::Promotional,
            "service_explicit" | "se" => DltCategory::ServiceExplicit,
            "service_implicit" | "service" | "si" => DltCategory::ServiceImplicit,
            "transactional" | "txn" | "t" => DltCategory::Transactional,
            "government" | "govt" | "g" => DltCategory::Government,
            _ => return None,
        })
    }
}

/// A registered DLT content template (`sabsms_dlt_templates`).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DltTemplate {
    /// Operator-issued content-template id (TE_ID), e.g. "1107…".
    pub template_id: String,
    /// Header ids this template is bound to on the portal.
    #[serde(default)]
    pub header_ids: Vec<String>,
    pub category: DltCategory,
    /// Registered body with `{#var#}` placeholders.
    pub body: String,
    /// Owning principal entity (PE_ID).
    pub pe_id: String,
}

/// A registered DLT header / sender id (`sabsms_dlt_headers`).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DltHeader {
    /// Operator-issued header id.
    pub header_id: String,
    /// The sender string itself (e.g. "SABNDE").
    pub header: String,
    pub category: DltCategory,
}

/// The PE → TM chain (`sabsms_dlt_chains`, one per workspace).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DltChain {
    pub pe_id: String,
    /// Telemarketer ids, in delivery order. TRAI caps the chain at 2.
    #[serde(default)]
    pub tm_ids: Vec<String>,
}

// ─── Scrub simulation ────────────────────────────────────────────────────

/// Result of simulating operator template-matching for one message.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ScrubResult {
    Pass,
    Fail {
        /// One of: `fixed_text_mismatch`, `var_too_long`,
        /// `var_empty_where_required`, `extra_trailing_text`.
        check: &'static str,
        detail: String,
    },
}

/// Maximum characters a single `{#var#}` fill may consume.
pub const VAR_MAX_CHARS: usize = 30;

/// Collapse Unicode whitespace runs to single spaces and trim.
pub fn normalize_ws(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// One token of a parsed registered body.
#[derive(Clone, Debug, PartialEq, Eq)]
enum Token {
    Fixed(Vec<char>),
    /// A run of `n` adjacent `{#var#}` slots (assumption #4).
    Vars(usize),
}

/// Split a normalized registered body on `{#var#}` (case-insensitive,
/// assumption #5) into Fixed/Vars tokens, merging adjacent var slots.
fn tokenize(registered_norm: &str) -> Vec<Token> {
    let chars: Vec<char> = registered_norm.chars().collect();
    let lower: Vec<char> = registered_norm
        .to_lowercase()
        .chars()
        .collect::<Vec<char>>();
    // `to_lowercase` can change char counts for exotic scripts; the
    // `{#var#}` marker is pure ASCII, so fall back to byte-identical
    // scanning when lengths diverge.
    let scan: &[char] = if lower.len() == chars.len() { &lower } else { &chars };

    const MARKER: [char; 7] = ['{', '#', 'v', 'a', 'r', '#', '}'];
    let mut tokens: Vec<Token> = Vec::new();
    let mut fixed_start = 0usize;
    let mut i = 0usize;
    while i < chars.len() {
        if i + MARKER.len() <= scan.len() && scan[i..i + MARKER.len()] == MARKER {
            if i > fixed_start {
                tokens.push(Token::Fixed(chars[fixed_start..i].to_vec()));
            }
            match tokens.last_mut() {
                Some(Token::Vars(n)) => *n += 1,
                _ => tokens.push(Token::Vars(1)),
            }
            i += MARKER.len();
            fixed_start = i;
        } else {
            i += 1;
        }
    }
    if fixed_start < chars.len() {
        tokens.push(Token::Fixed(chars[fixed_start..].to_vec()));
    }
    tokens
}

/// Exact matcher: can `msg[pos..]` satisfy `tokens[ti..]`? Backtracks
/// over var-fill lengths (assumption #6). SMS bodies are tiny, so the
/// quadratic worst case is irrelevant.
fn matches_from(tokens: &[Token], ti: usize, msg: &[char], pos: usize) -> bool {
    if ti == tokens.len() {
        return pos == msg.len();
    }
    match &tokens[ti] {
        Token::Fixed(f) => {
            if pos + f.len() <= msg.len() && &msg[pos..pos + f.len()] == f.as_slice() {
                matches_from(tokens, ti + 1, msg, pos + f.len())
            } else {
                false
            }
        }
        Token::Vars(n) => {
            let min = *n;
            let max = n * VAR_MAX_CHARS;
            // A var run at the very end: just check the remaining length.
            if ti + 1 == tokens.len() {
                let rest = msg.len() - pos;
                return rest >= min && rest <= max;
            }
            let upper = max.min(msg.len().saturating_sub(pos));
            for fill in min..=upper {
                if matches_from(tokens, ti + 1, msg, pos + fill) {
                    return true;
                }
            }
            false
        }
    }
}

/// Find the leftmost occurrence of `needle` in `hay[from..]`.
fn find_from(hay: &[char], needle: &[char], from: usize) -> Option<usize> {
    if needle.is_empty() {
        return Some(from);
    }
    if hay.len() < needle.len() {
        return None;
    }
    (from..=hay.len() - needle.len()).find(|&i| &hay[i..i + needle.len()] == needle)
}

fn snippet(chars: &[char]) -> String {
    let s: String = chars.iter().take(40).collect();
    if chars.len() > 40 {
        format!("{s}…")
    } else {
        s
    }
}

/// Best-effort diagnosis after the exact matcher failed (assumption #6):
/// greedy leftmost walk recording where the first constraint breaks.
fn diagnose(tokens: &[Token], msg: &[char]) -> ScrubResult {
    let mut pos = 0usize;
    let mut i = 0usize;
    while i < tokens.len() {
        match &tokens[i] {
            Token::Fixed(f) => {
                // Was this fixed segment preceded by a var run?
                let preceded_by_vars = matches!(
                    i.checked_sub(1).map(|p| &tokens[p]),
                    Some(Token::Vars(_))
                );
                let var_min = match i.checked_sub(1).map(|p| &tokens[p]) {
                    Some(Token::Vars(n)) => *n,
                    _ => 0,
                };
                let var_max = match i.checked_sub(1).map(|p| &tokens[p]) {
                    Some(Token::Vars(n)) => n * VAR_MAX_CHARS,
                    _ => 0,
                };
                if preceded_by_vars {
                    // `pos` currently sits at the start of the fill.
                    match find_from(msg, f, pos) {
                        None => {
                            return ScrubResult::Fail {
                                check: "fixed_text_mismatch",
                                detail: format!(
                                    "registered segment \"{}\" not found in message",
                                    snippet(f)
                                ),
                            }
                        }
                        Some(at) => {
                            let fill = at - pos;
                            if fill < var_min {
                                return ScrubResult::Fail {
                                    check: "var_empty_where_required",
                                    detail: format!(
                                        "variable fill before \"{}\" is empty (each {{#var#}} must consume ≥1 char)",
                                        snippet(f)
                                    ),
                                };
                            }
                            if fill > var_max {
                                return ScrubResult::Fail {
                                    check: "var_too_long",
                                    detail: format!(
                                        "variable fill before \"{}\" is {} chars (max {} for {} slot(s))",
                                        snippet(f), fill, var_max, var_min
                                    ),
                                };
                            }
                            pos = at + f.len();
                        }
                    }
                } else {
                    // Anchored: must match exactly at `pos`.
                    if pos + f.len() > msg.len() || &msg[pos..pos + f.len()] != f.as_slice() {
                        return ScrubResult::Fail {
                            check: "fixed_text_mismatch",
                            detail: format!(
                                "message diverges from registered segment \"{}\"",
                                snippet(f)
                            ),
                        };
                    }
                    pos += f.len();
                }
                i += 1;
            }
            Token::Vars(n) => {
                if i + 1 == tokens.len() {
                    // Trailing var run.
                    let rest = msg.len() - pos.min(msg.len());
                    if rest < *n {
                        return ScrubResult::Fail {
                            check: "var_empty_where_required",
                            detail: format!(
                                "trailing variable fill is {rest} chars; {n} slot(s) need ≥{n}"
                            ),
                        };
                    }
                    if rest > n * VAR_MAX_CHARS {
                        return ScrubResult::Fail {
                            check: "var_too_long",
                            detail: format!(
                                "trailing variable fill is {rest} chars (max {})",
                                n * VAR_MAX_CHARS
                            ),
                        };
                    }
                    pos = msg.len();
                }
                // Non-trailing var runs are consumed by the following
                // Fixed arm above.
                i += 1;
            }
        }
    }
    if pos < msg.len() {
        return ScrubResult::Fail {
            check: "extra_trailing_text",
            detail: format!(
                "message has {} extra trailing char(s): \"{}\"",
                msg.len() - pos,
                snippet(&msg[pos..])
            ),
        };
    }
    // Greedy walk passed but exact matcher failed — greedy over-consumed
    // somewhere. Attribute to the fixed text since alignment failed.
    ScrubResult::Fail {
        check: "fixed_text_mismatch",
        detail: "message does not align with the registered template".to_string(),
    }
}

/// Simulate operator scrubbing of `message_body` against the registered
/// `template_body_registered` (with `{#var#}` markers). See the module
/// docs for the documented assumptions.
pub fn scrub(template_body_registered: &str, message_body: &str) -> ScrubResult {
    let reg = normalize_ws(template_body_registered);
    let msg_s = normalize_ws(message_body);
    let msg: Vec<char> = msg_s.chars().collect();
    let tokens = tokenize(&reg);

    if tokens.is_empty() {
        // Empty registered body: only an empty message matches.
        return if msg.is_empty() {
            ScrubResult::Pass
        } else {
            ScrubResult::Fail {
                check: "extra_trailing_text",
                detail: "registered template is empty but the message is not".to_string(),
            }
        };
    }

    if matches_from(&tokens, 0, &msg, 0) {
        ScrubResult::Pass
    } else {
        diagnose(&tokens, &msg)
    }
}

// ─── Suffix prediction ───────────────────────────────────────────────────

/// Header suffix the operator will append for a registered category
/// (TRAI, in force since May 2025). ServiceImplicit and ServiceExplicit
/// both map to `S`.
pub fn predict_suffix(category: DltCategory) -> char {
    match category {
        DltCategory::Promotional => 'P',
        DltCategory::ServiceExplicit | DltCategory::ServiceImplicit => 'S',
        DltCategory::Transactional => 'T',
        DltCategory::Government => 'G',
    }
}

// ─── Content classification (advisory hint only) ────────────────────────

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PredictedCategory {
    Promotional,
    Transactional,
    Service,
    Unknown,
}

impl PredictedCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            PredictedCategory::Promotional => "promotional",
            PredictedCategory::Transactional => "transactional",
            PredictedCategory::Service => "service",
            PredictedCategory::Unknown => "unknown",
        }
    }
}

const PROMO_MARKERS: &[&str] = &[
    "offer", "discount", "sale", "% off", "percent off", "buy now", "buy 1", "buy one",
    "free", "cashback", "deal", "coupon", "limited time", "shop now", "flat ", "hurry",
    "exclusive", "win ", "lucky draw", "upgrade now", "lowest price", "mega",
];

const TXN_MARKERS: &[&str] = &[
    "otp", "one time password", "verification code", "verify", "code is", "order",
    "delivered", "delivery", "shipped", "payment", "paid", "txn", "transaction",
    "debited", "credited", "invoice", "receipt", "password", "login", "pin is",
];

const SERVICE_MARKERS: &[&str] = &[
    "balance", "reminder", "appointment", "update", "due on", "due date", "renewal",
    "scheduled", "booking", "status", "expires", "expiry", "policy", "statement",
    "bill", "recharge", "validity",
];

/// Deterministic keyword/structure classifier for message content.
/// Returns the most likely category and a confidence in `[0, 1]`.
///
/// This is a HINT only: it drives the advisory `dlt_category_content`
/// warning and never blocks a send by itself.
pub fn classify_content(body: &str) -> (PredictedCategory, f64) {
    let lower = body.to_lowercase();
    let count = |markers: &[&str]| -> usize {
        markers.iter().filter(|m| lower.contains(*m)).count()
    };

    let mut promo = count(PROMO_MARKERS) as f64;
    let txn = count(TXN_MARKERS) as f64;
    let service = count(SERVICE_MARKERS) as f64;

    // Link-heavy bodies skew promotional (structure marker).
    let links = lower.matches("http://").count() + lower.matches("https://").count();
    if links >= 1 {
        promo += links as f64 * 0.5;
    }

    let total = promo + txn + service;
    if total == 0.0 {
        return (PredictedCategory::Unknown, 0.0);
    }
    let (cat, top) = if promo >= txn && promo >= service {
        (PredictedCategory::Promotional, promo)
    } else if txn >= service {
        (PredictedCategory::Transactional, txn)
    } else {
        (PredictedCategory::Service, service)
    };
    // Confidence: share of the winning bucket, dampened for low totals.
    let share = top / total;
    let strength = (top / 3.0).min(1.0);
    (cat, (share * strength * 100.0).round() / 100.0)
}

/// Does a predicted content category contradict the registered template
/// category? (`Unknown` and same-family pairs never conflict.)
pub fn category_conflicts(registered: DltCategory, predicted: PredictedCategory) -> bool {
    match (registered, predicted) {
        (_, PredictedCategory::Unknown) => false,
        (DltCategory::Promotional, PredictedCategory::Promotional) => false,
        (DltCategory::Promotional, _) => true,
        (DltCategory::Transactional, PredictedCategory::Transactional) => false,
        // Transactional content showing up under service templates (and
        // vice-versa) is common and operator-tolerated; only promo
        // content under a non-promo template is a real flag.
        (DltCategory::Transactional, PredictedCategory::Service) => false,
        (DltCategory::Transactional, PredictedCategory::Promotional) => true,
        (
            DltCategory::ServiceExplicit | DltCategory::ServiceImplicit | DltCategory::Government,
            PredictedCategory::Promotional,
        ) => true,
        _ => false,
    }
}

// ─── Chain validation ────────────────────────────────────────────────────

/// Validate a PE → TM chain: non-empty PE, every TM id non-empty, and at
/// most 2 TMs (TRAI cap).
pub fn validate_chain(chain: &DltChain) -> Result<(), String> {
    if chain.pe_id.trim().is_empty() {
        return Err("principal entity (PE) id is empty".to_string());
    }
    if chain.tm_ids.len() > 2 {
        return Err(format!(
            "chain has {} telemarketers; TRAI allows at most 2",
            chain.tm_ids.len()
        ));
    }
    if chain.tm_ids.iter().any(|t| t.trim().is_empty()) {
        return Err("chain contains an empty telemarketer id".to_string());
    }
    Ok(())
}

// ─── Full scrub (state-/context-free) ────────────────────────────────────

/// Everything the full scrub needs, pre-resolved by the caller (the
/// kernel or the preview endpoint) so this stays pure.
pub struct FullScrubContext<'a> {
    /// Final message body (post-render).
    pub body: &'a str,
    /// Sender header the message will use, if known.
    pub header: Option<&'a str>,
    /// Registered header doc matching `header`, if the registry has one.
    pub registered_header: Option<&'a DltHeader>,
    /// The registered template the message claims, if resolved.
    pub template: Option<&'a DltTemplate>,
    /// Workspace PE → TM chain, if configured.
    pub chain: Option<&'a DltChain>,
}

/// Run every DLT check and return the trace. Verdicts:
///   - `allow` / `block` — enforcing checks
///   - `warn` — advisory only (never blocks)
///   - `skipped` — insufficient context for the check
///
/// Check names (all `dlt_*`, feeding the standard `complianceTrace`):
/// `dlt_header_registered`, `dlt_header_bound`, `dlt_template_match`,
/// `dlt_chain`, `dlt_category_content`.
pub fn full_scrub(ctx: &FullScrubContext<'_>) -> Vec<TraceEntry> {
    let mut trace: Vec<TraceEntry> = Vec::with_capacity(5);

    // 1. Header registered.
    match (ctx.header, ctx.registered_header) {
        (Some(h), Some(reg)) => trace.push(TraceEntry::new(
            "dlt_header_registered",
            "allow",
            Some(format!("header '{}' registered (id {})", h, reg.header_id)),
        )),
        (Some(h), None) => trace.push(TraceEntry::new(
            "dlt_header_registered",
            "block",
            Some(format!("header '{h}' is not a registered DLT header")),
        )),
        (None, _) => trace.push(TraceEntry::new(
            "dlt_header_registered",
            "warn",
            Some("no sender header on message; operator will reject unheadered traffic".into()),
        )),
    }

    // 2. Header bound to the template.
    match (ctx.template, ctx.registered_header) {
        (Some(t), Some(reg)) => {
            if t.header_ids.is_empty() {
                trace.push(TraceEntry::new(
                    "dlt_header_bound",
                    "warn",
                    Some("template has no header bindings on record; binding not verified".into()),
                ));
            } else if t.header_ids.iter().any(|id| id == &reg.header_id) {
                trace.push(TraceEntry::new("dlt_header_bound", "allow", None));
            } else {
                trace.push(TraceEntry::new(
                    "dlt_header_bound",
                    "block",
                    Some(format!(
                        "header '{}' (id {}) is not bound to template {}",
                        reg.header, reg.header_id, t.template_id
                    )),
                ));
            }
        }
        _ => trace.push(TraceEntry::new(
            "dlt_header_bound",
            "skipped",
            Some("template or registered header unresolved".into()),
        )),
    }

    // 3. Template content match.
    match ctx.template {
        Some(t) => match scrub(&t.body, ctx.body) {
            ScrubResult::Pass => trace.push(TraceEntry::new(
                "dlt_template_match",
                "allow",
                Some(format!("matches template {}", t.template_id)),
            )),
            ScrubResult::Fail { check, detail } => trace.push(TraceEntry::new(
                "dlt_template_match",
                "block",
                Some(format!("{check}: {detail}")),
            )),
        },
        None => trace.push(TraceEntry::new(
            "dlt_template_match",
            "skipped",
            Some("no registered template resolved".into()),
        )),
    }

    // 4. PE → TM chain.
    match ctx.chain {
        Some(chain) => match validate_chain(chain) {
            Ok(()) => trace.push(TraceEntry::new(
                "dlt_chain",
                "allow",
                Some(format!("PE {} with {} TM(s)", chain.pe_id, chain.tm_ids.len())),
            )),
            Err(e) => trace.push(TraceEntry::new("dlt_chain", "block", Some(e))),
        },
        None => trace.push(TraceEntry::new(
            "dlt_chain",
            "warn",
            Some("no PE-TM chain configured for workspace".into()),
        )),
    }

    // 5. Category vs content — ADVISORY (warn, never block).
    if let Some(t) = ctx.template {
        let (predicted, confidence) = classify_content(ctx.body);
        if confidence >= 0.5 && category_conflicts(t.category, predicted) {
            trace.push(TraceEntry::new(
                "dlt_category_content",
                "warn",
                Some(format!(
                    "content classifies as {} (confidence {confidence:.2}) but template {} is registered {}",
                    predicted.as_str(),
                    t.template_id,
                    t.category.as_str()
                )),
            ));
        } else {
            trace.push(TraceEntry::new(
                "dlt_category_content",
                "allow",
                Some(format!(
                    "content hint: {} (confidence {confidence:.2})",
                    predicted.as_str()
                )),
            ));
        }
    } else {
        trace.push(TraceEntry::new(
            "dlt_category_content",
            "skipped",
            Some("no registered template resolved".into()),
        ));
    }

    trace
}

/// First enforcing failure in a full-scrub trace, if any.
pub fn first_block(trace: &[TraceEntry]) -> Option<(&str, &str)> {
    trace
        .iter()
        .find(|t| t.verdict == "block")
        .map(|t| (t.check.as_str(), t.detail.as_deref().unwrap_or("")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tpl(category: DltCategory, body: &str) -> DltTemplate {
        DltTemplate {
            template_id: "TE1".into(),
            header_ids: vec!["H1".into()],
            category,
            body: body.into(),
            pe_id: "PE1".into(),
        }
    }

    #[test]
    fn suffix_mapping_matches_trai() {
        assert_eq!(predict_suffix(DltCategory::Promotional), 'P');
        assert_eq!(predict_suffix(DltCategory::ServiceExplicit), 'S');
        assert_eq!(predict_suffix(DltCategory::ServiceImplicit), 'S');
        assert_eq!(predict_suffix(DltCategory::Transactional), 'T');
        assert_eq!(predict_suffix(DltCategory::Government), 'G');
    }

    #[test]
    fn category_parse_tolerates_portal_forms() {
        assert_eq!(DltCategory::parse("Promotional"), Some(DltCategory::Promotional));
        assert_eq!(DltCategory::parse("service-explicit"), Some(DltCategory::ServiceExplicit));
        assert_eq!(DltCategory::parse("Service Implicit"), Some(DltCategory::ServiceImplicit));
        assert_eq!(DltCategory::parse("TXN"), Some(DltCategory::Transactional));
        assert_eq!(DltCategory::parse("nonsense"), None);
    }

    #[test]
    fn scrub_exact_match_passes() {
        assert_eq!(scrub("Hello world", "Hello world"), ScrubResult::Pass);
    }

    #[test]
    fn scrub_single_var_passes() {
        assert_eq!(
            scrub("Your OTP is {#var#}.", "Your OTP is 482913."),
            ScrubResult::Pass
        );
    }

    #[test]
    fn scrub_var_31_chars_fails_too_long() {
        let fill = "x".repeat(31);
        match scrub("Code: {#var#} end", &format!("Code: {fill} end")) {
            ScrubResult::Fail { check, .. } => assert_eq!(check, "var_too_long"),
            other => panic!("expected fail, got {other:?}"),
        }
    }

    #[test]
    fn scrub_empty_var_fails() {
        match scrub("Hi {#var#}, welcome", "Hi , welcome") {
            ScrubResult::Fail { check, .. } => assert_eq!(check, "var_empty_where_required"),
            other => panic!("expected fail, got {other:?}"),
        }
    }

    #[test]
    fn scrub_trailing_extra_text_fails() {
        match scrub("Your OTP is {#var#}", "Your OTP is 4829 call us now at once okay yes") {
            // Trailing var absorbs ≤30 chars; this fill is 33.
            ScrubResult::Fail { check, .. } => assert_eq!(check, "var_too_long"),
            other => panic!("expected fail, got {other:?}"),
        }
        match scrub("Order confirmed.", "Order confirmed. Visit example.com") {
            ScrubResult::Fail { check, .. } => assert_eq!(check, "extra_trailing_text"),
            other => panic!("expected fail, got {other:?}"),
        }
    }

    #[test]
    fn scrub_adjacent_vars_merge() {
        // 2 adjacent slots: 2..=60 chars combined.
        assert_eq!(
            scrub("Ref {#var#}{#var#} ok", &format!("Ref {} ok", "a".repeat(60))),
            ScrubResult::Pass
        );
        match scrub("Ref {#var#}{#var#} ok", &format!("Ref {} ok", "a".repeat(61))) {
            ScrubResult::Fail { check, .. } => assert_eq!(check, "var_too_long"),
            other => panic!("expected fail, got {other:?}"),
        }
    }

    #[test]
    fn scrub_whitespace_normalized() {
        assert_eq!(
            scrub("Dear {#var#},\nYour code is {#var#}.", "Dear  Asha , Your code is 1234."),
            ScrubResult::Pass
        );
    }

    #[test]
    fn classifier_flags_promo() {
        let (cat, conf) = classify_content("FLAT 50% off! Limited time offer, shop now");
        assert_eq!(cat, PredictedCategory::Promotional);
        assert!(conf > 0.5, "conf={conf}");
    }

    #[test]
    fn classifier_flags_txn() {
        let (cat, _) = classify_content("Your OTP is 123456. Do not share this code");
        assert_eq!(cat, PredictedCategory::Transactional);
    }

    #[test]
    fn classifier_unknown_on_neutral_text() {
        let (cat, conf) = classify_content("Hello there, good morning");
        assert_eq!(cat, PredictedCategory::Unknown);
        assert_eq!(conf, 0.0);
    }

    #[test]
    fn chain_validation_caps_two_tms() {
        let ok = DltChain { pe_id: "PE1".into(), tm_ids: vec!["TM1".into(), "TM2".into()] };
        assert!(validate_chain(&ok).is_ok());
        let too_many = DltChain {
            pe_id: "PE1".into(),
            tm_ids: vec!["TM1".into(), "TM2".into(), "TM3".into()],
        };
        assert!(validate_chain(&too_many).is_err());
        let no_pe = DltChain { pe_id: " ".into(), tm_ids: vec![] };
        assert!(validate_chain(&no_pe).is_err());
    }

    #[test]
    fn full_scrub_unregistered_header_blocks() {
        let t = tpl(DltCategory::Transactional, "Your OTP is {#var#}");
        let ctx = FullScrubContext {
            body: "Your OTP is 482913",
            header: Some("BADHDR"),
            registered_header: None,
            template: Some(&t),
            chain: None,
        };
        let trace = full_scrub(&ctx);
        let (check, _) = first_block(&trace).expect("expected a block");
        assert_eq!(check, "dlt_header_registered");
    }

    #[test]
    fn full_scrub_happy_path_no_blocks() {
        let t = tpl(DltCategory::Transactional, "Your OTP is {#var#}");
        let h = DltHeader {
            header_id: "H1".into(),
            header: "SABNDE".into(),
            category: DltCategory::Transactional,
        };
        let chain = DltChain { pe_id: "PE1".into(), tm_ids: vec!["TM1".into()] };
        let ctx = FullScrubContext {
            body: "Your OTP is 482913",
            header: Some("SABNDE"),
            registered_header: Some(&h),
            template: Some(&t),
            chain: Some(&chain),
        };
        let trace = full_scrub(&ctx);
        assert!(first_block(&trace).is_none(), "trace: {trace:?}");
        assert_eq!(trace.len(), 5);
    }

    #[test]
    fn full_scrub_category_mismatch_is_warning_not_block() {
        let t = tpl(DltCategory::Transactional, "{#var#}");
        let ctx = FullScrubContext {
            body: "FLAT 50% off sale! offer",
            header: None,
            registered_header: None,
            template: Some(&t),
            chain: None,
        };
        let trace = full_scrub(&ctx);
        let cat = trace.iter().find(|t| t.check == "dlt_category_content").unwrap();
        assert_eq!(cat.verdict, "warn");
    }

    #[test]
    fn dlt_template_serializes_camel_case() {
        let t = tpl(DltCategory::ServiceImplicit, "Hi {#var#}");
        let v = serde_json::to_value(&t).unwrap();
        assert_eq!(v["templateId"], "TE1");
        assert_eq!(v["headerIds"][0], "H1");
        assert_eq!(v["category"], "service_implicit");
        assert_eq!(v["peId"], "PE1");
    }
}
