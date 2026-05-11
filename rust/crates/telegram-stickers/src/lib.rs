//! # telegram-stickers
//!
//! Sticker-pack management for the Telegram BFF.  Mirrors the Bot API
//! sticker methods (`createNewStickerSet`, `addStickerToSet`,
//! `deleteStickerFromSet`, `setStickerSetTitle`, `setStickerSetThumbnail`,
//! `setStickerEmojiList`, `setStickerKeywords`, `setStickerMaskPosition`,
//! `setStickerPositionInSet`, `replaceStickerInSet`, `getStickerSet`,
//! `uploadStickerFile`) and persists a local mirror in the
//! `telegram_sticker_sets` collection so the dashboard can render lists,
//! KPIs and detail pages without round-tripping Telegram on every load.
//!
//! Mount under `/v1/telegram/stickers` from the api crate.

pub mod bot_api;
pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramStickersState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramStickersState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // listSets / createSet
        .route("/", get(handlers::list).post(handlers::create))
        // refreshSet / archive (delete-from-mirror)
        .route(
            "/{set_name}",
            get(handlers::get_set).delete(handlers::archive_set),
        )
        // pack-level mutations
        .route("/{set_name}/add", post(handlers::add_sticker))
        .route("/{set_name}/title", post(handlers::set_title))
        .route("/{set_name}/thumbnail", post(handlers::set_thumbnail))
        // per-sticker mutations
        .route(
            "/{set_name}/sticker/{sticker_file_id}",
            delete(handlers::delete_sticker),
        )
        .route(
            "/{set_name}/sticker/{sticker_file_id}/emoji",
            post(handlers::set_emoji_list),
        )
        .route(
            "/{set_name}/sticker/{sticker_file_id}/keywords",
            post(handlers::set_keywords),
        )
        .route(
            "/{set_name}/sticker/{sticker_file_id}/mask",
            post(handlers::set_mask_position),
        )
        .route(
            "/{set_name}/sticker/{sticker_file_id}/position",
            post(handlers::set_position),
        )
        .route(
            "/{set_name}/sticker/{sticker_file_id}/replace",
            post(handlers::replace_sticker),
        )
}
