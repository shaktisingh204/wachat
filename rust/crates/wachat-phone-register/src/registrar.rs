//! [`PhoneRegistrar`] — typed handle around the five Meta Cloud API
//! phone-number lifecycle endpoints.
//!
//! ## Redaction
//!
//! `pin` and `code` values are **never logged**. Every `#[instrument]`
//! attribute on this file is `skip`-listed for those parameters. Span
//! fields surface only `phone_number_id`, `project_id`, and
//! coarse-grained metadata (`code_method`, `language`).
//!
//! ## Already-registered semantics (TS parity)
//!
//! `registerPhoneNumber` in the TS treats the strings
//! `"already registered"` / `"already been registered"` from a Meta
//! error message as **success** rather than failure
//! (`whatsapp.actions.ts:834`). [`PhoneRegistrar::register`] mirrors
//! that: it intercepts a 4xx [`MetaError::Api`] whose message contains
//! either substring and returns `Ok(())`, so a re-register on an
//! already-live number is idempotent.

use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use tracing::{debug, info, instrument, warn};

use wachat_meta_client::{MetaClient, MetaError};
use wachat_types::project::Project;

use crate::dto::{
    DeregisterBody, RegisterBody, RequestCodeBody, TwoStepPinBody, VerificationMethod,
    VerifyCodeBody,
};

/// Length of a Meta 2FA PIN (`whatsapp.actions.ts:922`:
/// `if (!pin || pin.length !== 6 || !/^\d+$/.test(pin))`).
const PIN_LENGTH: usize = 6;

/// Phone-number lifecycle handle for Meta Cloud API v23.0.
///
/// Cheap to clone — wraps a [`MongoHandle`] (internally `Arc`'d) and a
/// [`MetaClient`] (also internally `Arc`'d). Construct once per process
/// and clone freely.
#[derive(Debug, Clone)]
pub struct PhoneRegistrar {
    #[allow(dead_code)] // Reserved for future per-phone-number Mongo writes; kept on the public ctor for parity with sibling crates.
    mongo: MongoHandle,
    meta: MetaClient,
}

impl PhoneRegistrar {
    /// Construct from a Mongo handle and a Meta HTTP client.
    ///
    /// `mongo` is currently retained for future state-tracking work
    /// (per-phone-number registration audit, last-verified-at, etc.) so
    /// the public surface stays stable when those land.
    pub fn new(mongo: MongoHandle, meta: MetaClient) -> Self {
        Self { mongo, meta }
    }

    /// Register a phone number with WhatsApp Cloud API.
    ///
    /// Wire call:
    /// `POST https://graph.facebook.com/v23.0/{phone-number-id}/register`
    /// with body `{ "messaging_product": "whatsapp", "pin": "..." }`.
    ///
    /// Mirrors `registerPhoneNumber` in `whatsapp.actions.ts:819`:
    ///
    /// ```ts
    /// await axios.post(
    ///     `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/register`,
    ///     { messaging_product: 'whatsapp', pin: '123456' },
    ///     { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
    /// );
    /// ```
    ///
    /// **Idempotency.** A 4xx whose message contains `"already registered"`
    /// or `"already been registered"` is **swallowed and returned as
    /// `Ok`** to match the TS handler's success branch on lines 834-836.
    ///
    /// **PIN handling.** The TS hard-codes `pin: '123456'`. We accept a
    /// caller-supplied `pin` instead so the handler crate can route the
    /// real PIN through. The PIN is validated (digits only, `len == 6`)
    /// and **never logged** — span fields below `skip` it.
    #[instrument(
        level = "debug",
        skip(self, project, pin),
        fields(project_id = %project.id, phone_number_id = %phone_number_id),
    )]
    pub async fn register(
        &self,
        project: &Project,
        phone_number_id: &str,
        pin: &str,
    ) -> Result<(), ApiError> {
        let access_token = project_access_token(project)?;
        validate_phone_number_id(phone_number_id)?;
        validate_pin(pin)?;

        let body = RegisterBody {
            messaging_product: "whatsapp",
            pin,
        };

        let path = format!("{phone_number_id}/register");
        // We don't care about the Meta response body — `serde_json::Value`
        // captures whatever Meta returns (typically `{"success": true}`).
        let result: Result<serde_json::Value, MetaError> =
            self.meta.post_json(&path, access_token, &body).await;

        match result {
            Ok(_) => {
                info!(
                    phone_number_id,
                    "phone number registered with WhatsApp Cloud API"
                );
                Ok(())
            }
            Err(err) if is_already_registered(&err) => {
                // Mirrors TS lines 834-836: treat "already registered" as
                // success so re-running register is idempotent.
                info!(
                    phone_number_id,
                    "phone number was already registered; treated as success"
                );
                Ok(())
            }
            Err(err) => {
                warn!(phone_number_id, error = %err, "phone register failed");
                Err(ApiError::from(err))
            }
        }
    }

    /// Ask Meta to send a verification code to the phone-number's owner.
    ///
    /// Wire call:
    /// `POST https://graph.facebook.com/v23.0/{phone-number-id}/request_code`
    /// with body `{ "code_method": "SMS"|"VOICE", "language": "<lang>" }`.
    ///
    /// Mirrors `handleRequestVerificationCode` in
    /// `whatsapp.actions.ts:844`:
    ///
    /// ```ts
    /// await axios.post(
    ///     `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/request_code`,
    ///     { code_method: codeMethod, language: 'en' },
    ///     { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
    /// );
    /// ```
    ///
    /// `language` follows Meta's BCP-47-ish locale code (the TS hard-codes
    /// `"en"`); we accept a caller-supplied value so the handler can pick
    /// per-project. An empty string is rejected as `Validation`.
    #[instrument(
        level = "debug",
        skip(self, project),
        fields(
            project_id = %project.id,
            phone_number_id = %phone_number_id,
            code_method = method.as_meta_str(),
            language = %language,
        ),
    )]
    pub async fn request_verification_code(
        &self,
        project: &Project,
        phone_number_id: &str,
        method: VerificationMethod,
        language: &str,
    ) -> Result<(), ApiError> {
        let access_token = project_access_token(project)?;
        validate_phone_number_id(phone_number_id)?;
        if language.trim().is_empty() {
            return Err(ApiError::Validation(
                "language is required for verification code request.".to_owned(),
            ));
        }

        let body = RequestCodeBody {
            code_method: method,
            language,
        };
        let path = format!("{phone_number_id}/request_code");
        let _: serde_json::Value = self
            .meta
            .post_json(&path, access_token, &body)
            .await
            .map_err(|err| {
                warn!(phone_number_id, error = %err, "request_verification_code failed");
                ApiError::from(err)
            })?;

        info!(
            phone_number_id,
            code_method = method.as_meta_str(),
            "verification code requested"
        );
        Ok(())
    }

    /// Submit a previously-requested verification code back to Meta.
    ///
    /// Wire call:
    /// `POST https://graph.facebook.com/v23.0/{phone-number-id}/verify_code`
    /// with body `{ "code": "<code>" }`.
    ///
    /// Mirrors `handleVerifyCode` in `whatsapp.actions.ts:866`:
    ///
    /// ```ts
    /// await axios.post(
    ///     `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/verify_code`,
    ///     { code },
    ///     { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
    /// );
    /// ```
    ///
    /// **Code handling.** The verification code is **never logged** — the
    /// span `skip`s it explicitly. Empty codes short-circuit as a
    /// 422 `Validation` error.
    #[instrument(
        level = "debug",
        skip(self, project, code),
        fields(project_id = %project.id, phone_number_id = %phone_number_id),
    )]
    pub async fn verify_code(
        &self,
        project: &Project,
        phone_number_id: &str,
        code: &str,
    ) -> Result<(), ApiError> {
        let access_token = project_access_token(project)?;
        validate_phone_number_id(phone_number_id)?;
        if code.trim().is_empty() {
            return Err(ApiError::Validation(
                "verification code is required.".to_owned(),
            ));
        }

        let body = VerifyCodeBody { code };
        let path = format!("{phone_number_id}/verify_code");
        let _: serde_json::Value = self
            .meta
            .post_json(&path, access_token, &body)
            .await
            .map_err(|err| {
                warn!(phone_number_id, error = %err, "verify_code failed");
                ApiError::from(err)
            })?;

        info!(phone_number_id, "phone number verified");
        Ok(())
    }

    /// Deregister a phone number from WhatsApp Cloud API.
    ///
    /// Wire call:
    /// `POST https://graph.facebook.com/v23.0/{phone-number-id}/deregister`
    /// with body `{ "messaging_product": "whatsapp" }`.
    ///
    /// Mirrors `deregisterPhoneNumber` in `whatsapp.actions.ts:888`:
    ///
    /// ```ts
    /// await axios.post(
    ///     `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/deregister`,
    ///     { messaging_product: 'whatsapp' },
    ///     { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
    /// );
    /// ```
    #[instrument(
        level = "debug",
        skip(self, project),
        fields(project_id = %project.id, phone_number_id = %phone_number_id),
    )]
    pub async fn deregister(
        &self,
        project: &Project,
        phone_number_id: &str,
    ) -> Result<(), ApiError> {
        let access_token = project_access_token(project)?;
        validate_phone_number_id(phone_number_id)?;

        let body = DeregisterBody {
            messaging_product: "whatsapp",
        };
        let path = format!("{phone_number_id}/deregister");
        let _: serde_json::Value = self
            .meta
            .post_json(&path, access_token, &body)
            .await
            .map_err(|err| {
                warn!(phone_number_id, error = %err, "deregister failed");
                ApiError::from(err)
            })?;

        info!(phone_number_id, "phone number deregistered from Cloud API");
        Ok(())
    }

    /// Set / rotate the two-step verification PIN on a phone number.
    ///
    /// Wire call:
    /// `POST https://graph.facebook.com/v23.0/{phone-number-id}` with body
    /// `{ "pin": "<pin>" }` (note: the bare phone-number-id endpoint, no
    /// `/something` suffix).
    ///
    /// Mirrors `handleSetTwoStepVerificationPin` in
    /// `whatsapp.actions.ts:912`:
    ///
    /// ```ts
    /// await axios.post(
    ///     `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
    ///     { pin },
    ///     { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
    /// );
    /// ```
    ///
    /// **PIN validation.** Mirrors TS line 922:
    /// `pin.length === 6 && /^\d+$/.test(pin)`. Bad PINs short-circuit
    /// as 422 `Validation` errors and never reach Meta. The PIN is
    /// **never logged** — the span `skip`s it.
    #[instrument(
        level = "debug",
        skip(self, project, pin),
        fields(project_id = %project.id, phone_number_id = %phone_number_id),
    )]
    pub async fn set_two_step_pin(
        &self,
        project: &Project,
        phone_number_id: &str,
        pin: &str,
    ) -> Result<(), ApiError> {
        let access_token = project_access_token(project)?;
        validate_phone_number_id(phone_number_id)?;
        validate_pin(pin)?;

        let body = TwoStepPinBody { pin };
        let _: serde_json::Value = self
            .meta
            .post_json(phone_number_id, access_token, &body)
            .await
            .map_err(|err| {
                warn!(phone_number_id, error = %err, "set_two_step_pin failed");
                ApiError::from(err)
            })?;

        info!(phone_number_id, "two-step verification pin updated");
        Ok(())
    }
}

// -------------------------------------------------------------------------
// helpers (private)
// -------------------------------------------------------------------------

/// Pull the access token off `Project`. Mirrors the TS guard
/// `if (!project || !project.accessToken) { return error }` that opens
/// every one of the five action handlers.
fn project_access_token(project: &Project) -> Result<&str, ApiError> {
    project
        .access_token
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest("Project not found or access token is missing.".to_owned())
        })
}

/// Reject empty / whitespace phone-number IDs before we round-trip to Meta.
/// Meta itself would 400, but failing fast keeps the surface honest and
/// avoids constructing a malformed URL like `v23.0//register`.
fn validate_phone_number_id(id: &str) -> Result<(), ApiError> {
    if id.trim().is_empty() {
        return Err(ApiError::Validation(
            "phone_number_id is required.".to_owned(),
        ));
    }
    Ok(())
}

/// Mirrors TS `whatsapp.actions.ts:922`:
/// `if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {...}`.
///
/// Returns a `Validation` error so the SabNode envelope surfaces a 422.
/// Critically: the returned message **does not echo the PIN** (which the
/// TS already avoids). Tracing/log emission is the caller's
/// responsibility, but we never include `pin` in our own warn/info
/// records either.
fn validate_pin(pin: &str) -> Result<(), ApiError> {
    if pin.len() != PIN_LENGTH || !pin.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ApiError::Validation("PIN must be a 6-digit number.".to_owned()));
    }
    Ok(())
}

/// Heuristic: did Meta tell us the number is already registered? TS lines
/// 834-836 short-circuit those exact substrings to a success outcome.
///
/// We only check `MetaError::Api` (i.e. a structured 4xx body) so genuine
/// 5xx / network errors are still surfaced. The TS string match is on
/// the rendered `error.response?.data?.error?.message` so we mirror that
/// against [`MetaError::Api::message`].
fn is_already_registered(err: &MetaError) -> bool {
    let MetaError::Api { status, message, .. } = err else {
        return false;
    };
    if !(400..500).contains(status) {
        return false;
    }
    let m = message.to_ascii_lowercase();
    m.contains("already registered") || m.contains("already been registered")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_pin_accepts_six_ascii_digits() {
        assert!(validate_pin("000000").is_ok());
        assert!(validate_pin("123456").is_ok());
        assert!(validate_pin("999999").is_ok());
    }

    #[test]
    fn validate_pin_rejects_wrong_length_and_non_digits() {
        for bad in ["", "1", "12345", "1234567", "12345a", "abcdef", "12 456"] {
            let err = validate_pin(bad).unwrap_err();
            assert!(
                matches!(err, ApiError::Validation(_)),
                "expected Validation for {bad:?}"
            );
            // Belt-and-suspenders: the rendered error must not echo the PIN.
            assert!(
                !err.to_string().contains(bad) || bad.is_empty(),
                "PIN value leaked into error string for {bad:?}"
            );
        }
    }

    #[test]
    fn validate_phone_number_id_rejects_empty_or_whitespace() {
        assert!(validate_phone_number_id("").is_err());
        assert!(validate_phone_number_id("   ").is_err());
        assert!(validate_phone_number_id("1234567890").is_ok());
    }

    #[test]
    fn already_registered_matches_known_phrasings() {
        let err = MetaError::Api {
            status: 400,
            code: Some(133015),
            subcode: None,
            fbtrace_id: None,
            message: "(#133015) Phone number already registered.".to_owned(),
        };
        assert!(is_already_registered(&err));

        let err = MetaError::Api {
            status: 400,
            code: None,
            subcode: None,
            fbtrace_id: None,
            message: "This phone number has already been registered to a WABA.".to_owned(),
        };
        assert!(is_already_registered(&err));
    }

    #[test]
    fn already_registered_ignores_5xx_and_unrelated_messages() {
        let err = MetaError::Api {
            status: 500,
            code: None,
            subcode: None,
            fbtrace_id: None,
            message: "already registered".to_owned(),
        };
        // Server errors are NOT treated as success even if Meta echoes the phrase.
        assert!(!is_already_registered(&err));

        let err = MetaError::Api {
            status: 400,
            code: None,
            subcode: None,
            fbtrace_id: None,
            message: "Invalid PIN".to_owned(),
        };
        assert!(!is_already_registered(&err));

        let err = MetaError::Timeout;
        assert!(!is_already_registered(&err));
    }
}
