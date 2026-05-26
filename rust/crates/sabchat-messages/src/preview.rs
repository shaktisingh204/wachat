//! Text-preview helper for [`ContentBlock`].
//!
//! Used to maintain `sabchat_conversations.last_message_preview` whenever
//! a non-private message is appended or edited. Output is hard-capped at
//! 120 chars (character count, not bytes) so inbox-row rendering stays
//! predictable on both Western and CJK content.

use sabchat_types::ContentBlock;

/// Max preview length in `char`s. The Next.js inbox row truncates with
/// CSS at roughly this width, but we still trim on the write side to
/// keep the stored doc small.
const PREVIEW_MAX_CHARS: usize = 120;

/// Render a short text preview for `block`. Emoji icons mirror the
/// conventions used by the legacy TS inbox renderer.
pub(crate) fn preview_for(block: &ContentBlock) -> String {
    let raw: String = match block {
        ContentBlock::Text { text } => text.clone(),
        ContentBlock::Image { .. } => "📷 Image".to_owned(),
        ContentBlock::File { attachment } => attachment.name.clone(),
        ContentBlock::Voice { .. } => "🎤 Voice".to_owned(),
        ContentBlock::Card { title, .. } => title.clone(),
        ContentBlock::Carousel { cards } => format!("{} cards", cards.len()),
        ContentBlock::Form { .. } => "Form".to_owned(),
        ContentBlock::Payment { .. } => "💳 Payment".to_owned(),
        ContentBlock::Location { .. } => "📍 Location".to_owned(),
        ContentBlock::System { text } => text.clone(),
    };

    truncate_chars(&raw, PREVIEW_MAX_CHARS)
}

/// Truncate `s` to at most `max` Unicode scalar values without splitting
/// a grapheme cluster mid-codepoint. Adequate for inbox previews — we
/// don't need full grapheme-cluster awareness here.
fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_owned();
    }
    s.chars().take(max).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sabchat_types::content::{Attachment, CarouselCard};

    #[test]
    fn text_preview_passes_through() {
        let b = ContentBlock::Text {
            text: "hello world".into(),
        };
        assert_eq!(preview_for(&b), "hello world");
    }

    #[test]
    fn image_preview_uses_icon() {
        let b = ContentBlock::Image {
            url: "x".into(),
            alt: None,
        };
        assert_eq!(preview_for(&b), "📷 Image");
    }

    #[test]
    fn file_preview_uses_name() {
        let b = ContentBlock::File {
            attachment: Attachment {
                sabfile_id: "id".into(),
                url: "u".into(),
                name: "report.pdf".into(),
                mime: None,
                size: None,
            },
        };
        assert_eq!(preview_for(&b), "report.pdf");
    }

    #[test]
    fn carousel_preview_reports_card_count() {
        let card = CarouselCard {
            title: "t".into(),
            subtitle: None,
            image_url: None,
            buttons: vec![],
        };
        let b = ContentBlock::Carousel {
            cards: vec![card.clone(), card.clone(), card],
        };
        assert_eq!(preview_for(&b), "3 cards");
    }

    #[test]
    fn text_preview_truncates() {
        let long = "a".repeat(500);
        let b = ContentBlock::Text { text: long };
        let preview = preview_for(&b);
        assert_eq!(preview.chars().count(), PREVIEW_MAX_CHARS);
    }
}
