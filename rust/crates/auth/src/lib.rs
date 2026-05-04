//! # sabnode-auth
//!
//! JWT verification and RBAC extractor for the SabNode Rust BFF.
//!
//! ## JWT flow
//!
//! 1. The user authenticates against Next.js (NextAuth, unchanged).
//! 2. When a Next.js Server Action / Route Handler needs to call into the Rust
//!    backend, it mints a **short-lived (15 min) HS256 JWT** signed with the
//!    shared secret in `RUST_JWT_SECRET`. See `src/lib/jwt-for-rust.ts` on the
//!    TypeScript side.
//! 3. The token is sent to Rust as `Authorization: Bearer <token>`.
//! 4. The Axum extractor [`AuthUser`] reads the header, calls [`jwt::verify`],
//!    and exposes `user_id`, `tenant_id`, and `roles` to handlers.
//! 5. The [`middleware::require_role`] middleware enforces role-based access
//!    on a per-route basis (returns 403 on mismatch).
//!
//! ## Claims contract
//!
//! Both the Next.js issuer and this verifier MUST agree on the [`Claims`]
//! shape. See [`claims`] for the canonical definition. Any change here MUST
//! be mirrored in `src/lib/jwt-for-rust.ts`.
//!
//! ## Algorithm
//!
//! HS256 only. Asymmetric (RS256/EdDSA) is intentionally deferred — secret
//! rotation is straightforward at this stage, and symmetric keeps the issuer
//! cheap to run inside the Next.js process.

pub mod claims;
pub mod error;
pub mod extractor;
pub mod jwt;
pub mod middleware;

pub use claims::Claims;
pub use error::AuthError;
pub use extractor::{AuthConfig, AuthUser};
pub use jwt::verify;
pub use middleware::require_role;
