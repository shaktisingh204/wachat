//! SabCatalyst Datastore — table schemas. Mounted at
//! `/v1/sabcatalyst/tables`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystTablesState;
pub use types::{SabcatalystTable, TableField, TableSchema};

pub const TABLES_COLL: &str = "sabcatalyst_tables";
