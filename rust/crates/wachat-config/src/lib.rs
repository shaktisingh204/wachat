//! Wachat configuration crate — consolidates the 16 config endpoints
//! (project read + manual setup, phone sync + profile, webhook subscribe,
//! phone register/verify/2FA, QR codes) under a single crate to keep the
//! crate count manageable. One module per concern.

pub mod project;
pub mod phone;
pub mod webhook;
pub mod register;
pub mod qr;
pub mod router;
pub mod state;

pub use router::router;
pub use state::WachatConfigState;
