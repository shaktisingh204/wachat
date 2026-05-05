//! # wachat-facebook-content
//!
//! Posts & Content slice of `src/app/actions/facebook.actions.ts` ported to
//! Rust. This crate covers the parts of the Facebook Page surface that read
//! and write **content** (feed posts, photos, videos, albums, stories,
//! reels, related insights and crossposting).
//!
//! Mount under `/v1/facebook/content` from the API binary:
//!
//! ```ignore
//! .nest("/v1/facebook/content", wachat_facebook_content::router::<AppState>())
//! ```
//!
//! ## What's NOT here
//!
//! Inbox/messages, lead-gen forms, ads/business manager, page settings,
//! events and other sibling concerns stay in TS for now — they're in the
//! same TS file but a different concern.
//!
//! ## File uploads
//!
//! Facebook's content API supports raw multipart uploads (image bytes,
//! video bytes, thumbnails). To keep the Rust transport layer simple the
//! TS shim handles binary upload to Meta first (`POST /me/photos`,
//! `POST /{page}/videos`, etc) and then calls these endpoints with the
//! resulting Meta media id or a public URL. Endpoints that need media
//! therefore accept `{ mediaUrl?, mediaId? }` rather than file bytes.
//!
//! See `src/lib/rust-client/wachat-facebook-content.ts` for the matching
//! TypeScript surface.

pub mod dto;
pub mod handlers;
pub mod project_loader;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookContentState;

/// Build the router with all 31 content endpoints. The TS shim splits a
/// few legacy server actions across multiple routes (e.g. `bulkCreatePosts`
/// fans out client-side over the `single-post` endpoint) — see crate
/// docs for the per-route mapping.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookContentState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- Feed posts -------------------------------------------------
        .route(
            "/projects/{project_id}/posts",
            get(handlers::get_facebook_posts).post(handlers::create_post),
        )
        .route(
            "/projects/{project_id}/posts/bulk",
            post(handlers::bulk_create_posts),
        )
        .route(
            "/projects/{project_id}/posts/{post_id}",
            axum::routing::patch(handlers::update_post).delete(handlers::delete_post),
        )
        .route(
            "/projects/{project_id}/posts/{post_id}/insights",
            get(handlers::get_post_insights),
        )
        .route(
            "/projects/{project_id}/posts/{post_id}/publish",
            post(handlers::publish_scheduled_post),
        )
        .route(
            "/projects/{project_id}/posts/{post_id}/crosspost",
            post(handlers::crosspost_video),
        )
        .route(
            "/projects/{project_id}/posts/{post_id}/crosspost-eligible",
            get(handlers::get_eligible_crosspost_pages),
        )
        .route(
            "/projects/{project_id}/scheduled-posts",
            get(handlers::get_scheduled_posts),
        )
        .route(
            "/projects/{project_id}/published-posts",
            get(handlers::get_published_posts),
        )
        .route(
            "/projects/{project_id}/visitor-posts",
            get(handlers::get_visitor_posts),
        )
        .route(
            "/projects/{project_id}/tagged-posts",
            get(handlers::get_tagged_posts),
        )
        // ---- Photos & albums --------------------------------------------
        .route(
            "/projects/{project_id}/photos",
            get(handlers::get_page_photos),
        )
        .route(
            "/projects/{project_id}/albums",
            get(handlers::get_page_albums).post(handlers::create_photo_album),
        )
        .route(
            "/projects/{project_id}/albums/{album_id}/photos",
            get(handlers::get_album_photos),
        )
        .route(
            "/projects/{project_id}/photos/{photo_id}",
            get(handlers::get_photo_details),
        )
        .route(
            "/projects/{project_id}/photos/{photo_id}/insights",
            get(handlers::get_photo_insights),
        )
        // ---- Videos & playlists -----------------------------------------
        .route(
            "/projects/{project_id}/videos",
            get(handlers::get_page_videos),
        )
        .route(
            "/projects/{project_id}/videos/{video_id}",
            get(handlers::get_video_details),
        )
        .route(
            "/projects/{project_id}/videos/{video_id}/insights",
            get(handlers::get_video_insights),
        )
        .route(
            "/projects/{project_id}/videos/{video_id}/thumbnail",
            post(handlers::add_video_thumbnail),
        )
        .route(
            "/projects/{project_id}/playlists",
            get(handlers::get_video_playlists),
        )
        .route(
            "/projects/{project_id}/playlists/{playlist_id}/videos",
            get(handlers::get_playlist_videos),
        )
        // ---- Reels & stories --------------------------------------------
        .route(
            "/projects/{project_id}/reels",
            get(handlers::get_page_reels).post(handlers::publish_page_reel),
        )
        .route(
            "/projects/{project_id}/stories",
            get(handlers::get_page_stories),
        )
        .route(
            "/projects/{project_id}/stories/photo",
            post(handlers::publish_photo_story),
        )
        .route(
            "/projects/{project_id}/stories/video",
            post(handlers::publish_video_story),
        )
        // ---- Ratings ----------------------------------------------------
        .route(
            "/projects/{project_id}/ratings",
            get(handlers::get_page_ratings),
        )
}
