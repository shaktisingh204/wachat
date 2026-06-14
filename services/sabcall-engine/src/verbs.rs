//! Programmable-voice verb runtime.
//!
//! A voice application is a flow of verbs (the Twilio/Fonoster model). The
//! engine fetches the flow (from the application's webhook or a built-in flow)
//! and executes each verb over ARI. `gather` is interactive — it awaits DTMF
//! from the per-channel registry in [`crate::state`].
//!
//! P3 covers: say (TTS placeholder → greeting), play, gather (DTMF), dial,
//! record, pause, hangup. Real TTS for `say` and speech input for `gather`
//! arrive with P4 (STT/TTS integration).

use std::time::Duration;

use serde::Deserialize;

use crate::state::AppState;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "verb", rename_all = "lowercase")]
pub enum Verb {
    /// Speak text (P3: played as the default greeting until TTS lands in P4).
    Say { text: String },
    /// Play a media URI (e.g. `sound:hello-world`).
    Play { media: String },
    /// Collect DTMF digits.
    Gather {
        #[serde(default)]
        prompt: Option<String>,
        #[serde(default = "default_max_digits")]
        max_digits: usize,
        #[serde(default = "default_gather_timeout")]
        timeout_ms: u64,
        #[serde(default)]
        terminator: Option<String>,
    },
    /// Bridge the caller to a destination (number or SIP endpoint).
    Dial { target: String },
    /// Record the caller's audio.
    Record {
        #[serde(default = "default_record_name")]
        name: String,
        #[serde(default = "default_record_secs")]
        max_seconds: u32,
    },
    /// Wait.
    Pause {
        #[serde(default = "default_pause")]
        ms: u64,
    },
    /// End the call.
    Hangup,
}

fn default_max_digits() -> usize {
    1
}
fn default_gather_timeout() -> u64 {
    5000
}
fn default_record_name() -> String {
    "sabcall-recording".to_owned()
}
fn default_record_secs() -> u32 {
    120
}
fn default_pause() -> u64 {
    1000
}

/// Outcome of running a flow — collected digits + whether the call was ended.
#[derive(Debug, Default)]
pub struct FlowResult {
    pub digits: String,
    pub hung_up: bool,
}

/// Execute a verb flow against a channel. Errors on a single verb are logged
/// and the flow continues (best-effort), except `hangup` which stops it.
pub async fn execute_flow(state: &AppState, channel_id: &str, flow: &[Verb]) -> FlowResult {
    let mut result = FlowResult::default();
    for verb in flow {
        match verb {
            Verb::Say { text } => {
                tracing::debug!(channel = channel_id, %text, "verb: say (TTS placeholder)");
                let _ = state.ari.play(channel_id, &state.cfg.default_greeting).await;
            }
            Verb::Play { media } => {
                let _ = state.ari.play(channel_id, media).await;
            }
            Verb::Gather {
                prompt,
                max_digits,
                timeout_ms,
                terminator,
            } => {
                let digits = gather(
                    state,
                    channel_id,
                    prompt.as_deref(),
                    *max_digits,
                    *timeout_ms,
                    terminator.as_deref(),
                )
                .await;
                result.digits = digits;
            }
            Verb::Dial { target } => {
                if let Err(e) = dial(state, channel_id, target).await {
                    tracing::warn!(error = %e, "verb: dial failed");
                }
            }
            Verb::Record { name, max_seconds } => {
                let _ = state.ari.record(channel_id, name, "wav", *max_seconds).await;
            }
            Verb::Pause { ms } => {
                tokio::time::sleep(Duration::from_millis(*ms)).await;
            }
            Verb::Hangup => {
                let _ = state.ari.hangup(channel_id).await;
                result.hung_up = true;
                break;
            }
        }
    }
    result
}

/// Play an optional prompt, then collect DTMF until max digits / terminator /
/// timeout. Uses the per-channel DTMF registry fed by the Stasis loop.
async fn gather(
    state: &AppState,
    channel_id: &str,
    prompt: Option<&str>,
    max_digits: usize,
    timeout_ms: u64,
    terminator: Option<&str>,
) -> String {
    let mut rx = state.register_dtmf(channel_id);
    if let Some(p) = prompt {
        let _ = state.ari.play(channel_id, p).await;
    }
    let mut digits = String::new();
    let deadline = tokio::time::sleep(Duration::from_millis(timeout_ms));
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut deadline => break,
            maybe = rx.recv() => match maybe {
                Some(d) => {
                    if terminator.is_some() && terminator == Some(d.as_str()) {
                        break;
                    }
                    digits.push_str(&d);
                    if digits.len() >= max_digits {
                        break;
                    }
                }
                None => break,
            },
        }
    }
    state.unregister_dtmf(channel_id);
    digits
}

/// Bridge the caller to a dialled destination.
async fn dial(state: &AppState, inbound: &str, target: &str) -> anyhow::Result<()> {
    let endpoint = if target.contains('/') {
        target.to_owned()
    } else {
        format!("PJSIP/{target}")
    };
    let bridge = state.ari.create_bridge().await?;
    let out = state.ari.originate(&endpoint, None, "dialed").await?;
    if let Some(out_id) = out.get("id").and_then(serde_json::Value::as_str) {
        state.ari.add_to_bridge(&bridge, inbound).await?;
        state.ari.add_to_bridge(&bridge, out_id).await?;
    }
    Ok(())
}
