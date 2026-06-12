//! SabSMS engine library crate.
//!
//! The binary (`src/main.rs`) is a thin bootstrap over this crate; the
//! lib target exists so integration tests (`tests/`) can exercise the
//! pure logic — segment counting, quiet hours, keyword classification —
//! without booting Mongo/Redis.

pub mod auth;
pub mod campaigns;
pub mod compliance;
pub mod config;
pub mod creds;
pub mod credits;
pub mod db;
pub mod delayed;
pub mod errors;
pub mod errors_map;
pub mod events;
pub mod handlers;
pub mod keywords;
pub mod providers;
pub mod queue;
pub mod routing;
pub mod state;
pub mod types;
pub mod worker;
