//! Wachat configuration crate — consolidates the 16 config endpoints
//! (project read + manual setup, phone sync + profile, webhook subscribe,
//! phone register/verify/2FA, QR codes) under a single crate to keep the
//! crate count manageable. One module per concern.

pub mod phone;
pub mod project;
pub mod qr;
pub mod register;
pub mod router;
pub mod state;
pub mod waba_setup;
pub mod webhook;
pub mod widget;

pub use router::router;
pub use state::WachatConfigState;
