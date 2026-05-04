//! Media download client.
//!
//! Downloading WhatsApp media is a two-step dance:
//!
//! 1. **Look up** the signed URL: `GET /{media_id}` — returns a JSON
//!    blob with a short-lived `url`, plus mime type, sha256, and size.
//! 2. **Fetch** the bytes from that signed URL. Even though the URL is
//!    "signed", Meta still requires `Authorization: Bearer {token}` on
//!    the actual download request.
//!
//! The signed URL contains short-lived credentials — we never log it.

use std::time::Duration;

use bytes::Bytes;

use crate::error::MediaError;
use crate::meta_error_parse::parse_meta_error;
use crate::types::MediaUrlInfo;

/// Quick metadata lookups should be fast; long downloads get the
/// upload-style 60 s budget.
const FETCH_URL_TIMEOUT: Duration = Duration::from_secs(30);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);

/// Download client. Two underlying `reqwest::Client`s so the metadata
/// lookup and the (potentially slow) byte download don't share a
/// timeout budget.
#[derive(Debug, Clone)]
pub struct MediaDownloader {
    fetch_http: reqwest::Client,
    download_http: reqwest::Client,
    base: String,
    version: String,
}

impl MediaDownloader {
    pub fn new(version: &str) -> Self {
        let fetch_http = reqwest::Client::builder()
            .timeout(FETCH_URL_TIMEOUT)
            .build()
            .expect("reqwest client builder should not fail");
        let download_http = reqwest::Client::builder()
            .timeout(DOWNLOAD_TIMEOUT)
            .build()
            .expect("reqwest client builder should not fail");

        Self {
            fetch_http,
            download_http,
            base: "https://graph.facebook.com".to_owned(),
            version: version.to_owned(),
        }
    }

    /// Test/internal constructor.
    #[doc(hidden)]
    pub fn new_with_base(base: impl Into<String>, version: impl Into<String>) -> Self {
        let fetch_http = reqwest::Client::builder()
            .timeout(FETCH_URL_TIMEOUT)
            .build()
            .expect("reqwest client builder should not fail");
        let download_http = reqwest::Client::builder()
            .timeout(DOWNLOAD_TIMEOUT)
            .build()
            .expect("reqwest client builder should not fail");
        Self {
            fetch_http,
            download_http,
            base: base.into(),
            version: version.into(),
        }
    }

    /// `GET /{version}/{media_id}` → `MediaUrlInfo` containing the
    /// signed URL plus mime/sha256/size metadata.
    pub async fn fetch_url(&self, media_id: &str, token: &str) -> Result<MediaUrlInfo, MediaError> {
        let url = format!("{}/{}/{}", self.base, self.version, media_id);

        tracing::debug!(
            target: "wachat_media::download",
            media_id,
            "fetching signed media url"
        );

        let resp = self.fetch_http.get(&url).bearer_auth(token).send().await?;

        let status = resp.status();
        let body = resp.bytes().await?;

        if !status.is_success() {
            return Err(parse_meta_error(status.as_u16(), &body));
        }

        let info: MediaUrlInfo = serde_json::from_slice(&body)?;
        Ok(info)
    }

    /// Download the actual media bytes from a signed URL returned by
    /// `fetch_url`. Meta requires the `Authorization: Bearer ...`
    /// header even though the URL is signed.
    ///
    /// We deliberately do not log `signed_url` — it carries embedded
    /// credentials.
    pub async fn download(&self, signed_url: &str, token: &str) -> Result<Bytes, MediaError> {
        tracing::debug!(
            target: "wachat_media::download",
            "downloading media bytes from signed url"
        );

        let resp = self
            .download_http
            .get(signed_url)
            .bearer_auth(token)
            .send()
            .await?;

        let status = resp.status();
        let body = resp.bytes().await?;

        if !status.is_success() {
            return Err(parse_meta_error(status.as_u16(), &body));
        }

        Ok(body)
    }
}
