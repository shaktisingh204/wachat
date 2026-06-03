//! Mongo access for the admin credentials, settings, and revoked-tokens
//! collections. Kept narrow so the HTTP handlers in [`crate::handlers`] read
//! like the legacy TS server actions line for line.

use bcrypt::{hash, verify};
use bson::{Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

/// Mongo collection holding the singleton admin credential document plus
/// every other admin-managed setting (app logo, theme toggles, ...).
pub const SETTINGS_COLL: &str = "settings";

/// Mongo collection holding revoked JWT JTIs. Reader: `verifyAdminJwt` in
/// `src/lib/auth.ts` queries by `jti`.
pub const REVOKED_TOKENS_COLL: &str = "revoked_tokens";

/// Settings document key for the admin credentials singleton.
pub const ADMIN_CREDENTIALS_KEY: &str = "admin_credentials";

/// Bcrypt cost matching the TS side (`SALT_ROUNDS = 10` in `src/lib/auth.ts`).
/// The `bcrypt` crate's `DEFAULT_COST` is 12; the legacy hashes were produced
/// with 10, so we MUST stay at 10 to keep verification fast. Existing rounds
/// in stored hashes still verify regardless of the cost we use for new ones.
const BCRYPT_COST: u32 = 10;

/// Result of a credentials lookup.
pub struct AdminCredentials {
    pub email: String,
    pub password_hash: String,
}

/// Returns the stored admin credentials, or `None` if no admin has been set
/// up yet. Mirrors `isAdminConfigured` + the read in `handleAdminLogin`.
pub async fn find_credentials(mongo: &MongoHandle) -> Result<Option<AdminCredentials>> {
    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    let stored = coll
        .find_one(doc! { "key": ADMIN_CREDENTIALS_KEY })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("settings.find_one")))?;

    let Some(doc) = stored else {
        return Ok(None);
    };

    let email = doc.get_str("email").ok().map(str::to_owned);
    let password_hash = doc.get_str("passwordHash").ok().map(str::to_owned);
    match (email, password_hash) {
        (Some(email), Some(password_hash)) => Ok(Some(AdminCredentials {
            email,
            password_hash,
        })),
        _ => Ok(None),
    }
}

/// Upsert the admin credentials singleton. Refuses to overwrite an existing
/// admin so this endpoint can't be used to hijack a configured deployment.
pub async fn create_initial_admin(mongo: &MongoHandle, email: &str, password: &str) -> Result<()> {
    if find_credentials(mongo).await?.is_some() {
        return Err(ApiError::Conflict(
            "An admin already exists. Setup is disabled.".to_owned(),
        ));
    }

    let password_hash = hash(password, BCRYPT_COST)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bcrypt.hash")))?;

    let now = bson::DateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Document>(SETTINGS_COLL);
    coll.update_one(
        doc! { "key": ADMIN_CREDENTIALS_KEY },
        doc! {
            "$set": {
                "key": ADMIN_CREDENTIALS_KEY,
                "email": email,
                "passwordHash": password_hash,
                "updatedAt": now,
            },
            "$setOnInsert": { "createdAt": now },
        },
    )
    .upsert(true)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("settings.update_one")))?;

    Ok(())
}

/// Verify a bcrypt password against the stored hash. Returns `Ok(true)` on
/// match, `Ok(false)` on mismatch, `Err` only for catastrophic bcrypt errors.
pub fn verify_password(plain: &str, hash_str: &str) -> Result<bool> {
    verify(plain, hash_str)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bcrypt.verify")))
}

/// Insert a `{ jti, expiresAt }` doc into `revoked_tokens` so subsequent
/// `verifyAdminJwt` calls reject the same JTI. Idempotent at the
/// application level — duplicate inserts are tolerated (the TS verifier
/// only checks existence).
pub async fn revoke_token(
    mongo: &MongoHandle,
    jti: &str,
    exp_seconds: i64,
    user_id: Option<&str>,
) -> Result<()> {
    let expires_at = Utc
        .timestamp_opt(exp_seconds, 0)
        .single()
        .ok_or_else(|| ApiError::BadRequest("Invalid exp seconds".to_owned()))?;
    let expires_at_bson = bson::DateTime::from_chrono(expires_at);

    let mut doc = doc! {
        "jti": jti,
        "expiresAt": expires_at_bson,
    };
    if let Some(uid) = user_id {
        doc.insert("userId", uid);
    }

    let coll = mongo.collection::<Document>(REVOKED_TOKENS_COLL);
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("revoked_tokens.insert_one"))
    })?;

    Ok(())
}

/// Validate that `email` looks like an email address — same loose regex the
/// TS server action uses (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Returns the
/// normalized lower-cased email on success.
pub fn normalize_and_validate_email(raw: &str) -> Result<String> {
    let trimmed = raw.trim().to_lowercase();
    let mut parts = trimmed.split('@');
    let local = parts.next().unwrap_or("");
    let rest = parts.next().unwrap_or("");
    let extra = parts.next();

    let valid = !local.is_empty()
        && !local.contains(char::is_whitespace)
        && !rest.is_empty()
        && extra.is_none()
        && rest.contains('.')
        && !rest.starts_with('.')
        && !rest.ends_with('.')
        && !rest.contains(char::is_whitespace);

    if !valid {
        return Err(ApiError::BadRequest(
            "Enter a valid email address.".to_owned(),
        ));
    }
    Ok(trimmed)
}

/// Helper used by handlers to convert an arbitrary string id into an
/// `ObjectId` and return a uniform `BadRequest` on failure.
#[allow(dead_code)]
pub fn parse_object_id(raw: &str, field: &str) -> Result<ObjectId> {
    ObjectId::parse_str(raw).map_err(|_| ApiError::BadRequest(format!("Invalid {field} ID.")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_validates_email() {
        assert_eq!(
            normalize_and_validate_email("  Admin@Example.COM ").unwrap(),
            "admin@example.com",
        );
    }

    #[test]
    fn rejects_invalid_emails() {
        for bad in [
            "",
            "no-at-sign",
            "@nolocal.com",
            "no-domain@",
            "no-dot@nope",
            "two@@signs.com",
            "white space@x.com",
            "x@y .com",
            "x@.com",
            "x@y.",
        ] {
            assert!(
                matches!(
                    normalize_and_validate_email(bad),
                    Err(ApiError::BadRequest(_))
                ),
                "expected rejection for {bad:?}",
            );
        }
    }

    #[test]
    fn verifies_known_bcrypt_hash() {
        // Hash of "correcthorsebatterystaple" at cost 10.
        let hash = bcrypt::hash("correcthorsebatterystaple", 10).expect("hash ok");
        assert!(verify_password("correcthorsebatterystaple", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn parses_object_id_or_fails_loudly() {
        let raw = "507f1f77bcf86cd799439011";
        let parsed = parse_object_id(raw, "user").unwrap();
        assert_eq!(parsed.to_hex(), raw);

        let err = parse_object_id("not-an-oid", "user").unwrap_err();
        assert!(matches!(err, ApiError::BadRequest(m) if m.contains("user")));
    }
}
