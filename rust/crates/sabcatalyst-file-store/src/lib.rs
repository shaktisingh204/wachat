//! SabCatalyst project-scoped file store metadata. Mounted at
//! `/v1/sabcatalyst/file-store`. The bytes themselves live in SabFiles;
//! we just track per-project keys + visibility flags here.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystFileStoreState;
pub use types::SabcatalystFileStoreEntry;

pub const FILE_STORE_COLL: &str = "sabcatalyst_file_store";
