//! Pure matching engine — evaluates a rule against a simulated/real
//! message. Lives outside `handlers.rs` so the public `match_rules`
//! function in `lib.rs` and the BFF endpoints can share it.

use bson::Document;
use chrono::{Datelike, Timelike};
use regex::RegexBuilder;
use serde_json::Value;

use crate::dto::{EvalStep, MatchUpdate, SimulatedMessage};

/// Normalised view of a message we test rules against.
#[derive(Debug, Clone, Default)]
pub struct Probe {
    pub text: Option<String>,
    pub has_media: bool,
    pub is_group: bool,
    pub chat_id: Option<String>,
    pub from_user_id: Option<String>,
    pub sender_tag: Option<String>,
    pub sender_role: Option<String>,
    pub language_code: Option<String>,
    pub is_first_message: bool,
}

impl From<SimulatedMessage> for Probe {
    fn from(s: SimulatedMessage) -> Self {
        Self {
            text: s.text,
            has_media: s.has_media.unwrap_or(false),
            is_group: s.is_group.unwrap_or(false),
            chat_id: s.chat_id,
            from_user_id: s.from_user_id,
            sender_tag: s.sender_tag,
            sender_role: s.sender_role,
            language_code: s.language_code,
            is_first_message: s.is_first_message.unwrap_or(false),
        }
    }
}

impl From<MatchUpdate> for Probe {
    fn from(s: MatchUpdate) -> Self {
        Self {
            text: s.text,
            has_media: s.has_media.unwrap_or(false),
            is_group: s.is_group.unwrap_or(false),
            chat_id: s.chat_id,
            from_user_id: s.from_user_id,
            sender_tag: s.sender_tag,
            sender_role: s.sender_role,
            language_code: s.language_code,
            is_first_message: s.is_first_message.unwrap_or(false),
        }
    }
}

fn lower_if(s: &str, case_sensitive: bool) -> String {
    if case_sensitive {
        s.to_owned()
    } else {
        s.to_lowercase()
    }
}

fn as_str_array(v: &Value) -> Vec<String> {
    match v {
        Value::Array(arr) => arr
            .iter()
            .filter_map(|x| x.as_str().map(str::to_owned))
            .collect(),
        Value::String(s) => s
            .split(',')
            .map(|p| p.trim().to_owned())
            .filter(|p| !p.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

/// Outcome of `evaluate_rule`.
#[derive(Debug, Clone)]
pub struct EvalOutcome {
    pub matched: bool,
    pub steps: Vec<EvalStep>,
}

/// Convert a stored bson rule document into a JSON value for the
/// engine (we use serde_json throughout for trigger/conditions/actions).
pub fn doc_to_json(d: &Document) -> Value {
    let raw = bson::Bson::Document(d.clone()).into_relaxed_extjson();
    serde_json::from_value(raw).unwrap_or(Value::Null)
}

fn evaluate_trigger(trigger: &Value, probe: &Probe, step: &mut Vec<EvalStep>) -> bool {
    let kind = trigger.get("kind").and_then(|v| v.as_str()).unwrap_or("");
    let case_sensitive = trigger
        .get("caseSensitive")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let language_filter = trigger
        .get("languageCode")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    if let Some(want) = language_filter
        && let Some(have) = probe.language_code.as_deref()
        && !have.eq_ignore_ascii_case(want)
    {
        step.push(EvalStep {
            stage: "trigger".to_owned(),
            label: format!("language mismatch ({have} != {want})"),
            passed: false,
            detail: None,
        });
        return false;
    }

    let text = probe.text.clone().unwrap_or_default();
    let haystack = lower_if(&text, case_sensitive);

    let pass = match kind {
        "keyword" | "contains" => {
            let needles = as_str_array(trigger.get("payload").unwrap_or(&Value::Null));
            if needles.is_empty() {
                step.push(EvalStep {
                    stage: "trigger".to_owned(),
                    label: "keyword: empty payload".to_owned(),
                    passed: false,
                    detail: None,
                });
                return false;
            }
            let hit = needles
                .iter()
                .any(|n| haystack.contains(&lower_if(n, case_sensitive)));
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("keyword in [{}]", needles.join(", ")),
                passed: hit,
                detail: Some(format!("text={text:?}")),
            });
            hit
        }
        "contains_any" => {
            let needles = as_str_array(trigger.get("payload").unwrap_or(&Value::Null));
            let hit = needles
                .iter()
                .any(|n| haystack.contains(&lower_if(n, case_sensitive)));
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("contains_any [{}]", needles.join(", ")),
                passed: hit,
                detail: None,
            });
            hit
        }
        "exact" => {
            let want = trigger
                .get("payload")
                .and_then(|v| v.as_str())
                .map(|s| lower_if(s, case_sensitive))
                .unwrap_or_default();
            let hit = haystack == want;
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("exact == {want:?}"),
                passed: hit,
                detail: None,
            });
            hit
        }
        "starts_with" => {
            let want = trigger
                .get("payload")
                .and_then(|v| v.as_str())
                .map(|s| lower_if(s, case_sensitive))
                .unwrap_or_default();
            let hit = !want.is_empty() && haystack.starts_with(&want);
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("starts_with {want:?}"),
                passed: hit,
                detail: None,
            });
            hit
        }
        "regex" => {
            let pattern = trigger
                .get("payload")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let built = RegexBuilder::new(pattern)
                .case_insensitive(!case_sensitive)
                .build();
            match built {
                Ok(re) => {
                    let hit = re.is_match(&text);
                    step.push(EvalStep {
                        stage: "trigger".to_owned(),
                        label: format!("regex /{pattern}/"),
                        passed: hit,
                        detail: None,
                    });
                    hit
                }
                Err(e) => {
                    step.push(EvalStep {
                        stage: "trigger".to_owned(),
                        label: format!("regex /{pattern}/"),
                        passed: false,
                        detail: Some(format!("invalid regex: {e}")),
                    });
                    false
                }
            }
        }
        "business_hours" => {
            // Treat empty payload as "business hours = 9..18 mon-fri UTC".
            let now = chrono::Utc::now();
            let hour = now.hour() as i64;
            let weekday = now.weekday().num_days_from_monday() as i64;
            let payload = trigger.get("payload");
            let start = payload
                .and_then(|p| p.get("startHour"))
                .and_then(|v| v.as_i64())
                .unwrap_or(9);
            let end = payload
                .and_then(|p| p.get("endHour"))
                .and_then(|v| v.as_i64())
                .unwrap_or(18);
            let weekdays = payload
                .and_then(|p| p.get("weekdays"))
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|x| x.as_i64()).collect::<Vec<_>>())
                .unwrap_or_else(|| (0..5).collect());
            let in_hours = hour >= start && hour < end && weekdays.contains(&weekday);
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("business_hours {start:02}:00–{end:02}:00 UTC"),
                passed: in_hours,
                detail: Some(format!("now hour={hour} weekday={weekday}")),
            });
            in_hours
        }
        "first_message" => {
            let hit = probe.is_first_message;
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: "first_message".to_owned(),
                passed: hit,
                detail: None,
            });
            hit
        }
        "media_only" => {
            let hit = probe.has_media;
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: "media_only".to_owned(),
                passed: hit,
                detail: None,
            });
            hit
        }
        _ => {
            step.push(EvalStep {
                stage: "trigger".to_owned(),
                label: format!("unknown trigger kind: {kind}"),
                passed: false,
                detail: None,
            });
            false
        }
    };

    pass
}

fn evaluate_condition(cond: &Value, probe: &Probe, step: &mut Vec<EvalStep>) -> bool {
    let kind = cond.get("kind").and_then(|v| v.as_str()).unwrap_or("");
    let payload = cond.get("payload");

    let pass = match kind {
        "has_media" => probe.has_media,
        "is_group" => probe.is_group,
        "is_private" => !probe.is_group,
        "contact_has_tag" => {
            let want = payload.and_then(|v| v.as_str()).unwrap_or("");
            !want.is_empty() && probe.sender_tag.as_deref() == Some(want)
        }
        "sender_role" => {
            let want = payload.and_then(|v| v.as_str()).unwrap_or("");
            !want.is_empty() && probe.sender_role.as_deref() == Some(want)
        }
        "time_window" => {
            let start = payload
                .and_then(|p| p.get("startHour"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let end = payload
                .and_then(|p| p.get("endHour"))
                .and_then(|v| v.as_i64())
                .unwrap_or(24);
            let hour = chrono::Utc::now().hour() as i64;
            hour >= start && hour < end
        }
        _ => false,
    };

    step.push(EvalStep {
        stage: "condition".to_owned(),
        label: format!("condition {kind}"),
        passed: pass,
        detail: None,
    });

    pass
}

/// Evaluate a single rule (as a `serde_json::Value`) against the probe.
pub fn evaluate_rule(rule: &Value, probe: &Probe) -> EvalOutcome {
    let mut steps = Vec::new();

    let status = rule
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("enabled");
    if status != "enabled" {
        steps.push(EvalStep {
            stage: "status".to_owned(),
            label: "rule disabled".to_owned(),
            passed: false,
            detail: None,
        });
        return EvalOutcome {
            matched: false,
            steps,
        };
    }

    let trigger = rule.get("trigger").cloned().unwrap_or(Value::Null);
    let trigger_ok = evaluate_trigger(&trigger, probe, &mut steps);
    if !trigger_ok {
        return EvalOutcome {
            matched: false,
            steps,
        };
    }

    let conds = rule
        .get("conditions")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for c in conds {
        if !evaluate_condition(&c, probe, &mut steps) {
            return EvalOutcome {
                matched: false,
                steps,
            };
        }
    }

    steps.push(EvalStep {
        stage: "match".to_owned(),
        label: "all checks passed".to_owned(),
        passed: true,
        detail: None,
    });
    EvalOutcome {
        matched: true,
        steps,
    }
}

/// Compute a quick keyword set for the conflict detector. Keyword and
/// contains_any rules report their normalised needles; exact and
/// starts_with report their payload; regex/special triggers return an
/// empty set.
pub fn conflict_signature(trigger: &Value) -> (String, Vec<String>) {
    let kind = trigger
        .get("kind")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let case_sensitive = trigger
        .get("caseSensitive")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let words: Vec<String> = match kind.as_str() {
        "keyword" | "contains_any" => as_str_array(trigger.get("payload").unwrap_or(&Value::Null))
            .into_iter()
            .map(|s| lower_if(&s, case_sensitive))
            .collect(),
        "exact" | "starts_with" => trigger
            .get("payload")
            .and_then(|v| v.as_str())
            .map(|s| vec![lower_if(s, case_sensitive)])
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    (kind, words)
}
