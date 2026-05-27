//! On-disk shape of a `sabvault_secrets` document.
//!
//! **Plaintext never lives here.** `encrypted_payload_b64` is opaque
//! ciphertext produced by the client (AES-GCM via SubtleCrypto, key derived
//! from the user's master password). The server only stores blobs + metadata
//! it needs for listing, sharing, and audit.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Kind of secret payload (drives the UI form + icon, never the crypto).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum SecretKind {
    #[default]
    Login,
    Note,
    Card,
    Identity,
    Key,
    Wifi,
    Server,
}

/// Encryption algorithm tag — kept as a free string so future migrations
/// (e.g. XChaCha20-Poly1305) don't force a breaking schema change.
///
/// Default value the client should send: `"AES-GCM-256"`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(transparent)]
pub struct EncryptionAlg(pub String);

impl Default for EncryptionAlg {
    fn default() -> Self {
        Self("AES-GCM-256".to_owned())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabvaultSecret {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Owner — the user who can decrypt the payload with their master key.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Human-readable name (NOT encrypted — used for listing/search).
    pub name: String,
    pub kind: SecretKind,

    /// Opaque base64 ciphertext + IV envelope. Format is client-defined; the
    /// server treats it as a black box. See `src/lib/sabvault/crypto.ts`.
    pub encrypted_payload_b64: String,
    pub encryption_alg: EncryptionAlg,

    /// Salt used to derive the master key (per-user, NOT per-secret).
    /// Mirrored from `sabvault_user_keys` for convenience; the source of
    /// truth lives there.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_salt_b64: Option<String>,

    /// Optional human-visible URL (logins only). Used for the favicon hint
    /// + breach-check lookup — never encrypted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    /// Optional folder placement.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<ObjectId>,

    /// Free-form tags (used for filtering, not encrypted).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /* ----- sharing (server-gated; ciphertext is re-wrapped per-grantee) ----- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shared_with_user_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shared_with_team_ids: Vec<ObjectId>,

    /* ----- lifecycle / health ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_rotated_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_accessed_at: Option<BsonDateTime>,

    /// Health signals computed server-side from cleartext-free heuristics
    /// (length-of-ciphertext is meaningless; these come from a client report
    /// or the breach-alerts crate).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reused: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breached: Option<bool>,

    /// SabFiles refs (e.g. SSH key files for `kind=key`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,

    /// `"active"` | `"archived"` | `"deleted"`. Free-form for parity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
