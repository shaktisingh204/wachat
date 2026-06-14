//! # sabfiles
//!
//! File-manager domain — folders, files, sharing — backed by Cloudflare R2
//! (S3-compatible) for object storage and MongoDB for the directory tree.
//!
//! Mounted under `/v1/sabfiles` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabfiles", sabfiles::router::<AppState>())
//! ```
//!
//! ## Routes
//!
//! ```text
//! GET    /nodes?parent=<id|root>      list folder contents
//! GET    /nodes/{id}                  get a single node
//! GET    /breadcrumb/{id}             ancestor chain (root → ... → id)
//! POST   /folders                     create folder
//! POST   /upload/presign              get presigned PUT URL for direct R2 upload
//! PUT    /upload/proxy?key=...        upload through Rust to avoid browser R2 CORS
//! POST   /upload/confirm              record file metadata after the PUT succeeded
//! GET    /nodes/{id}/download         get a presigned GET URL (or public URL)
//! GET    /nodes/{id}/preview          get a presigned inline preview URL
//! PATCH  /nodes/{id}/rename           rename file or folder
//! POST   /nodes/move                  move N nodes into a target folder
//! POST   /nodes/star                  toggle star on N nodes
//! POST   /nodes/trash                 soft-delete N nodes
//! POST   /nodes/restore               restore N nodes from trash
//! DELETE /nodes                       permanent delete N nodes (also R2)
//! POST   /trash/empty                 permanent delete every trashed node
//! GET    /search?q=...                substring name search
//! GET    /starred                     starred items
//! GET    /recent                      recently modified items
//! GET    /trash                       items in trash
//! GET    /shared                      items the user shared
//! GET    /storage                     { used: bytes, count: number, quota?: bytes }
//! POST   /nodes/{id}/share            create / update share token
//! DELETE /nodes/{id}/share            revoke share
//! GET    /nodes/{id}/audit            access-trail for a share (owner only)
//! GET    /share/{token}               PUBLIC — share landing payload (no auth)
//! GET    /share/{token}/preview       PUBLIC — presigned inline preview URL
//! GET    /share/{token}/download      PUBLIC — presigned download URL
//! GET    /vault/key                   Sab Vault master-key record (or {exists:false})
//! POST   /vault/key                   bootstrap the Sab Vault master-key (one-shot)
//! GET    /vault/nodes                 list the caller's encrypted Sab Vault files
//! ```
//!
//! ## Auth
//!
//! Every route except the two public `/share/{token}*` ones requires a
//! valid `AuthUser` (Bearer JWT minted by the Next.js BFF).

pub mod dto;
pub mod handlers;
pub mod r2;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post, put},
};
use sabnode_auth::AuthConfig;

pub use state::SabfilesState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabfilesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Public share routes first — no auth.
        .route("/share/{token}", get(handlers::share_view))
        .route("/share/{token}/download", get(handlers::share_download))
        .route("/share/{token}/preview", get(handlers::share_preview))
        // Browse / read.
        .route("/nodes", get(handlers::list_nodes))
        .route("/nodes/{id}", get(handlers::get_node))
        .route("/breadcrumb/{id}", get(handlers::breadcrumb))
        .route("/search", get(handlers::search_nodes))
        .route("/library", get(handlers::library))
        .route("/starred", get(handlers::list_starred))
        .route("/recent", get(handlers::list_recent))
        .route("/trash", get(handlers::list_trash))
        .route("/shared", get(handlers::list_shared))
        .route("/shared-with-me", get(handlers::list_shared_with_me))
        .route("/storage", get(handlers::storage_usage))
        .route("/folder-rollups", get(handlers::folder_rollups))
        .route("/nodes/{id}/download", get(handlers::node_download))
        .route("/nodes/{id}/preview", get(handlers::node_preview))
        .route("/nodes/{id}/members", get(handlers::list_members))
        .route("/nodes/{id}/audit", get(handlers::node_audit))
        // Sab Vault.
        .route("/vault/key", get(handlers::vault_key_get))
        .route("/vault/key", post(handlers::vault_key_create))
        .route("/vault/nodes", get(handlers::vault_list))
        // Mutations.
        .route("/folders", post(handlers::create_folder))
        .route("/upload/presign", post(handlers::presign_upload))
        .route("/upload/proxy", put(handlers::proxy_upload))
        .route("/upload/confirm", post(handlers::confirm_upload))
        .route("/nodes/{id}/rename", patch(handlers::rename_node))
        .route("/nodes/move", post(handlers::move_nodes))
        .route("/nodes/star", post(handlers::star_nodes))
        .route("/nodes/trash", post(handlers::trash_nodes))
        .route("/nodes/restore", post(handlers::restore_nodes))
        .route("/nodes", delete(handlers::permanent_delete))
        .route("/trash/empty", post(handlers::empty_trash))
        // Sharing.
        .route("/nodes/{id}/share", post(handlers::create_share))
        .route("/nodes/{id}/share", delete(handlers::revoke_share))
        // Collaborators (people the node is shared with).
        .route("/nodes/{id}/members", post(handlers::add_member))
        .route("/nodes/{id}/members", delete(handlers::remove_member))
}
