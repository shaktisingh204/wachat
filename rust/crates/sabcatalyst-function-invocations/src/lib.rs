//! SabCatalyst function invocation log. Mounted at
//! `/v1/sabcatalyst/function-invocations`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;
pub mod types;

pub use router::router;
pub use state::SabcatalystInvocationsState;
pub use types::{InvocationStatus, SabcatalystFunctionInvocation};

pub const INVOCATIONS_COLL: &str = "sabcatalyst_function_invocations";
