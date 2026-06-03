//! Cloudflare R2 client thin wrapper over `aws-sdk-s3`.
//!
//! R2 is S3-compatible: we point the SDK at `https://<account>.r2.cloudflarestorage.com`
//! with `region = "auto"` and standard access-key credentials. Every method
//! here corresponds to one operation the file manager needs.
//!
//! Required environment variables:
//!
//! | Var                   | Notes                                              |
//! |-----------------------|----------------------------------------------------|
//! | `R2_ACCOUNT_ID`       | Cloudflare account id                              |
//! | `R2_ACCESS_KEY_ID`    | R2 token access key                                |
//! | `R2_SECRET_ACCESS_KEY`| R2 token secret                                    |
//! | `R2_BUCKET`           | Bucket name                                        |
//! | `R2_PUBLIC_URL`       | Optional CDN base — when set, public files use it  |
//!
//! Presigning uses SigV4 (handled by aws-sdk-s3 internally). PUT presign
//! returns an URL the browser can issue a single direct upload to without
//! going through our backend.

use std::time::Duration;

use anyhow::{Context, Result};
use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    Client, config::Builder as S3ConfigBuilder, presigning::PresigningConfig,
    primitives::ByteStream, types::Delete as S3Delete, types::ObjectIdentifier,
};

#[derive(Clone)]
pub struct R2Config {
    pub account_id: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub bucket: String,
    pub public_url: Option<String>,
}

impl R2Config {
    /// Read configuration from environment variables. Returns `None` and
    /// logs a warning if any required field is missing — callers keep
    /// running without R2 (uploads will fail with a runtime error, but
    /// folder browsing still works).
    pub fn from_env() -> Option<Self> {
        let account_id = std::env::var("R2_ACCOUNT_ID").ok()?;
        let access_key_id = std::env::var("R2_ACCESS_KEY_ID").ok()?;
        let secret_access_key = std::env::var("R2_SECRET_ACCESS_KEY").ok()?;
        let bucket = std::env::var("R2_BUCKET").ok()?;
        let public_url = std::env::var("R2_PUBLIC_URL").ok();
        Some(Self {
            account_id,
            access_key_id,
            secret_access_key,
            bucket,
            public_url,
        })
    }

    pub fn endpoint(&self) -> String {
        format!("https://{}.r2.cloudflarestorage.com", self.account_id)
    }
}

#[derive(Clone)]
pub struct R2Client {
    client: Client,
    bucket: String,
    public_url: Option<String>,
}

impl R2Client {
    pub async fn new(cfg: R2Config) -> Result<Self> {
        let creds = Credentials::new(
            &cfg.access_key_id,
            &cfg.secret_access_key,
            None,
            None,
            "sabfiles-r2",
        );
        let endpoint = cfg.endpoint();

        let shared = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new("auto"))
            .credentials_provider(creds)
            .load()
            .await;

        let s3_cfg = S3ConfigBuilder::from(&shared)
            .endpoint_url(endpoint)
            .force_path_style(true)
            .build();

        Ok(Self {
            client: Client::from_conf(s3_cfg),
            bucket: cfg.bucket,
            public_url: cfg.public_url,
        })
    }

    pub fn bucket(&self) -> &str {
        &self.bucket
    }

    /// Public URL when `R2_PUBLIC_URL` is configured, otherwise `None`
    /// (the caller should fall back to a presigned GET).
    pub fn public_url_for(&self, key: &str) -> Option<String> {
        let base = self.public_url.as_deref()?;
        Some(format!("{}/{}", base.trim_end_matches('/'), key))
    }

    /// Generate a presigned PUT URL the browser can use to upload directly
    /// to R2 in one request. `expires_in` defaults to 15 minutes.
    pub async fn presign_put(
        &self,
        key: &str,
        content_type: Option<&str>,
        expires_in: Option<Duration>,
    ) -> Result<String> {
        let presigning_cfg =
            PresigningConfig::expires_in(expires_in.unwrap_or(Duration::from_secs(900)))
                .context("invalid presigning duration")?;

        let mut builder = self.client.put_object().bucket(&self.bucket).key(key);
        if let Some(ct) = content_type {
            builder = builder.content_type(ct);
        }

        let presigned = builder
            .presigned(presigning_cfg)
            .await
            .context("R2 presign PUT failed")?;
        Ok(presigned.uri().to_string())
    }

    /// Generate a presigned GET URL for an object. Used when no public CDN
    /// is configured, or when serving downloads with attachment headers.
    pub async fn presign_get(
        &self,
        key: &str,
        expires_in: Option<Duration>,
        download_filename: Option<&str>,
    ) -> Result<String> {
        let presigning_cfg =
            PresigningConfig::expires_in(expires_in.unwrap_or(Duration::from_secs(3600)))
                .context("invalid presigning duration")?;

        let mut builder = self.client.get_object().bucket(&self.bucket).key(key);
        if let Some(name) = download_filename {
            // Force "download" via response-content-disposition.
            let safe = name.replace('"', "");
            builder =
                builder.response_content_disposition(format!("attachment; filename=\"{}\"", safe));
        }

        let presigned = builder
            .presigned(presigning_cfg)
            .await
            .context("R2 presign GET failed")?;
        Ok(presigned.uri().to_string())
    }

    /// Upload bytes through the Rust BFF. This avoids browser-to-R2 CORS
    /// requirements for clients that cannot rely on bucket CORS settings.
    pub async fn put_object_bytes(
        &self,
        key: &str,
        bytes: Vec<u8>,
        content_type: Option<&str>,
    ) -> Result<()> {
        let mut builder = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(bytes));

        if let Some(ct) = content_type {
            builder = builder.content_type(ct);
        }

        builder.send().await.context("R2 put_object failed")?;
        Ok(())
    }

    /// Delete a single object. Errors when the key is missing are
    /// swallowed by R2/S3 (200 with no body), so this is idempotent.
    pub async fn delete_object(&self, key: &str) -> Result<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .context("R2 delete_object failed")?;
        Ok(())
    }

    /// Delete up to 1000 objects in one request. Caller is responsible for
    /// chunking when there are more.
    pub async fn delete_objects(&self, keys: &[String]) -> Result<()> {
        if keys.is_empty() {
            return Ok(());
        }
        let objects: Vec<ObjectIdentifier> = keys
            .iter()
            .filter_map(|k| ObjectIdentifier::builder().key(k).build().ok())
            .collect();
        let delete = S3Delete::builder()
            .set_objects(Some(objects))
            .build()
            .context("building S3 Delete payload")?;
        self.client
            .delete_objects()
            .bucket(&self.bucket)
            .delete(delete)
            .send()
            .await
            .context("R2 delete_objects failed")?;
        Ok(())
    }
}

/// Build a stable storage key for a user-owned upload.
/// Path shape: `users/<userId>/files/<yyyy>/<mm>/<random>-<safeFileName>`
pub fn build_file_key(user_id: &str, file_name: &str) -> String {
    use rand::Rng;
    let safe: String = file_name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .chars()
        .take(120)
        .collect();
    let safe = if safe.is_empty() {
        "file".to_owned()
    } else {
        safe
    };
    let now = chrono::Utc::now();
    let rand_bytes: [u8; 8] = rand::thread_rng().r#gen();
    format!(
        "users/{}/files/{}/{:02}/{}-{}",
        user_id,
        now.format("%Y"),
        now.format("%m"),
        hex::encode(rand_bytes),
        safe,
    )
}
