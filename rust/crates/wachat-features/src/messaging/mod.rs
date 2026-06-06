//! Messaging-domain handlers: scheduled messages, scheduled broadcasts,
//! auto-reply rules, chatbot responses, saved replies, quick-reply
//! categories, message tags, bulk send.

pub mod auto_reply;
pub mod bulk;
pub mod chatbot;
pub mod quick_reply;
pub mod saved_replies;
pub mod scheduled;
pub mod scheduled_broadcasts;
pub mod scheduled_reports;
pub mod tags;
