//! Region (ISO-3166 alpha-2) → ITU country-calling-code lookup.
//!
//! This is intentionally a small hand-coded subset (the regions sabnode
//! actually onboards customers from). The full table lives in
//! `src/lib/country-codes.ts`; if a new region is needed, add it here AND
//! to the TS file so the two stay in sync.

/// Returns the ITU country-calling-code for a given ISO-3166 alpha-2
/// region, or `None` if unknown. Region matching is case-insensitive.
pub fn country_code_for_region(region: &str) -> Option<u16> {
    let r = region.trim();
    if r.len() != 2 {
        return None;
    }
    // Uppercase without allocating beyond the stack (regions are 2 chars).
    let mut buf = [0u8; 2];
    for (i, b) in r.as_bytes().iter().take(2).enumerate() {
        buf[i] = b.to_ascii_uppercase();
    }
    match &buf {
        b"IN" => Some(91),
        b"US" => Some(1),
        b"GB" => Some(44),
        b"CA" => Some(1),
        b"AU" => Some(61),
        b"AE" => Some(971),
        b"SG" => Some(65),
        b"BR" => Some(55),
        b"MX" => Some(52),
        b"NG" => Some(234),
        b"ZA" => Some(27),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_regions() {
        assert_eq!(country_code_for_region("IN"), Some(91));
        assert_eq!(country_code_for_region("in"), Some(91));
        assert_eq!(country_code_for_region(" us "), Some(1));
        assert_eq!(country_code_for_region("AE"), Some(971));
    }

    #[test]
    fn unknown_or_malformed() {
        assert_eq!(country_code_for_region("ZZ"), None);
        assert_eq!(country_code_for_region("USA"), None);
        assert_eq!(country_code_for_region(""), None);
    }
}
