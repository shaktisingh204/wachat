//! Executor for entities backed by static reference data (no Mongo
//! collection). Today: Currency (12 ISO codes) + Country (~30 most
//! common) + State (Indian states + UTs).
//!
//! Data is hard-coded here to keep the crate dependency-free; growing
//! lists (full ISO 3166-1, US/EU states) can later move to a
//! compile-time CSV via `include_str!` without changing the API.

use crm_lookup_types::{
    LOOKUP_DEFAULT_LIMIT, LOOKUP_MAX_LIMIT, LookupChip, LookupItem, LookupParams, LookupResult,
};
use sabnode_common::Result;

/// (id, primary, secondary, tertiary)
type StaticRow = (
    &'static str,
    &'static str,
    Option<&'static str>,
    Option<&'static str>,
);

/// 12 ISO 4217 currency codes — matches the TS lookup-registry static
/// list. Tuple shape: (code, code, symbol, name).
const CURRENCIES: &[StaticRow] = &[
    ("INR", "INR", Some("₹"), Some("Indian Rupee")),
    ("USD", "USD", Some("$"), Some("US Dollar")),
    ("EUR", "EUR", Some("€"), Some("Euro")),
    ("GBP", "GBP", Some("£"), Some("British Pound")),
    ("JPY", "JPY", Some("¥"), Some("Japanese Yen")),
    ("CNY", "CNY", Some("¥"), Some("Chinese Yuan")),
    ("AUD", "AUD", Some("A$"), Some("Australian Dollar")),
    ("CAD", "CAD", Some("C$"), Some("Canadian Dollar")),
    ("CHF", "CHF", Some("Fr"), Some("Swiss Franc")),
    ("SGD", "SGD", Some("S$"), Some("Singapore Dollar")),
    ("AED", "AED", Some("د.إ"), Some("UAE Dirham")),
    ("BRL", "BRL", Some("R$"), Some("Brazilian Real")),
];

/// Common ISO 3166-1 alpha-2 codes. Tuple shape: (code, code, name, None).
/// Full 250-country list lives in a future `country_data.csv`; this
/// trimmed set covers the tenants we know about today.
const COUNTRIES: &[StaticRow] = &[
    ("IN", "IN", Some("India"), None),
    ("US", "US", Some("United States"), None),
    ("GB", "GB", Some("United Kingdom"), None),
    ("AE", "AE", Some("United Arab Emirates"), None),
    ("SG", "SG", Some("Singapore"), None),
    ("AU", "AU", Some("Australia"), None),
    ("CA", "CA", Some("Canada"), None),
    ("DE", "DE", Some("Germany"), None),
    ("FR", "FR", Some("France"), None),
    ("JP", "JP", Some("Japan"), None),
    ("CN", "CN", Some("China"), None),
    ("BR", "BR", Some("Brazil"), None),
    ("ZA", "ZA", Some("South Africa"), None),
    ("MX", "MX", Some("Mexico"), None),
    ("ID", "ID", Some("Indonesia"), None),
    ("MY", "MY", Some("Malaysia"), None),
    ("PH", "PH", Some("Philippines"), None),
    ("TH", "TH", Some("Thailand"), None),
    ("VN", "VN", Some("Vietnam"), None),
    ("BD", "BD", Some("Bangladesh"), None),
    ("LK", "LK", Some("Sri Lanka"), None),
    ("NP", "NP", Some("Nepal"), None),
    ("PK", "PK", Some("Pakistan"), None),
    ("CH", "CH", Some("Switzerland"), None),
    ("NL", "NL", Some("Netherlands"), None),
    ("ES", "ES", Some("Spain"), None),
    ("IT", "IT", Some("Italy"), None),
    ("SE", "SE", Some("Sweden"), None),
    ("NO", "NO", Some("Norway"), None),
    ("DK", "DK", Some("Denmark"), None),
    ("IE", "IE", Some("Ireland"), None),
    ("KR", "KR", Some("South Korea"), None),
    ("IL", "IL", Some("Israel"), None),
    ("TR", "TR", Some("Turkey"), None),
    ("SA", "SA", Some("Saudi Arabia"), None),
];

/// Indian states + UTs. Tuple shape: (state-code, name, region, None).
/// Region helps distinguish "Punjab" India from "Punjab" Pakistan in
/// shared lists later.
const STATES: &[StaticRow] = &[
    ("AP", "Andhra Pradesh", Some("South"), None),
    ("AR", "Arunachal Pradesh", Some("Northeast"), None),
    ("AS", "Assam", Some("Northeast"), None),
    ("BR", "Bihar", Some("East"), None),
    ("CG", "Chhattisgarh", Some("Central"), None),
    ("GA", "Goa", Some("West"), None),
    ("GJ", "Gujarat", Some("West"), None),
    ("HR", "Haryana", Some("North"), None),
    ("HP", "Himachal Pradesh", Some("North"), None),
    ("JH", "Jharkhand", Some("East"), None),
    ("KA", "Karnataka", Some("South"), None),
    ("KL", "Kerala", Some("South"), None),
    ("MP", "Madhya Pradesh", Some("Central"), None),
    ("MH", "Maharashtra", Some("West"), None),
    ("MN", "Manipur", Some("Northeast"), None),
    ("ML", "Meghalaya", Some("Northeast"), None),
    ("MZ", "Mizoram", Some("Northeast"), None),
    ("NL", "Nagaland", Some("Northeast"), None),
    ("OD", "Odisha", Some("East"), None),
    ("PB", "Punjab", Some("North"), None),
    ("RJ", "Rajasthan", Some("West"), None),
    ("SK", "Sikkim", Some("Northeast"), None),
    ("TN", "Tamil Nadu", Some("South"), None),
    ("TG", "Telangana", Some("South"), None),
    ("TR", "Tripura", Some("Northeast"), None),
    ("UP", "Uttar Pradesh", Some("North"), None),
    ("UK", "Uttarakhand", Some("North"), None),
    ("WB", "West Bengal", Some("East"), None),
    ("AN", "Andaman & Nicobar Islands", Some("UT"), None),
    ("CH", "Chandigarh", Some("UT"), None),
    (
        "DN",
        "Dadra & Nagar Haveli and Daman & Diu",
        Some("UT"),
        None,
    ),
    ("DL", "Delhi", Some("UT"), None),
    ("JK", "Jammu & Kashmir", Some("UT"), None),
    ("LA", "Ladakh", Some("UT"), None),
    ("LD", "Lakshadweep", Some("UT"), None),
    ("PY", "Puducherry", Some("UT"), None),
];

/// Standard units of measure. Mirrors the TS `STATIC_UNITS` list.
/// Tuple shape: (code, code, None, None) — id == primary == code.
const UNITS: &[StaticRow] = &[
    ("PCS", "PCS", None, None),
    ("KG", "KG", None, None),
    ("G", "G", None, None),
    ("L", "L", None, None),
    ("ML", "ML", None, None),
    ("HRS", "HRS", None, None),
    ("DAYS", "DAYS", None, None),
    ("BOX", "BOX", None, None),
    ("PACK", "PACK", None, None),
    ("DOZEN", "DOZEN", None, None),
    ("PAIR", "PAIR", None, None),
    ("ROLL", "ROLL", None, None),
    ("METER", "METER", None, None),
    ("FT", "FT", None, None),
    ("INCH", "INCH", None, None),
    ("M2", "M2", None, None),
    ("M3", "M3", None, None),
    ("TON", "TON", None, None),
];

/// Coarse industry classification. Mirrors `STATIC_INDUSTRIES` in TS.
const INDUSTRIES: &[StaticRow] = &[
    ("SaaS", "SaaS", None, None),
    ("E-commerce", "E-commerce", None, None),
    ("Manufacturing", "Manufacturing", None, None),
    ("Retail", "Retail", None, None),
    ("Healthcare", "Healthcare", None, None),
    ("Finance", "Finance", None, None),
    ("Education", "Education", None, None),
    ("Real Estate", "Real Estate", None, None),
    ("Hospitality", "Hospitality", None, None),
    ("Transportation", "Transportation", None, None),
    ("Construction", "Construction", None, None),
    ("Agriculture", "Agriculture", None, None),
    ("Media", "Media", None, None),
    ("Telecom", "Telecom", None, None),
    ("Other", "Other", None, None),
];

/// Vendor classification. Mirrors `STATIC_VENDOR_TYPES` in TS.
const VENDOR_TYPES: &[StaticRow] = &[
    ("goods", "goods", None, None),
    ("services", "services", None, None),
    ("both", "both", None, None),
];

fn matches(haystack: &str, needle: &str) -> bool {
    haystack
        .to_ascii_lowercase()
        .contains(&needle.to_ascii_lowercase())
}

fn search_static(rows: &[StaticRow], params: &LookupParams) -> Result<LookupResult> {
    let q = params.q.as_deref().filter(|s| !s.is_empty());
    let filtered: Vec<&StaticRow> = rows
        .iter()
        .filter(|(id, primary, secondary, tertiary)| match q {
            None => true,
            Some(needle) => {
                matches(id, needle)
                    || matches(primary, needle)
                    || secondary.is_some_and(|s| matches(s, needle))
                    || tertiary.is_some_and(|s| matches(s, needle))
            }
        })
        .collect();

    let limit = params
        .limit
        .unwrap_or(LOOKUP_DEFAULT_LIMIT)
        .clamp(1, LOOKUP_MAX_LIMIT) as usize;
    let page = params.page.unwrap_or(0) as usize;
    let total = filtered.len() as u64;
    let start = page.saturating_mul(limit).min(filtered.len());
    let end = (start + limit).min(filtered.len());

    let items: Vec<LookupItem> = filtered[start..end]
        .iter()
        .map(|(id, primary, secondary, tertiary)| LookupItem {
            id: (*id).to_owned(),
            chip: LookupChip {
                primary: (*primary).to_owned(),
                secondary: secondary.map(str::to_owned),
                tertiary: tertiary.map(str::to_owned),
                ..Default::default()
            },
            raw: serde_json::Value::Null,
        })
        .collect();

    Ok(LookupResult {
        items,
        page: page as u32,
        limit: limit as u32,
        total: Some(total),
        has_more: end < total as usize,
        recent: vec![],
    })
}

pub fn currency_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(CURRENCIES, params)
}

pub fn country_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(COUNTRIES, params)
}

pub fn state_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(STATES, params)
}

pub fn units_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(UNITS, params)
}

pub fn industries_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(INDUSTRIES, params)
}

pub fn vendor_types_search(params: &LookupParams) -> Result<LookupResult> {
    search_static(VENDOR_TYPES, params)
}

/// `location` has no canonical static dataset — it overlaps with
/// country, state, and free-text city across consumers, so the
/// executor returns an empty envelope. The TS registry mirrors this
/// behavior; see `crm-lookup.actions.ts`.
///
/// TODO(location): wire up `crm_locations`, or compose Country and
/// State once requirements solidify.
pub fn location_search(params: &LookupParams) -> Result<LookupResult> {
    let limit = params
        .limit
        .unwrap_or(LOOKUP_DEFAULT_LIMIT)
        .clamp(1, LOOKUP_MAX_LIMIT);
    let page = params.page.unwrap_or(0);
    Ok(LookupResult {
        items: vec![],
        page,
        limit,
        total: Some(0),
        has_more: false,
        recent: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_q() -> LookupParams {
        LookupParams::default()
    }

    fn q(text: &str) -> LookupParams {
        LookupParams {
            q: Some(text.into()),
            ..Default::default()
        }
    }

    #[test]
    fn currency_unfiltered_returns_all() {
        let r = currency_search(&no_q()).unwrap();
        assert_eq!(r.total, Some(12));
        assert_eq!(r.items.len(), 12);
    }

    #[test]
    fn currency_search_inr() {
        let r = currency_search(&q("rupee")).unwrap();
        assert_eq!(r.total, Some(1));
        assert_eq!(r.items[0].id, "INR");
    }

    #[test]
    fn country_search_india() {
        let r = country_search(&q("India")).unwrap();
        assert!(r.items.iter().any(|i| i.id == "IN"));
    }

    #[test]
    fn state_search_karnataka_via_id() {
        let r = state_search(&q("KA")).unwrap();
        assert!(r.items.iter().any(|i| i.chip.primary == "Karnataka"));
    }

    #[test]
    fn state_paginates_when_many_match() {
        let p = LookupParams {
            limit: Some(5),
            page: Some(0),
            ..Default::default()
        };
        let r = state_search(&p).unwrap();
        assert_eq!(r.items.len(), 5);
        assert!(r.has_more);
        assert_eq!(r.total, Some(36));
    }
}
