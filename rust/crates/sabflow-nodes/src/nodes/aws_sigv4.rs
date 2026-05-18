//! Minimal AWS SigV4 signer shared by the AWS-family nodes that don't pull
//! in an `aws-sdk-*` crate.
//!
//! Implements the "signed headers + signed payload" variant of SigV4 against
//! arbitrary services (Lambda, SES, SNS, SQS, CloudWatch Logs, Comprehend, ...).
//! No streaming / chunked / presign variants — the AWS-family nodes here always
//! send a single body buffer.
//!
//! Reference: <https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html>

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use reqwest::{Method, Request, Url, header::HeaderMap, header::HeaderName, header::HeaderValue};
use sha2::{Digest, Sha256};

use crate::error::{NodeError, NodeResult};

type HmacSha256 = Hmac<Sha256>;

/// Inputs the AWS-family nodes hand to the signer.
pub struct SignParams<'a> {
    pub method: Method,
    pub url: Url,
    /// Extra headers (e.g. `X-Amz-Target`, `Content-Type`). `host`, `x-amz-date`,
    /// and `authorization` are filled in by the signer.
    pub extra_headers: HeaderMap,
    /// Raw request body (already serialised to bytes).
    pub body: Vec<u8>,
    pub region: &'a str,
    /// AWS service identifier (`lambda`, `ses`, `sns`, `sqs`, `logs`, `comprehend`, ...).
    pub service: &'a str,
    pub access_key_id: &'a str,
    pub secret_access_key: &'a str,
    /// Optional STS session token. When present, the signer adds the
    /// `X-Amz-Security-Token` header and includes it in the canonical request.
    pub session_token: Option<&'a str>,
    /// `now` is injected so tests can pin a deterministic signature; callers
    /// typically pass `Utc::now()`.
    pub now: DateTime<Utc>,
}

/// Build a fully-signed `reqwest::Request` ready to ship.
pub fn sign_request(p: SignParams<'_>) -> NodeResult<Request> {
    let amz_date = p.now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = p.now.format("%Y%m%d").to_string();

    // 1. canonical request
    let host = p
        .url
        .host_str()
        .ok_or_else(|| NodeError::Other("AWS SigV4: URL missing host".into()))?
        .to_string();

    let canonical_uri = canonical_uri(&p.url);
    let canonical_query = canonical_query_string(&p.url);

    // Build the canonical-headers list (lowercase name, trimmed value).
    let mut hdrs: BTreeMap<String, String> = BTreeMap::new();
    hdrs.insert("host".into(), host.clone());
    hdrs.insert("x-amz-date".into(), amz_date.clone());
    if let Some(tok) = p.session_token {
        hdrs.insert("x-amz-security-token".into(), tok.to_string());
    }
    for (name, val) in p.extra_headers.iter() {
        let n = name.as_str().to_ascii_lowercase();
        let v = val.to_str().unwrap_or("").trim().to_string();
        hdrs.insert(n, v);
    }

    let signed_headers = hdrs.keys().cloned().collect::<Vec<_>>().join(";");
    let canonical_headers = hdrs
        .iter()
        .map(|(k, v)| format!("{k}:{v}\n"))
        .collect::<String>();

    let payload_hash = hex_sha256(&p.body);

    let canonical_request = format!(
        "{method}\n{uri}\n{query}\n{headers}\n{signed}\n{payload}",
        method = p.method.as_str(),
        uri = canonical_uri,
        query = canonical_query,
        headers = canonical_headers,
        signed = signed_headers,
        payload = payload_hash,
    );

    // 2. string to sign
    let credential_scope = format!("{date_stamp}/{}/{}/aws4_request", p.region, p.service);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{hash}",
        hash = hex_sha256(canonical_request.as_bytes()),
    );

    // 3. derive signing key
    let k_date = hmac(format!("AWS4{}", p.secret_access_key).as_bytes(), date_stamp.as_bytes())?;
    let k_region = hmac(&k_date, p.region.as_bytes())?;
    let k_service = hmac(&k_region, p.service.as_bytes())?;
    let k_signing = hmac(&k_service, b"aws4_request")?;

    // 4. signature
    let signature_bytes = hmac(&k_signing, string_to_sign.as_bytes())?;
    let signature = hex_encode(&signature_bytes);

    let auth = format!(
        "AWS4-HMAC-SHA256 Credential={ak}/{scope}, SignedHeaders={signed}, Signature={sig}",
        ak = p.access_key_id,
        scope = credential_scope,
        signed = signed_headers,
        sig = signature,
    );

    // 5. assemble the reqwest::Request
    let client = reqwest::Client::new();
    let mut req = client.request(p.method.clone(), p.url.clone()).body(p.body).build()?;
    let headers_mut = req.headers_mut();
    for (name, val) in p.extra_headers.iter() {
        headers_mut.insert(name.clone(), val.clone());
    }
    headers_mut.insert(
        HeaderName::from_static("host"),
        HeaderValue::from_str(&host).map_err(|e| NodeError::Other(format!("AWS SigV4: {e}")))?,
    );
    headers_mut.insert(
        HeaderName::from_static("x-amz-date"),
        HeaderValue::from_str(&amz_date).map_err(|e| NodeError::Other(format!("AWS SigV4: {e}")))?,
    );
    if let Some(tok) = p.session_token {
        headers_mut.insert(
            HeaderName::from_static("x-amz-security-token"),
            HeaderValue::from_str(tok).map_err(|e| NodeError::Other(format!("AWS SigV4: {e}")))?,
        );
    }
    headers_mut.insert(
        reqwest::header::AUTHORIZATION,
        HeaderValue::from_str(&auth).map_err(|e| NodeError::Other(format!("AWS SigV4: {e}")))?,
    );
    Ok(req)
}

fn canonical_uri(url: &Url) -> String {
    // AWS expects RFC 3986 percent-encoding of each path segment. `reqwest`'s
    // `Url::path()` already gives us a normalised path. For S3 the path needs
    // a double-encode, but none of the AWS-family nodes here are S3 — they
    // either use "/" or a fixed REST sub-path that's safe to pass through.
    let path = url.path();
    if path.is_empty() { "/".into() } else { path.to_string() }
}

fn canonical_query_string(url: &Url) -> String {
    let mut params: Vec<(String, String)> = url
        .query_pairs()
        .map(|(k, v)| (uri_encode(&k), uri_encode(&v)))
        .collect();
    params.sort();
    params
        .into_iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&")
}

/// AWS-flavoured percent-encoding: every byte outside the unreserved set is
/// `%XX`, and the unreserved set excludes `/` for query values.
fn uri_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for byte in s.as_bytes() {
        let b = *byte;
        let unreserved = b.is_ascii_alphanumeric()
            || b == b'-'
            || b == b'_'
            || b == b'.'
            || b == b'~';
        if unreserved {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn hex_sha256(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex_encode(&h.finalize())
}

fn hmac(key: &[u8], msg: &[u8]) -> NodeResult<Vec<u8>> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
        .map_err(|e| NodeError::Other(format!("AWS SigV4 HMAC: {e}")))?;
    mac.update(msg);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

/// Convenience: read AWS credentials (`accessKeyId`, `secretAccessKey`, `region`,
/// optional `sessionToken`) out of a [`crate::context::Credential`].
pub struct AwsCreds {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: String,
    pub session_token: Option<String>,
}

impl AwsCreds {
    pub fn from_credential(cred: &crate::context::Credential) -> NodeResult<Self> {
        let access_key_id = cred
            .data
            .get("accessKeyId")
            .ok_or_else(|| NodeError::MissingParameter("accessKeyId".into()))?
            .clone();
        let secret_access_key = cred
            .data
            .get("secretAccessKey")
            .ok_or_else(|| NodeError::MissingParameter("secretAccessKey".into()))?
            .clone();
        let region = cred
            .data
            .get("region")
            .ok_or_else(|| NodeError::MissingParameter("region".into()))?
            .clone();
        let session_token = cred.data.get("sessionToken").cloned().filter(|s| !s.is_empty());
        Ok(Self {
            access_key_id,
            secret_access_key,
            region,
            session_token,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use reqwest::header::HeaderValue;

    /// AWS published test vector (`get-vanilla` from the SigV4 test suite,
    /// simplified). We don't reproduce the entire fixture — just check that
    /// signing is stable: the same inputs produce the same signature on every
    /// run.
    #[test]
    fn signing_is_deterministic() {
        let now = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();

        let mut h = HeaderMap::new();
        h.insert("content-type", HeaderValue::from_static("application/json"));

        let mk = || SignParams {
            method: Method::POST,
            url: "https://lambda.us-east-1.amazonaws.com/2015-03-31/functions/fn/invocations"
                .parse()
                .unwrap(),
            extra_headers: h.clone(),
            body: br#"{"hello":"world"}"#.to_vec(),
            region: "us-east-1",
            service: "lambda",
            access_key_id: "AKIDEXAMPLE",
            secret_access_key: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
            session_token: None,
            now,
        };

        let req1 = sign_request(mk()).unwrap();
        let req2 = sign_request(mk()).unwrap();

        let auth1 = req1.headers().get("authorization").unwrap().to_str().unwrap();
        let auth2 = req2.headers().get("authorization").unwrap().to_str().unwrap();
        assert_eq!(auth1, auth2, "signature must be deterministic for the same inputs");
        assert!(auth1.starts_with("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20240101/us-east-1/lambda/aws4_request"));
        assert!(auth1.contains("SignedHeaders=content-type;host;x-amz-date"));
    }

    #[test]
    fn session_token_is_included_in_signed_headers() {
        let now = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
        let req = sign_request(SignParams {
            method: Method::POST,
            url: "https://sqs.us-east-1.amazonaws.com/".parse().unwrap(),
            extra_headers: HeaderMap::new(),
            body: vec![],
            region: "us-east-1",
            service: "sqs",
            access_key_id: "AKIDEXAMPLE",
            secret_access_key: "secret",
            session_token: Some("FQoDYXdz..."),
            now,
        })
        .unwrap();
        let auth = req.headers().get("authorization").unwrap().to_str().unwrap();
        assert!(auth.contains("x-amz-security-token"));
        assert!(req.headers().contains_key("x-amz-security-token"));
    }
}
