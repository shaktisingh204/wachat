//! Test-only helpers for the SabFlow Rust node crate.
//!
//! This module exists so integration tests in `tests/` (and the executor /
//! engine-runtime crates' own tests) can spin up the same shapes the
//! production runtime consumes — credentials, mock HTTP, etc. — without
//! talking to Mongo, Vercel KMS, or any real network.
//!
//! Nothing in here should ever be wired into a production code path.
//! The module is `#[doc(hidden)]` on the public surface so it doesn't
//! show up in the rustdoc index, and the production runtime never
//! imports anything from it — LTO drops the symbols on a release
//! build. See `docs/adr/sabflow-node-credential-mock.md` §7
//! ("Constraints honoured") for the rationale.
//!
//! ## Layout
//!
//! - [`credentials_mock`] — per-test envelope-encrypted credential store
//!   that parity-matches the TypeScript `executor/credentials/crypto.ts`
//!   wire format. See [`docs/adr/sabflow-node-credential-mock.md`].

pub mod credentials_mock;

pub use credentials_mock::{
    CredentialsMock, MockedCredentialEnvelope, MockedCredentialRecord, MockedCredentialStore,
    MOCK_KEK_ID, TEST_KEK_ENV,
};
