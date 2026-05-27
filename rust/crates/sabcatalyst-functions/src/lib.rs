//! # sabcatalyst-functions
//!
//! Cloud-function metadata + deploy state for SabCatalyst. Mounted at
//! `/v1/sabcatalyst/functions`. The actual code ZIP lives in SabFiles
//! (`codeBlobFileId`); the TS-side `IFunctionExecutor` is responsible
//! for shipping it to the real runtime.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystFunctionsState;
pub use types::{FunctionKind, FunctionRuntime, FunctionStatus, SabcatalystFunction};

pub const FUNCTIONS_COLL: &str = "sabcatalyst_functions";
