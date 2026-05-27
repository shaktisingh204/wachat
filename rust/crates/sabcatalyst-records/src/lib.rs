//! SabCatalyst Datastore records. Mounted at `/v1/sabcatalyst/records`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystRecordsState;
pub use types::SabcatalystRecord;

pub const RECORDS_COLL: &str = "sabcatalyst_records";
