//! Live DNS lookups + basic syntax validation for the SPF / DKIM /
//! DMARC / MX / BIMI records SabNode's email-suite cares about.
//!
//! The check is intentionally cheap — it runs against the system's
//! resolver via `hickory-resolver` and does coarse-grained syntax
//! validation only. A proper "is the SPF chain actually correct" walk
//! lives in a later phase; the goal here is to give the dashboard a
//! "your DNS is set up" gate.
//!
//! All record-finding helpers return `Option<T>` rather than `Result`
//! because a missing record is a normal state we want to surface as
//! `valid: false` rather than a 500.

use chrono::Utc;
use hickory_resolver::TokioAsyncResolver;
use hickory_resolver::config::{ResolverConfig, ResolverOpts};

use crate::dto::{
    BimiRecord, DkimRecord, DmarcRecord, DnsRecords, DnsSnapshot, MxRecord, SpfRecord,
};

/// Default DKIM selector to look up when the caller doesn't supply one.
pub const DEFAULT_DKIM_SELECTOR: &str = "default";

/// Run all five DNS lookups (SPF / DKIM / DMARC / MX / BIMI) for the
/// given domain and return a populated [`DnsSnapshot`] with a 0..=100
/// score.
///
/// Errors from the resolver are swallowed per record — a record we
/// cannot find is rendered as `valid: false` rather than failing the
/// whole snapshot. The only way this function returns `Err` is if the
/// resolver itself fails to construct, which only happens under
/// extreme misconfiguration.
pub async fn check_domain(
    domain: &str,
    dkim_selector: Option<&str>,
) -> anyhow::Result<DnsSnapshot> {
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());
    let selector = dkim_selector.unwrap_or(DEFAULT_DKIM_SELECTOR);

    let spf = lookup_spf(&resolver, domain).await;
    let dkim = lookup_dkim(&resolver, domain, selector).await;
    let dmarc = lookup_dmarc(&resolver, domain).await;
    let mx = lookup_mx(&resolver, domain).await;
    let bimi = lookup_bimi(&resolver, domain).await;

    let records = DnsRecords {
        spf,
        dkim,
        dmarc,
        mx,
        bimi,
    };
    let score = score_snapshot(&records);

    Ok(DnsSnapshot {
        domain: domain.to_owned(),
        records,
        score,
        checked_at: Utc::now().to_rfc3339(),
    })
}

/// Compute the 0..=100 score from a snapshot. Weights:
///
/// - SPF:   25
/// - DKIM:  25
/// - DMARC: 20
/// - MX:    20
/// - BIMI:  10
pub fn score_snapshot(records: &DnsRecords) -> u8 {
    let mut s: u32 = 0;
    if records.spf.as_ref().is_some_and(|r| r.valid) {
        s += 25;
    }
    if records.dkim.as_ref().is_some_and(|r| r.valid) {
        s += 25;
    }
    if records.dmarc.as_ref().is_some_and(|r| r.valid) {
        s += 20;
    }
    if records.mx.as_ref().is_some_and(|r| r.valid) {
        s += 20;
    }
    if records.bimi.as_ref().is_some_and(|r| r.valid) {
        s += 10;
    }
    s.min(100) as u8
}

// ---------------------------------------------------------------------------
// Per-record lookups
// ---------------------------------------------------------------------------

async fn lookup_spf(resolver: &TokioAsyncResolver, domain: &str) -> Option<SpfRecord> {
    let txt = fetch_txt(resolver, domain).await;
    let record = txt
        .iter()
        .find(|s| s.to_ascii_lowercase().starts_with("v=spf1"))
        .cloned();
    match record {
        Some(r) => {
            let mut issues = Vec::new();
            if !r.contains("all") {
                issues.push("missing terminal `all` directive".to_owned());
            }
            let valid = issues.is_empty();
            Some(SpfRecord {
                record: r,
                valid,
                issues,
            })
        }
        None => Some(SpfRecord {
            record: String::new(),
            valid: false,
            issues: vec!["no v=spf1 TXT record at apex".to_owned()],
        }),
    }
}

async fn lookup_dkim(
    resolver: &TokioAsyncResolver,
    domain: &str,
    selector: &str,
) -> Option<DkimRecord> {
    let host = format!("{selector}._domainkey.{domain}");
    let txt = fetch_txt(resolver, &host).await;
    let record = txt
        .iter()
        .find(|s| s.to_ascii_lowercase().contains("v=dkim1"))
        .cloned();
    match record {
        Some(r) => {
            let bits = guess_dkim_bits(&r);
            let valid = r.contains("p=") && !r.contains("p=;");
            Some(DkimRecord {
                selector: selector.to_owned(),
                record: r,
                valid,
                bits,
            })
        }
        None => Some(DkimRecord {
            selector: selector.to_owned(),
            record: String::new(),
            valid: false,
            bits: None,
        }),
    }
}

async fn lookup_dmarc(resolver: &TokioAsyncResolver, domain: &str) -> Option<DmarcRecord> {
    let host = format!("_dmarc.{domain}");
    let txt = fetch_txt(resolver, &host).await;
    let record = txt
        .iter()
        .find(|s| s.to_ascii_lowercase().starts_with("v=dmarc1"))
        .cloned();
    match record {
        Some(r) => {
            let policy = extract_dmarc_policy(&r);
            let valid = policy.is_some();
            Some(DmarcRecord {
                record: r,
                policy,
                valid,
            })
        }
        None => Some(DmarcRecord {
            record: String::new(),
            policy: None,
            valid: false,
        }),
    }
}

async fn lookup_mx(resolver: &TokioAsyncResolver, domain: &str) -> Option<MxRecord> {
    match resolver.mx_lookup(domain).await {
        Ok(answer) => {
            let mut entries: Vec<(u16, String)> = answer
                .iter()
                .map(|m| (m.preference(), m.exchange().to_utf8()))
                .collect();
            entries.sort_by_key(|(pref, _)| *pref);
            let records: Vec<String> = entries
                .into_iter()
                .map(|(pref, host)| format!("{pref} {host}"))
                .collect();
            Some(MxRecord {
                valid: !records.is_empty(),
                records,
            })
        }
        Err(_) => Some(MxRecord {
            records: Vec::new(),
            valid: false,
        }),
    }
}

async fn lookup_bimi(resolver: &TokioAsyncResolver, domain: &str) -> Option<BimiRecord> {
    let host = format!("default._bimi.{domain}");
    let txt = fetch_txt(resolver, &host).await;
    let record = txt
        .iter()
        .find(|s| s.to_ascii_lowercase().starts_with("v=bimi1"))
        .cloned();
    match record {
        Some(r) => {
            let valid = r.contains("l=");
            Some(BimiRecord { record: r, valid })
        }
        None => Some(BimiRecord {
            record: String::new(),
            valid: false,
        }),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Run a TXT lookup and return each record concatenated to a single
/// string (DNS TXT records arrive as chunks of ≤255 bytes). Resolver
/// errors are swallowed — we return an empty Vec, which the callers
/// render as `valid: false`.
async fn fetch_txt(resolver: &TokioAsyncResolver, host: &str) -> Vec<String> {
    match resolver.txt_lookup(host).await {
        Ok(answer) => answer
            .iter()
            .map(|r| {
                r.iter()
                    .map(|chunk| String::from_utf8_lossy(chunk).to_string())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Coarse-grained DKIM key size estimate — pulls the base64 `p=` blob,
/// decodes it, and infers bits from the modulus length. Returns `None`
/// if the record doesn't look like a key.
fn guess_dkim_bits(record: &str) -> Option<u32> {
    use base64::Engine;
    let p = record.split(';').find_map(|kv| {
        let kv = kv.trim();
        if let Some(rest) = kv.strip_prefix("p=") {
            Some(rest.trim())
        } else if let Some(rest) = kv.strip_prefix("P=") {
            Some(rest.trim())
        } else {
            None
        }
    })?;
    if p.is_empty() {
        return None;
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(p).ok()?;
    // SubjectPublicKeyInfo for a 2048-bit RSA key is ~294 bytes; 1024-bit
    // is ~162. Map by length buckets.
    let n = bytes.len();
    if n >= 280 {
        Some(2048)
    } else if n >= 150 {
        Some(1024)
    } else {
        None
    }
}

/// Pull `p=<policy>` out of a DMARC record. Returns the normalised
/// lowercase value (`none` / `quarantine` / `reject`) if present and
/// recognised.
fn extract_dmarc_policy(record: &str) -> Option<String> {
    for kv in record.split(';') {
        let kv = kv.trim();
        if let Some(rest) = kv.strip_prefix("p=") {
            let v = rest.trim().to_ascii_lowercase();
            if matches!(v.as_str(), "none" | "quarantine" | "reject") {
                return Some(v);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_zero_when_all_invalid() {
        let r = DnsRecords::default();
        assert_eq!(score_snapshot(&r), 0);
    }

    #[test]
    fn score_caps_at_100() {
        let r = DnsRecords {
            spf: Some(SpfRecord {
                record: "v=spf1 -all".into(),
                valid: true,
                issues: vec![],
            }),
            dkim: Some(DkimRecord {
                selector: "default".into(),
                record: "v=DKIM1; p=abc".into(),
                valid: true,
                bits: Some(2048),
            }),
            dmarc: Some(DmarcRecord {
                record: "v=DMARC1; p=reject".into(),
                policy: Some("reject".into()),
                valid: true,
            }),
            mx: Some(MxRecord {
                records: vec!["10 mx.example.com.".into()],
                valid: true,
            }),
            bimi: Some(BimiRecord {
                record: "v=BIMI1; l=https://example.com/logo.svg".into(),
                valid: true,
            }),
        };
        assert_eq!(score_snapshot(&r), 100);
    }

    #[test]
    fn dmarc_policy_extraction() {
        assert_eq!(
            extract_dmarc_policy("v=DMARC1; p=reject; rua=mailto:r@example.com"),
            Some("reject".to_owned())
        );
        assert_eq!(extract_dmarc_policy("v=DMARC1;"), None);
    }
}
