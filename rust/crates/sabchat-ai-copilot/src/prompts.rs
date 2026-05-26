//! Prompt construction helpers.
//!
//! Each public function returns a `(system, user)` tuple ready to feed
//! into [`crate::llm::LlmClient::complete`]. We keep the prompt logic
//! out of the handler so the handler stays focused on I/O and so the
//! shape of each prompt is easy to review in one place.
//!
//! ## History rendering
//!
//! All four prompts share the same history rendering: each message
//! becomes a single line of `"{Role}: {text}"`. Non-text content blocks
//! (images, cards, files, …) collapse to a short `[image]` / `[card]`
//! marker so the model still sees the conversational shape without us
//! shoving binary URLs into the context window. Private notes are
//! excluded — they are agent-only annotations and including them would
//! confuse the model about what the visitor has actually seen.

use sabchat_types::{ContentBlock, MessageDirection, SabChatMessage, SenderType};

// ===========================================================================
// Shared history rendering
// ===========================================================================

/// Render a slice of messages as `"{Role}: {text}"` lines, chronological
/// order. Private notes are dropped. Returns an empty string if there
/// is no usable history.
pub(crate) fn render_history(history: &[SabChatMessage]) -> String {
    let mut out = String::new();
    for m in history {
        if m.private {
            continue;
        }
        let role = role_label(m.sender_type, m.direction);
        let body = render_block(&m.content);
        if body.trim().is_empty() {
            continue;
        }
        out.push_str(&format!("{role}: {body}\n"));
    }
    out
}

/// Short human-readable role tag for a message. The role doubles as the
/// LLM-side speaker label so we keep it terse.
fn role_label(sender: SenderType, dir: MessageDirection) -> &'static str {
    match (sender, dir) {
        (SenderType::Visitor, _) => "Customer",
        (SenderType::Agent, _) => "Agent",
        (SenderType::Bot, _) => "Bot",
        (SenderType::System, _) => "System",
    }
}

/// Render one [`ContentBlock`] as a single line of plain text. Rich
/// blocks collapse to a `[kind]` marker so the model still sees the
/// conversational shape.
fn render_block(b: &ContentBlock) -> String {
    match b {
        ContentBlock::Text { text } => text.clone(),
        ContentBlock::Image { alt, .. } => match alt {
            Some(a) if !a.is_empty() => format!("[image: {a}]"),
            _ => "[image]".to_owned(),
        },
        ContentBlock::File { attachment } => format!("[file: {}]", attachment.name),
        ContentBlock::Voice { transcript, .. } => match transcript {
            Some(t) if !t.is_empty() => format!("[voice: {t}]"),
            _ => "[voice message]".to_owned(),
        },
        ContentBlock::Card { title, .. } => format!("[card: {title}]"),
        ContentBlock::Carousel { cards } => format!("[carousel: {} cards]", cards.len()),
        ContentBlock::Form { fields } => format!("[form: {} fields]", fields.len()),
        ContentBlock::Payment {
            currency,
            amount_minor,
            ..
        } => format!("[payment: {currency} {}]", *amount_minor as f64 / 100.0),
        ContentBlock::Location { label, .. } => match label {
            Some(l) if !l.is_empty() => format!("[location: {l}]"),
            _ => "[location]".to_owned(),
        },
        ContentBlock::System { text } => format!("(system: {text})"),
    }
}

// ===========================================================================
// Per-endpoint prompts
// ===========================================================================

/// Prompt for `POST /draft`. The `hint` (if present) is folded into the
/// user turn so the LLM treats it as steer rather than a hard rule.
pub(crate) fn build_draft_prompt(
    history: &[SabChatMessage],
    hint: Option<&str>,
) -> (String, String) {
    let system = "You are SabChat Copilot, an assistant that helps human \
                  support agents reply to customers. Read the conversation \
                  history below and produce ONE concise, friendly reply the \
                  agent can send next. Match the tone of the conversation. \
                  Do not invent facts; if information is missing, ask one \
                  clarifying question instead.";

    let mut user = String::new();
    user.push_str("Conversation so far (most recent last):\n");
    let h = render_history(history);
    if h.is_empty() {
        user.push_str("(no prior messages)\n");
    } else {
        user.push_str(&h);
    }
    if let Some(h) = hint.map(str::trim).filter(|s| !s.is_empty()) {
        user.push_str("\nAgent hint for the reply: ");
        user.push_str(h);
        user.push('\n');
    }
    user.push_str("\nWrite the next reply only — no preamble, no quoting.");

    (system.to_owned(), user)
}

/// Prompt for `POST /summarize`.
pub(crate) fn build_summary_prompt(history: &[SabChatMessage]) -> (String, String) {
    let system = "You are SabChat Copilot. Produce a SHORT (2-4 sentence) \
                  summary of the conversation below so a colleague can \
                  catch up at a glance. Capture: who the customer is, \
                  what they want, what has already been tried, and what \
                  is still outstanding.";

    let mut user = String::new();
    user.push_str("Conversation:\n");
    let h = render_history(history);
    if h.is_empty() {
        user.push_str("(no prior messages)\n");
    } else {
        user.push_str(&h);
    }
    user.push_str("\nWrite the summary as plain prose, no bullet list.");
    (system.to_owned(), user)
}

/// Prompt for `POST /suggest-actions`. We do not currently parse the
/// LLM output into structured actions — the stub returns deterministic
/// suggestions, and a future provider integration will swap in a
/// structured-output / tool-call pathway. The prompt is kept here so
/// that follow-up work has a single place to evolve.
pub(crate) fn build_suggest_actions_prompt(
    history: &[SabChatMessage],
) -> (String, String) {
    let system = "You are SabChat Copilot. Read the conversation and \
                  suggest 1-4 next operational actions for the human \
                  agent. Each action is one of: `label` (apply a tag), \
                  `escalate` (route to another team), `resolve` (close \
                  the conversation), `reply` (send a canned message). \
                  Be conservative — only suggest actions that are well \
                  supported by the conversation.";

    let mut user = String::new();
    user.push_str("Conversation:\n");
    let h = render_history(history);
    if h.is_empty() {
        user.push_str("(no prior messages)\n");
    } else {
        user.push_str(&h);
    }
    (system.to_owned(), user)
}

/// Prompt for `POST /wrap-up`.
pub(crate) fn build_wrap_up_prompt(history: &[SabChatMessage]) -> (String, String) {
    let system = "You are SabChat Copilot. Write a SHORT internal \
                  wrap-up note for the conversation below — one or two \
                  sentences capturing the resolution. The note is for \
                  the audit trail and will NOT be sent to the customer. \
                  Be factual and neutral.";

    let mut user = String::new();
    user.push_str("Conversation:\n");
    let h = render_history(history);
    if h.is_empty() {
        user.push_str("(no prior messages)\n");
    } else {
        user.push_str(&h);
    }
    (system.to_owned(), user)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;
    use chrono::Utc;
    use sabchat_types::{ContentBlock, MessageDirection, SabChatMessage, SenderType};

    fn msg(sender: SenderType, dir: MessageDirection, text: &str, private: bool) -> SabChatMessage {
        SabChatMessage {
            id: ObjectId::new(),
            tenant_id: ObjectId::new(),
            conversation_id: ObjectId::new(),
            inbox_id: ObjectId::new(),
            contact_id: ObjectId::new(),
            sender_type: sender,
            sender_id: None,
            direction: dir,
            content: ContentBlock::Text {
                text: text.to_owned(),
            },
            attachments: vec![],
            provider_metadata: serde_json::Value::Null,
            private,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn history_skips_private_notes_and_labels_roles() {
        let h = vec![
            msg(SenderType::Visitor, MessageDirection::Inbound, "hi", false),
            msg(SenderType::Agent, MessageDirection::Outbound, "hello!", false),
            msg(SenderType::Agent, MessageDirection::Outbound, "internal", true),
        ];
        let rendered = render_history(&h);
        assert!(rendered.contains("Customer: hi"));
        assert!(rendered.contains("Agent: hello!"));
        assert!(!rendered.contains("internal"));
    }

    #[test]
    fn draft_prompt_includes_hint_when_present() {
        let h = vec![msg(SenderType::Visitor, MessageDirection::Inbound, "yo", false)];
        let (_, user) = build_draft_prompt(&h, Some("be friendly"));
        assert!(user.contains("Agent hint for the reply: be friendly"));

        let (_, user2) = build_draft_prompt(&h, None);
        assert!(!user2.contains("Agent hint"));
    }
}
