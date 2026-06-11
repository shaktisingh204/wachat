//! Public-id generation + prefix guards for every SabPay entity.
//!
//! Razorpay-style ids: `<prefix>_<24 lower-case hex>`. The prefix names the
//! entity (`pay`, `order`, `rfnd`, …) and the 24-hex tail is unguessable, so a
//! public surface can treat "knows the id" as the capability without a
//! principal. Mirrors the historical `pay_<hex>` shape the payments code
//! already produced.

use crate::store::random_hex;

/// `pay` | `order` | `rfnd` | `cust` | `plink` | `page` | `plan` | `sub` |
/// `inv` | `qr` | `setl` | `disp` | `evt`.
pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", random_hex(12))
}

/// True when `id` is a non-empty value carrying the `<prefix>_` marker.
pub fn has_prefix(id: &str, prefix: &str) -> bool {
    id.len() > prefix.len() + 1 && id.starts_with(prefix) && id.as_bytes()[prefix.len()] == b'_'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_id_shape() {
        let id = new_id("order");
        assert!(id.starts_with("order_"));
        assert_eq!(id.len(), "order_".len() + 24); // 12 bytes → 24 hex chars
        assert!(id["order_".len()..].chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(new_id("pay"), new_id("pay")); // unguessable / unique
    }

    #[test]
    fn has_prefix_guards() {
        assert!(has_prefix("order_abc123", "order"));
        assert!(has_prefix("pay_deadbeef", "pay"));
        assert!(!has_prefix("orderabc", "order")); // missing underscore
        assert!(!has_prefix("order_", "order")); // nothing after underscore
        assert!(!has_prefix("plink_x", "pay")); // wrong prefix
    }
}
