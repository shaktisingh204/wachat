//! OTP code store — Redis-backed, hashed at rest (V2.7).
//!
//! One Redis hash per live code, keyed
//! `sabsms:otp:{workspaceId}:{phoneE164}` with the code stored as
//! `codeHash = sha256(code + salt)` (verified constant-time) plus an
//! AES-256-GCM-sealed `codeEnc` so `/v1/otp/resend` can re-send the
//! SAME code (industry standard) without weakening the hash-at-rest
//! story. The whole hash carries `EX = ttlSecs` so expired codes
//! self-delete.
//!
//! Per-workspace knobs live in the `sabsms_otp_configs` collection and
//! are cached 60s (the `creds.rs` cache pattern).

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine as _;
use mongodb::bson::{doc, Document};
use once_cell::sync::Lazy;
use rand::RngCore;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use sha2::{Digest, Sha256};
use tokio::sync::RwLock;

use crate::{db, state::AppState};

const CACHE_TTL: Duration = Duration::from_secs(60);

/// 60s-TTL OTP-config cache, keyed by workspaceId (creds.rs pattern).
static CONFIG_CACHE: Lazy<RwLock<HashMap<String, (Instant, Arc<OtpConfig>)>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Per-workspace OTP configuration (`sabsms_otp_configs`).
#[derive(Clone, Debug)]
pub struct OtpConfig {
    /// Numeric code length, clamped to 4–8.
    pub code_length: usize,
    pub ttl_secs: i64,
    pub max_attempts: u32,
    pub max_resends: u32,
    pub resend_cooldown_secs: i64,
    /// `{#code#}` and `{#brand#}` placeholders are substituted.
    pub template_body: String,
    pub sender_id: Option<String>,
    pub brand_name: Option<String>,
}

impl Default for OtpConfig {
    fn default() -> Self {
        Self {
            code_length: 6,
            ttl_secs: 300,
            max_attempts: 5,
            max_resends: 3,
            resend_cooldown_secs: 30,
            template_body: "Your verification code is {#code#}".to_string(),
            sender_id: None,
            brand_name: None,
        }
    }
}

impl OtpConfig {
    /// Build from a Mongo doc, clamping every field to a sane range —
    /// a bad doc must never produce a 0-length code or a 0s TTL.
    pub fn from_doc(d: &Document) -> Self {
        let def = OtpConfig::default();
        let get_i64 = |f: &str| -> Option<i64> {
            d.get_i64(f)
                .ok()
                .or_else(|| d.get_i32(f).ok().map(|n| n as i64))
                .or_else(|| d.get_f64(f).ok().map(|n| n as i64))
        };
        let opt_str = |f: &str| {
            d.get_str(f)
                .ok()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        Self {
            code_length: get_i64("codeLength")
                .unwrap_or(def.code_length as i64)
                .clamp(4, 8) as usize,
            ttl_secs: get_i64("ttlSecs").unwrap_or(def.ttl_secs).clamp(30, 3600),
            max_attempts: get_i64("maxAttempts")
                .unwrap_or(def.max_attempts as i64)
                .clamp(1, 20) as u32,
            max_resends: get_i64("maxResends")
                .unwrap_or(def.max_resends as i64)
                .clamp(0, 10) as u32,
            resend_cooldown_secs: get_i64("resendCooldownSecs")
                .unwrap_or(def.resend_cooldown_secs)
                .clamp(5, 600),
            template_body: opt_str("templateBody").unwrap_or(def.template_body),
            sender_id: opt_str("senderId"),
            brand_name: opt_str("brandName"),
        }
    }
}

/// Load the workspace's OTP config through the 60s cache. Missing doc
/// (or Mongo hiccup) → defaults; OTP must keep working.
pub async fn load_config(state: &Arc<AppState>, workspace_id: &str) -> Arc<OtpConfig> {
    if let Some((at, cached)) = CONFIG_CACHE.read().await.get(workspace_id) {
        if at.elapsed() < CACHE_TTL {
            return cached.clone();
        }
    }
    let col = state.mongo.collection::<Document>(db::COL_OTP_CONFIGS);
    let cfg = match col.find_one(doc! { "workspaceId": workspace_id }).await {
        Ok(Some(d)) => OtpConfig::from_doc(&d),
        Ok(None) => OtpConfig::default(),
        Err(e) => {
            tracing::warn!(?e, workspace = %workspace_id, "otp config load failed; using defaults");
            OtpConfig::default()
        }
    };
    let cfg = Arc::new(cfg);
    CONFIG_CACHE
        .write()
        .await
        .insert(workspace_id.to_string(), (Instant::now(), cfg.clone()));
    cfg
}

/// Drop a workspace's cached config (called after a config save).
pub async fn invalidate_config(workspace_id: &str) {
    CONFIG_CACHE.write().await.remove(workspace_id);
}

// ---------------------------------------------------------------------------
// Code generation + hashing (pure)
// ---------------------------------------------------------------------------

/// Generate a numeric code of `len` digits, each digit drawn UNIFORMLY
/// via rejection sampling over random bytes (a raw `byte % 10` would
/// bias digits 0–5 — 256 isn't divisible by 10, so bytes ≥ 250 are
/// rejected and redrawn).
pub fn generate_code<R: RngCore>(rng: &mut R, len: usize) -> String {
    let len = len.clamp(4, 8);
    let mut out = String::with_capacity(len);
    let mut buf = [0u8; 16];
    while out.len() < len {
        rng.fill_bytes(&mut buf);
        for b in buf {
            if b < 250 {
                out.push(char::from(b'0' + (b % 10)));
                if out.len() == len {
                    break;
                }
            }
        }
    }
    out
}

/// Random 16-byte salt, hex-encoded.
pub fn generate_salt<R: RngCore>(rng: &mut R) -> String {
    let mut bytes = [0u8; 16];
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// `sha256(code + salt)` hex — what's stored in Redis.
pub fn hash_code(code: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    hasher.update(salt.as_bytes());
    hex::encode(hasher.finalize())
}

/// Constant-time equality over the two hash strings: XOR-fold every
/// byte so the comparison time never depends on WHERE they differ.
/// (Both sides are sha256 hex digests, so a length mismatch is itself
/// non-secret.)
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Substitute `{#code#}` and `{#brand#}` into the workspace template.
/// A template missing the code placeholder gets the code appended —
/// the OTP must ALWAYS reach the user.
pub fn render_template(template: &str, code: &str, brand: Option<&str>) -> String {
    let mut body = template.replace("{#brand#}", brand.unwrap_or(""));
    if body.contains("{#code#}") {
        body = body.replace("{#code#}", code);
    } else {
        body = format!("{} {}", body.trim_end(), code);
    }
    body.trim().to_string()
}

// ---------------------------------------------------------------------------
// Code sealing for resend (AES-256-GCM under SABSMS_CREDS_KEY)
// ---------------------------------------------------------------------------

fn creds_key() -> Option<[u8; 32]> {
    let raw = std::env::var("SABSMS_CREDS_KEY").ok()?;
    if raw.len() != 64 {
        return None;
    }
    hex::decode(&raw).ok()?.try_into().ok()
}

/// Seal the plaintext code so `resend` can recover it. With a valid
/// `SABSMS_CREDS_KEY`: `v1.<nonceB64>.<ctB64>` (AAD = the Redis key).
/// Without one (dev): `plain.<b64>` with a warning — never break OTP
/// over a missing env var.
pub fn seal_code(code: &str, aad: &str) -> String {
    let b64 = base64::engine::general_purpose::STANDARD;
    if let Some(key) = creds_key() {
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let aead = Aes256Gcm::new((&key).into());
        if let Ok(ct) = aead.encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: code.as_bytes(),
                aad: aad.as_bytes(),
            },
        ) {
            return format!("v1.{}.{}", b64.encode(nonce_bytes), b64.encode(ct));
        }
    }
    tracing::warn!("SABSMS_CREDS_KEY missing/invalid — storing OTP resend copy unsealed");
    format!("plain.{}", b64.encode(code.as_bytes()))
}

/// Recover the plaintext code sealed by [`seal_code`].
pub fn unseal_code(sealed: &str, aad: &str) -> Option<String> {
    let b64 = base64::engine::general_purpose::STANDARD;
    if let Some(rest) = sealed.strip_prefix("plain.") {
        return String::from_utf8(b64.decode(rest).ok()?).ok();
    }
    let rest = sealed.strip_prefix("v1.")?;
    let (nonce_b64, ct_b64) = rest.split_once('.')?;
    let nonce = b64.decode(nonce_b64).ok()?;
    if nonce.len() != 12 {
        return None;
    }
    let ct = b64.decode(ct_b64).ok()?;
    let key = creds_key()?;
    let aead = Aes256Gcm::new((&key).into());
    let pt = aead
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ct,
                aad: aad.as_bytes(),
            },
        )
        .ok()?;
    String::from_utf8(pt).ok()
}

// ---------------------------------------------------------------------------
// Record + verify/resend state machines (pure where possible)
// ---------------------------------------------------------------------------

/// One live OTP, as stored in the Redis hash.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct OtpRecord {
    pub code_hash: String,
    pub salt: String,
    /// Sealed plaintext for resend-same-code (see [`seal_code`]).
    pub code_enc: String,
    pub attempts: u32,
    pub max_attempts: u32,
    pub resends: u32,
    pub max_resends: u32,
    /// Epoch seconds.
    pub expires_at: i64,
    /// Epoch millis of the LAST send (initial or resend) — drives the
    /// resend cooldown.
    pub last_sent_at_ms: i64,
    pub account_id: String,
    pub country: String,
    pub prefix: String,
    pub created_at_ms: i64,
}

/// Outcome of a verify attempt (pure — see [`decide_verify`]).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerifyDecision {
    /// Constant-time hash match → delete the key, record conversion.
    Verified,
    /// Wrong code, attempts remain → bump `attempts`.
    WrongCode,
    /// Wrong code AND the attempt budget is spent → delete the key.
    MaxAttempts,
    /// Past `expiresAt` (TTL race) → treat as absent.
    Expired,
}

pub fn decide_verify(rec: &OtpRecord, code: &str, now_secs: i64) -> VerifyDecision {
    if now_secs >= rec.expires_at {
        return VerifyDecision::Expired;
    }
    if rec.attempts >= rec.max_attempts {
        return VerifyDecision::MaxAttempts;
    }
    let candidate = hash_code(code, &rec.salt);
    if constant_time_eq(&candidate, &rec.code_hash) {
        return VerifyDecision::Verified;
    }
    if rec.attempts + 1 >= rec.max_attempts {
        VerifyDecision::MaxAttempts
    } else {
        VerifyDecision::WrongCode
    }
}

/// Outcome of a resend request (pure — see [`decide_resend`]).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResendDecision {
    Ok,
    /// Still inside the cooldown window; retry after this epoch-secs.
    Cooldown { retry_at_secs: i64 },
    MaxResends,
    Expired,
}

pub fn decide_resend(rec: &OtpRecord, now_secs: i64, cooldown_secs: i64) -> ResendDecision {
    if now_secs >= rec.expires_at {
        return ResendDecision::Expired;
    }
    if rec.resends >= rec.max_resends {
        return ResendDecision::MaxResends;
    }
    let retry_at_secs = rec.last_sent_at_ms / 1000 + cooldown_secs;
    if now_secs < retry_at_secs {
        return ResendDecision::Cooldown { retry_at_secs };
    }
    ResendDecision::Ok
}

// ---------------------------------------------------------------------------
// Redis I/O
// ---------------------------------------------------------------------------

/// `sabsms:otp:{ws}:{phone}` — the `otpId` returned to callers is the
/// part after `sabsms:otp:`.
pub fn otp_key(workspace_id: &str, phone_e164: &str) -> String {
    format!("sabsms:otp:{workspace_id}:{phone_e164}")
}

/// Persist a fresh record with `EX = ttl_secs`.
pub async fn put(
    redis: &mut ConnectionManager,
    key: &str,
    rec: &OtpRecord,
    ttl_secs: i64,
) -> redis::RedisResult<()> {
    let fields: [(&str, String); 13] = [
        ("codeHash", rec.code_hash.clone()),
        ("salt", rec.salt.clone()),
        ("codeEnc", rec.code_enc.clone()),
        ("attempts", rec.attempts.to_string()),
        ("maxAttempts", rec.max_attempts.to_string()),
        ("resends", rec.resends.to_string()),
        ("maxResends", rec.max_resends.to_string()),
        ("expiresAt", rec.expires_at.to_string()),
        ("lastSentAtMs", rec.last_sent_at_ms.to_string()),
        ("accountId", rec.account_id.clone()),
        ("country", rec.country.clone()),
        ("prefix", rec.prefix.clone()),
        ("createdAtMs", rec.created_at_ms.to_string()),
    ];
    // Replace wholesale — DEL first so stale fields never survive.
    let _: i64 = redis.del(key).await?;
    let _: () = redis.hset_multiple(key, &fields).await?;
    let _: bool = redis.expire(key, ttl_secs).await?;
    Ok(())
}

/// Read a record; `None` when the key is absent/expired.
pub async fn get(
    redis: &mut ConnectionManager,
    key: &str,
) -> redis::RedisResult<Option<OtpRecord>> {
    let map: HashMap<String, String> = redis.hgetall(key).await?;
    if map.is_empty() {
        return Ok(None);
    }
    let s = |f: &str| map.get(f).cloned().unwrap_or_default();
    let n_u32 = |f: &str| map.get(f).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
    let n_i64 = |f: &str| map.get(f).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    Ok(Some(OtpRecord {
        code_hash: s("codeHash"),
        salt: s("salt"),
        code_enc: s("codeEnc"),
        attempts: n_u32("attempts"),
        max_attempts: n_u32("maxAttempts").max(1),
        resends: n_u32("resends"),
        max_resends: n_u32("maxResends"),
        expires_at: n_i64("expiresAt"),
        last_sent_at_ms: n_i64("lastSentAtMs"),
        account_id: s("accountId"),
        country: s("country"),
        prefix: s("prefix"),
        created_at_ms: n_i64("createdAtMs"),
    }))
}

pub async fn delete(redis: &mut ConnectionManager, key: &str) {
    let res: redis::RedisResult<i64> = redis.del(key).await;
    if let Err(e) = res {
        tracing::warn!(?e, key, "otp key delete failed");
    }
}

/// Bump the attempt counter after a wrong code (keeps the TTL).
pub async fn bump_attempts(redis: &mut ConnectionManager, key: &str) {
    let res: redis::RedisResult<i64> = redis.hincr(key, "attempts", 1).await;
    if let Err(e) = res {
        tracing::warn!(?e, key, "otp attempts bump failed");
    }
}

/// Bump the resend counter + refresh `lastSentAtMs` after a resend.
pub async fn bump_resends(redis: &mut ConnectionManager, key: &str, now_ms: i64) {
    let res: redis::RedisResult<()> = async {
        let _: i64 = redis.hincr(key, "resends", 1).await?;
        let _: () = redis.hset(key, "lastSentAtMs", now_ms).await?;
        Ok(())
    }
    .await;
    if let Err(e) = res {
        tracing::warn!(?e, key, "otp resend bump failed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn rec(attempts: u32, max_attempts: u32, resends: u32, max_resends: u32) -> OtpRecord {
        let salt = "00ff".to_string();
        OtpRecord {
            code_hash: hash_code("123456", &salt),
            salt,
            code_enc: String::new(),
            attempts,
            max_attempts,
            resends,
            max_resends,
            expires_at: 1_000_300,
            last_sent_at_ms: 1_000_000_000, // = 1_000_000s
            account_id: "acct1".into(),
            country: "US".into(),
            prefix: "+1415555".into(),
            created_at_ms: 1_000_000_000,
        }
    }

    // -- code generation ---------------------------------------------------

    #[test]
    fn generated_codes_are_numeric_and_sized() {
        let mut rng = StdRng::seed_from_u64(7);
        for len in 4..=8 {
            let code = generate_code(&mut rng, len);
            assert_eq!(code.len(), len);
            assert!(code.bytes().all(|b| b.is_ascii_digit()));
        }
        // Out-of-range lengths clamp instead of panicking.
        assert_eq!(generate_code(&mut rng, 0).len(), 4);
        assert_eq!(generate_code(&mut rng, 99).len(), 8);
    }

    /// Chi-square-lite uniformity bound: over 10k six-digit codes
    /// (60k digits) every digit must appear, and each within ±25% of
    /// the expected 6k count. A `byte % 10` bias (digits 0–5 appear
    /// 26/256 vs 25/256) wouldn't trip this, but a broken sampler
    /// (missing digits, heavy skew) does — and the rejection sampler
    /// keeps the distribution exactly uniform by construction.
    #[test]
    fn generated_digits_are_uniform_over_10k_samples() {
        let mut rng = StdRng::seed_from_u64(42);
        let mut counts = [0u32; 10];
        for _ in 0..10_000 {
            for b in generate_code(&mut rng, 6).bytes() {
                counts[(b - b'0') as usize] += 1;
            }
        }
        let expected = 60_000.0 / 10.0;
        for (digit, &c) in counts.iter().enumerate() {
            assert!(c > 0, "digit {digit} never appeared");
            let dev = (c as f64 - expected).abs() / expected;
            assert!(dev < 0.25, "digit {digit} count {c} deviates {dev:.3} from uniform");
        }
    }

    // -- hashing + constant-time compare ------------------------------------

    #[test]
    fn hash_is_salted_and_deterministic() {
        assert_eq!(hash_code("123456", "s1"), hash_code("123456", "s1"));
        assert_ne!(hash_code("123456", "s1"), hash_code("123456", "s2"));
        assert_ne!(hash_code("123456", "s1"), hash_code("123457", "s1"));
        assert_eq!(hash_code("123456", "s1").len(), 64); // sha256 hex
    }

    #[test]
    fn constant_time_eq_compares_correctly() {
        let h = hash_code("123456", "s");
        assert!(constant_time_eq(&h, &h.clone()));
        // Differing in the FIRST char and the LAST char both report
        // false — the fold inspects every byte either way.
        let mut first = h.clone().into_bytes();
        first[0] = if first[0] == b'a' { b'b' } else { b'a' };
        assert!(!constant_time_eq(&h, std::str::from_utf8(&first).unwrap()));
        let mut last = h.clone().into_bytes();
        let i = last.len() - 1;
        last[i] = if last[i] == b'a' { b'b' } else { b'a' };
        assert!(!constant_time_eq(&h, std::str::from_utf8(&last).unwrap()));
        assert!(!constant_time_eq(&h, "short"));
    }

    #[test]
    fn verify_compares_hashes_not_strings() {
        // The stored value is the HASH; a caller passing the hash
        // itself as the "code" must NOT verify.
        let r = rec(0, 5, 0, 3);
        let hash = r.code_hash.clone();
        assert_eq!(decide_verify(&r, &hash, 1_000_100), VerifyDecision::WrongCode);
        // …while the real code does.
        assert_eq!(decide_verify(&r, "123456", 1_000_100), VerifyDecision::Verified);
    }

    // -- template rendering --------------------------------------------------

    #[test]
    fn template_substitutes_code_and_brand() {
        assert_eq!(
            render_template("Your verification code is {#code#}", "482915", None),
            "Your verification code is 482915"
        );
        assert_eq!(
            render_template("{#brand#}: code {#code#}", "1234", Some("SabNode")),
            "SabNode: code 1234"
        );
        // Brand placeholder without a configured brand collapses cleanly.
        assert_eq!(render_template("{#brand#} code {#code#}", "1234", None), "code 1234");
        // A template missing {#code#} still delivers the code.
        assert_eq!(render_template("Hello from SabNode", "987654", None), "Hello from SabNode 987654");
    }

    // -- verify state machine -------------------------------------------------

    #[test]
    fn verify_state_machine_table() {
        let now = 1_000_100; // inside TTL
        // Right code → Verified.
        assert_eq!(decide_verify(&rec(0, 5, 0, 3), "123456", now), VerifyDecision::Verified);
        // Wrong code, attempts left → WrongCode.
        assert_eq!(decide_verify(&rec(0, 5, 0, 3), "000000", now), VerifyDecision::WrongCode);
        assert_eq!(decide_verify(&rec(3, 5, 0, 3), "000000", now), VerifyDecision::WrongCode);
        // Wrong code burning the LAST attempt → MaxAttempts.
        assert_eq!(decide_verify(&rec(4, 5, 0, 3), "000000", now), VerifyDecision::MaxAttempts);
        // Budget already spent → MaxAttempts even with the right code.
        assert_eq!(decide_verify(&rec(5, 5, 0, 3), "123456", now), VerifyDecision::MaxAttempts);
        // Past expiry → Expired regardless of the code.
        assert_eq!(decide_verify(&rec(0, 5, 0, 3), "123456", 1_000_300), VerifyDecision::Expired);
        assert_eq!(decide_verify(&rec(0, 5, 0, 3), "123456", 2_000_000), VerifyDecision::Expired);
    }

    // -- resend state machine --------------------------------------------------

    #[test]
    fn resend_state_machine_table() {
        // last_sent = 1_000_000s, cooldown 30s → retry at 1_000_030.
        let r = rec(0, 5, 0, 3);
        assert_eq!(
            decide_resend(&r, 1_000_010, 30),
            ResendDecision::Cooldown { retry_at_secs: 1_000_030 }
        );
        // Boundary: exactly at retry_at the cooldown has elapsed.
        assert_eq!(decide_resend(&r, 1_000_030, 30), ResendDecision::Ok);
        assert_eq!(decide_resend(&r, 1_000_100, 30), ResendDecision::Ok);
        // Resend budget spent.
        assert_eq!(decide_resend(&rec(0, 5, 3, 3), 1_000_100, 30), ResendDecision::MaxResends);
        // Expired record.
        assert_eq!(decide_resend(&r, 1_000_300, 30), ResendDecision::Expired);
    }

    // -- code sealing ------------------------------------------------------------

    #[test]
    fn seal_unseal_round_trips_without_key() {
        // No SABSMS_CREDS_KEY in the test env → plain.<b64> fallback.
        let sealed = seal_code("482915", "sabsms:otp:ws1:+14155552671");
        let out = unseal_code(&sealed, "sabsms:otp:ws1:+14155552671").unwrap();
        assert_eq!(out, "482915");
        // The plaintext code never appears verbatim in the stored value.
        assert!(!sealed.contains("482915"));
    }

    #[test]
    fn unseal_rejects_garbage() {
        assert_eq!(unseal_code("v1.notb64.alsonot", "k"), None);
        assert_eq!(unseal_code("v9.xx.yy", "k"), None);
        assert_eq!(unseal_code("", "k"), None);
    }

    // -- config defaults -----------------------------------------------------------

    #[test]
    fn config_defaults_match_spec() {
        let c = OtpConfig::default();
        assert_eq!(c.code_length, 6);
        assert_eq!(c.ttl_secs, 300);
        assert_eq!(c.max_attempts, 5);
        assert_eq!(c.max_resends, 3);
        assert_eq!(c.resend_cooldown_secs, 30);
        assert_eq!(c.template_body, "Your verification code is {#code#}");
    }

    #[test]
    fn config_from_doc_reads_and_clamps() {
        let d = doc! {
            "workspaceId": "ws1",
            "codeLength": 8,
            "ttlSecs": 120,
            "maxAttempts": 3,
            "maxResends": 1,
            "resendCooldownSecs": 60,
            "templateBody": "{#brand#} code: {#code#}",
            "senderId": "SABNDE",
            "brandName": "SabNode",
        };
        let c = OtpConfig::from_doc(&d);
        assert_eq!(c.code_length, 8);
        assert_eq!(c.ttl_secs, 120);
        assert_eq!(c.max_attempts, 3);
        assert_eq!(c.max_resends, 1);
        assert_eq!(c.resend_cooldown_secs, 60);
        assert_eq!(c.sender_id.as_deref(), Some("SABNDE"));
        assert_eq!(c.brand_name.as_deref(), Some("SabNode"));

        // Out-of-range values clamp; junk strings fall to defaults.
        let d = doc! { "codeLength": 99, "ttlSecs": 1, "maxAttempts": 0, "templateBody": "  " };
        let c = OtpConfig::from_doc(&d);
        assert_eq!(c.code_length, 8);
        assert_eq!(c.ttl_secs, 30);
        assert_eq!(c.max_attempts, 1);
        assert_eq!(c.template_body, "Your verification code is {#code#}");
    }

    #[test]
    fn otp_key_shape_is_stable() {
        assert_eq!(otp_key("ws1", "+14155552671"), "sabsms:otp:ws1:+14155552671");
    }
}
